import { join, resolve } from 'node:path'
import { hostname } from 'node:os'
import { writeFile } from 'node:fs/promises'
import { app, BrowserWindow, dialog, ipcMain, powerMonitor, shell } from 'electron'
import type { PhaseZeroStatus, ProviderProbe } from '../shared/contracts.js'
import { IPC_CHANNELS } from '../shared/contracts.js'
import { PHASE_ONE_IPC_CHANNELS, type AppEvent } from '../shared/ipc/phase-one-contract.js'
import { UPDATE_IPC_CHANNELS, type AppUpdateStatus } from '../shared/ipc/update-contract.js'
import { JobQueueService } from './application/job-queue-service.js'
import { SourceIngestionService } from './application/source-ingestion-service.js'
import { SourceService } from './application/source-service.js'
import { SourceSyncWorker } from './application/source-sync-worker.js'
import { CloudSyncWorker } from './application/cloud-sync-worker.js'
import { VaultService } from './application/vault-service.js'
import { registerPhaseOneIpcHandlers } from './ipc/phase-one-handlers.js'
import { registerPhaseTwoIpcHandlers } from './ipc/phase-two-handlers.js'
import { shouldHideWindowOnClose } from './lifecycle/window-lifecycle.js'
import { openAlphaKDatabase, type AlphaKDatabase } from './persistence/database.js'
import { ArtifactRepository } from './persistence/repositories/artifact-repository.js'
import { JobRepository } from './persistence/repositories/job-repository.js'
import { KnowledgeRepository } from './persistence/repositories/knowledge-repository.js'
import { KnowledgeStateRepository } from './persistence/repositories/knowledge-state-repository.js'
import { CloudSyncRepository } from './persistence/repositories/cloud-sync-repository.js'
import { SourceRepository } from './persistence/repositories/source-repository.js'
import { SyncRunRepository } from './persistence/repositories/sync-run-repository.js'
import { VaultRepository } from './persistence/repositories/vault-repository.js'
import { RssConnector } from './connectors/rss-connector.js'
import { CloudAuthService } from './cloud/cloud-auth-service.js'
import { readCloudConfig } from './cloud/cloud-config.js'
import { SecureSessionStorage } from './cloud/secure-session-storage.js'
import { SupabaseRemoteSyncProvider } from './cloud/supabase-remote-sync-provider.js'
import { registerCloudIpcHandlers } from './ipc/cloud-handlers.js'
import { registerUpdateIpcHandlers } from './ipc/update-handlers.js'
import { probeCodex } from './providers/codex-probe.js'
import { probeQoder } from './providers/qoder-probe.js'
import { AppUpdateService } from './update/app-update-service.js'
import { GitHubUpdateClient, updateDownloadDirectory } from './update/github-update-client.js'
import { MacUpdateInstaller, updateHealthPathFromArgs } from './update/macos-update-installer.js'
import { UPDATE_ASSET_PREFIX, UPDATE_MANIFEST_URL, UPDATE_PUBLIC_KEY_PEM } from './update/update-config.js'

let mainWindow: BrowserWindow | null = null
let isQuitting = false
let shutdownComplete = false
let shutdownPromise: Promise<void> | null = null
let database: AlphaKDatabase | null = null
let jobQueueService: JobQueueService | null = null
let sourceSyncWorker: SourceSyncWorker | null = null
let syncRunRepository: SyncRunRepository | null = null
let cloudAuthService: CloudAuthService | null = null
let cloudSyncWorker: CloudSyncWorker | null = null
let updateService: AppUpdateService | null = null
let pendingAuthDeepLink: string | null = null
let providers: ProviderProbe[] = []
let backgroundTicks = 0
let lastLifecycleEvent: PhaseZeroStatus['lastLifecycleEvent'] = 'started'
const startedAt = new Date().toISOString()
const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  registerProtocolClient()
  app.on('second-instance', (_event, commandLine) => {
    const deepLink = commandLine.find((argument) => argument.startsWith('alpha-k://'))
    if (deepLink) void handleAuthDeepLink(deepLink)
    focusMainWindow()
  })
}

app.on('open-url', (event, url) => {
  event.preventDefault()
  void handleAuthDeepLink(url)
})

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 820,
    minHeight: 600,
    show: false,
    title: 'Alpha-K',
    backgroundColor: '#eeede7',
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 16, y: 15 },
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  window.once('ready-to-show', () => window.show())
  window.on('close', (event) => {
    if (!shouldHideWindowOnClose(isQuitting)) return
    event.preventDefault()
    window.hide()
    lastLifecycleEvent = 'window-hidden'
    logPhaseZero('window-hidden', { backgroundTicks })
    broadcastStatus()
  })
  window.on('show', () => {
    lastLifecycleEvent = 'window-restored'
    logPhaseZero('window-restored', { backgroundTicks })
    broadcastStatus()
  })

  if (!app.isPackaged) {
    window.webContents.on('console-message', (event) => {
      if (event.level === 'error') console.error(`[renderer] ${event.message}`)
    })
    window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      console.error(`[renderer] failed to load ${validatedURL}: ${errorCode} ${errorDescription}`)
    })
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return window
}

function currentStatus(): PhaseZeroStatus {
  return {
    startedAt,
    backgroundTicks,
    windowVisible: mainWindow?.isVisible() ?? false,
    lastLifecycleEvent,
    database: database?.health ?? {
      path: '',
      migrationVersion: 0,
      fts5: false,
      trigramChinese: false,
      error: 'Database has not been initialized.',
    },
    providers,
  }
}

function broadcastStatus(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send(IPC_CHANNELS.phaseZeroStatus, currentStatus())
}

function broadcastAppEvent(event: AppEvent): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send(PHASE_ONE_IPC_CHANNELS.appEvent, event)
}

function broadcastUpdateStatus(status: AppUpdateStatus): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send(UPDATE_IPC_CHANNELS.statusChanged, status)
}

async function refreshProviders(): Promise<ProviderProbe[]> {
  providers = await Promise.all([
    safelyProbeProvider('codex', () => probeCodex()),
    safelyProbeProvider('qoder', () => probeQoder()),
  ])
  logPhaseZero('providers-refreshed', {
    providers: providers.map(({ provider, status, version, selectedExecutable }) => ({
      provider,
      status,
      version,
      selectedExecutable,
    })),
  })
  broadcastStatus()
  return providers
}

async function safelyProbeProvider(
  provider: ProviderProbe['provider'],
  probe: () => Promise<ProviderProbe>,
): Promise<ProviderProbe> {
  try {
    return await probe()
  } catch (error) {
    return {
      provider,
      status: 'broken_installation',
      detail: error instanceof Error ? error.message : String(error),
      attempts: [],
    }
  }
}

function registerIpc(
  vaultService: VaultService,
  jobs: JobQueueService,
  sourceService: SourceService,
  authService: CloudAuthService,
  updates: AppUpdateService,
): void {
  ipcMain.handle(IPC_CHANNELS.getPhaseZeroStatus, () => currentStatus())
  ipcMain.handle(IPC_CHANNELS.refreshProviders, () => refreshProviders())
  registerPhaseOneIpcHandlers({
    ipcMain,
    vaultService,
    jobQueueService: jobs,
    selectVaultDirectory,
  })
  registerPhaseTwoIpcHandlers({ ipcMain, sourceService })
  registerCloudIpcHandlers({ ipcMain, cloudAuthService: authService })
  registerUpdateIpcHandlers({ ipcMain, updateService: updates })
}

async function selectVaultDirectory(): Promise<string | undefined> {
  const options: Electron.OpenDialogOptions = {
    title: '选择或创建 Knowledge Vault',
    properties: ['openDirectory', 'createDirectory'],
  }
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options)
  return result.canceled ? undefined : result.filePaths[0]
}

app.on('before-quit', (event) => {
  isQuitting = true
  logPhaseZero('before-quit', { backgroundTicks })
  if (shutdownComplete) return
  event.preventDefault()
  void prepareForShutdown().finally(() => app.quit())
})

app.on('activate', () => {
  if (!mainWindow || mainWindow.isDestroyed()) mainWindow = createWindow()
  mainWindow.show()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

void app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return
  database = openAlphaKDatabase(join(app.getPath('userData'), 'app.sqlite'))
  logPhaseZero('database-ready', database.health)
  const vaultRepository = new VaultRepository(database.database)
  const knowledgeRepository = new KnowledgeRepository(database.database)
  const knowledgeStateRepository = new KnowledgeStateRepository(database.database)
  const cloudSyncRepository = new CloudSyncRepository(database.database)
  const artifactRepository = new ArtifactRepository(database.database)
  const sourceRepository = new SourceRepository(database.database)
  const jobRepository = new JobRepository(database.database)
  syncRunRepository = new SyncRunRepository(database.database)
  const rssConnector = new RssConnector()
  const vaultService = new VaultService(vaultRepository, knowledgeRepository)
  jobQueueService = new JobQueueService(jobRepository, (job) => {
    broadcastAppEvent({ type: 'job.updated', job })
    if (job.type !== 'source.sync') return
    const syncRun =
      job.status === 'cancelled'
        ? syncRunRepository?.cancelByJobId(job.id)
        : job.status === 'queued'
          ? syncRunRepository?.requeueByJobId(job.id)
          : undefined
    if (syncRun) broadcastAppEvent({ type: 'source.sync.updated', syncRun })
  })
  const recovery = jobQueueService.recoverOnStartup()
  const reconciledSyncRuns = syncRunRepository.reconcileJobStatuses()
  const vaultConnection = await vaultService.getConnection()
  const sourceService = new SourceService({
    database: database.database,
    sourceRepository,
    syncRunRepository,
    jobRepository,
    knowledgeRepository,
    rssConnector,
    onSourceUpdated: (source) => broadcastAppEvent({ type: 'source.updated', source }),
    onSourceDeleted: (sourceId) => broadcastAppEvent({ type: 'source.deleted', sourceId }),
    onSyncRunUpdated: (syncRun) => broadcastAppEvent({ type: 'source.sync.updated', syncRun }),
    onJobUpdated: (job) => broadcastAppEvent({ type: 'job.updated', job }),
  })
  cloudAuthService = new CloudAuthService({
    config: readCloudConfig(),
    storage: new SecureSessionStorage(join(app.getPath('userData'), 'supabase-session.bin')),
    openExternal: (url) => shell.openExternal(url),
    onStatusChanged: (status) => {
      broadcastAppEvent({ type: 'cloud.status.changed', status })
      if (status.auth === 'signed_in') cloudSyncWorker?.wake()
    },
  })
  await cloudAuthService.initialize()
  cloudSyncWorker = new CloudSyncWorker({
    authService: cloudAuthService,
    repository: cloudSyncRepository,
    knowledgeRepository,
    knowledgeStateRepository,
    sourceRepository,
    createProvider: () =>
      new SupabaseRemoteSyncProvider(cloudAuthService!.getAuthenticatedClient()),
    deviceName: hostname(),
    platform: 'macos',
    appVersion: app.getVersion(),
    onError: (error) =>
      console.error('[phase-three] cloud sync error', error instanceof Error ? error.message : String(error)),
  })
  const ingestionService = new SourceIngestionService({
    database: database.database,
    knowledgeRepository,
    artifactRepository,
    vaultRepository,
    rssConnector,
  })
  sourceSyncWorker = new SourceSyncWorker({
    database: database.database,
    jobRepository,
    syncRunRepository,
    sourceRepository,
    ingestionService,
    workerId: `source-sync:${process.pid}`,
    onJobUpdated: (job) => broadcastAppEvent({ type: 'job.updated', job }),
    onSyncRunUpdated: (syncRun) => broadcastAppEvent({ type: 'source.sync.updated', syncRun }),
    onSourceUpdated: (source) => broadcastAppEvent({ type: 'source.updated', source }),
    onInboxChanged: (itemIds) => {
      broadcastAppEvent({ type: 'inbox.changed', itemIds })
      cloudSyncWorker?.enqueueKnowledgeItems(itemIds)
    },
    onError: (error) => console.error('[phase-two] source worker error', error),
  })
  const appBundlePath = currentAppBundlePath()
  updateService = new AppUpdateService({
    client: new GitHubUpdateClient({
      manifestUrl: UPDATE_MANIFEST_URL,
      expectedAssetPrefix: UPDATE_ASSET_PREFIX,
      publicKeyPem: UPDATE_PUBLIC_KEY_PEM,
      updateDirectory: updateDownloadDirectory(appBundlePath),
    }),
    installer: new MacUpdateInstaller({
      appBundlePath,
      appName: app.getName(),
      currentVersion: app.getVersion(),
      processId: process.pid,
    }),
    currentVersion: app.getVersion(),
    isPackaged: app.isPackaged,
    prepareForInstall: async () => {
      isQuitting = true
      await prepareForShutdown()
    },
    quitForInstall: () => app.quit(),
    onStatusChanged: broadcastUpdateStatus,
  })
  console.info(
    `[phase-two] startup ${JSON.stringify({ recovery, reconciledSyncRuns, vault: vaultConnection.state })}`,
  )
  registerIpc(vaultService, jobQueueService, sourceService, cloudAuthService, updateService)
  mainWindow = createWindow()
  const startupDeepLink =
    pendingAuthDeepLink ?? process.argv.find((argument) => argument.startsWith('alpha-k://')) ?? null
  pendingAuthDeepLink = null
  if (startupDeepLink) void handleAuthDeepLink(startupDeepLink)
  sourceSyncWorker.start()
  cloudSyncWorker.start()
  updateService.start()
  await writeUpdateHealthMarker(appBundlePath)

  powerMonitor.on('suspend', () => {
    lastLifecycleEvent = 'suspend'
    broadcastStatus()
  })
  powerMonitor.on('resume', () => {
    lastLifecycleEvent = 'resume'
    void refreshProviders()
    cloudSyncWorker?.wake()
  })

  setInterval(() => {
    backgroundTicks += 1
    broadcastStatus()
  }, 1_000).unref()

  await refreshProviders()
  if (process.argv.includes('--phase-zero-lifecycle-smoke')) {
    await runLifecycleSmoke(mainWindow)
  }
})

app.on('will-quit', () => {
  finalizeApplicationResources()
})

async function prepareForShutdown(): Promise<void> {
  if (shutdownComplete) return
  if (shutdownPromise) return shutdownPromise
  shutdownPromise = (async () => {
    const drains = await Promise.allSettled([
      sourceSyncWorker?.shutdown() ?? Promise.resolve(),
      cloudSyncWorker?.shutdown() ?? Promise.resolve(),
    ])
    for (const drain of drains) {
      if (drain.status === 'rejected') {
        console.error('[lifecycle] worker shutdown failed', drain.reason)
      }
    }
    try {
      finalizeApplicationResources()
    } catch (error) {
      console.error('[lifecycle] resource shutdown failed', error)
    } finally {
      shutdownComplete = true
    }
  })()
  try {
    await shutdownPromise
  } finally {
    shutdownPromise = null
  }
}

function finalizeApplicationResources(): void {
  if (!database) return
  sourceSyncWorker?.stop()
  cloudSyncWorker?.stop()
  cloudAuthService?.dispose()
  const interruptedJobs = database
    ? database.database.transaction(() => {
        const jobs = jobQueueService?.interruptForShutdown() ?? 0
        syncRunRepository?.interruptAllRunning()
        return jobs
      })()
    : 0
  if (interruptedJobs > 0) console.info(`[phase-one] interrupted-jobs-on-shutdown ${interruptedJobs}`)
  database.close()
  database = null
}

function logPhaseZero(event: string, detail: unknown): void {
  console.info(`[phase-zero] ${event} ${JSON.stringify(detail)}`)
}

async function runLifecycleSmoke(window: BrowserWindow): Promise<void> {
  const ticksBeforeClose = backgroundTicks
  window.close()
  await delay(2_500)
  const hidden = !window.isVisible()
  const backgroundContinued = backgroundTicks > ticksBeforeClose
  window.show()
  await delay(500)
  const restored = window.isVisible()
  const passed = hidden && backgroundContinued && restored
  logPhaseZero('lifecycle-smoke-completed', {
    passed,
    hidden,
    restored,
    ticksBeforeClose,
    ticksAfterRestore: backgroundTicks,
  })
  if (!passed) process.exitCode = 1
  app.quit()
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function currentAppBundlePath(): string {
  return resolve(process.execPath, '..', '..', '..')
}

async function writeUpdateHealthMarker(appBundlePath: string): Promise<void> {
  const healthPath = updateHealthPathFromArgs(process.argv, appBundlePath)
  if (!healthPath) return
  try {
    await writeFile(healthPath, 'ready\n', { mode: 0o600 })
  } catch (error) {
    console.error('[updater] failed to write post-update health marker', error)
  }
}

function registerProtocolClient(): void {
  if (process.defaultApp && process.argv[1]) {
    app.setAsDefaultProtocolClient('alpha-k', process.execPath, [resolve(process.argv[1])])
    return
  }
  app.setAsDefaultProtocolClient('alpha-k')
}

async function handleAuthDeepLink(url: string): Promise<void> {
  if (!url.startsWith('alpha-k://')) return
  if (!cloudAuthService) {
    pendingAuthDeepLink = url
    return
  }
  try {
    const handled = await cloudAuthService.handleAuthCallback(url)
    if (handled) focusMainWindow()
  } catch (error) {
    console.error('[cloud-auth] callback failed', error instanceof Error ? error.message : String(error))
    focusMainWindow()
  }
}

function focusMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}
