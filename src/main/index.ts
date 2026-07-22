import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, powerMonitor } from 'electron'
import type { PhaseZeroStatus, ProviderProbe } from '../shared/contracts.js'
import { IPC_CHANNELS } from '../shared/contracts.js'
import { PHASE_ONE_IPC_CHANNELS, type AppEvent } from '../shared/ipc/phase-one.js'
import { JobQueueService } from './application/job-queue-service.js'
import { VaultService } from './application/vault-service.js'
import { registerPhaseOneIpcHandlers } from './ipc/phase-one-handlers.js'
import { shouldHideWindowOnClose } from './lifecycle/window-lifecycle.js'
import { openAlphaKDatabase, type AlphaKDatabase } from './persistence/database.js'
import { JobRepository } from './persistence/repositories/job-repository.js'
import { KnowledgeRepository } from './persistence/repositories/knowledge-repository.js'
import { VaultRepository } from './persistence/repositories/vault-repository.js'
import { probeCodex } from './providers/codex-probe.js'
import { probeQoder } from './providers/qoder-probe.js'

let mainWindow: BrowserWindow | null = null
let isQuitting = false
let database: AlphaKDatabase | null = null
let jobQueueService: JobQueueService | null = null
let providers: ProviderProbe[] = []
let backgroundTicks = 0
let lastLifecycleEvent: PhaseZeroStatus['lastLifecycleEvent'] = 'started'
const startedAt = new Date().toISOString()

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 820,
    minHeight: 600,
    show: false,
    title: 'Alpha-K · Phase 0',
    backgroundColor: '#f5f1e8',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
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

function registerIpc(vaultService: VaultService, jobs: JobQueueService): void {
  ipcMain.handle(IPC_CHANNELS.getPhaseZeroStatus, () => currentStatus())
  ipcMain.handle(IPC_CHANNELS.refreshProviders, () => refreshProviders())
  registerPhaseOneIpcHandlers({
    ipcMain,
    vaultService,
    jobQueueService: jobs,
    selectVaultDirectory,
  })
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

app.on('before-quit', () => {
  isQuitting = true
  logPhaseZero('before-quit', { backgroundTicks })
})

app.on('activate', () => {
  if (!mainWindow || mainWindow.isDestroyed()) mainWindow = createWindow()
  mainWindow.show()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

void app.whenReady().then(async () => {
  database = openAlphaKDatabase(join(app.getPath('userData'), 'app.sqlite'))
  logPhaseZero('database-ready', database.health)
  const vaultRepository = new VaultRepository(database.database)
  const knowledgeRepository = new KnowledgeRepository(database.database)
  const vaultService = new VaultService(vaultRepository, knowledgeRepository)
  jobQueueService = new JobQueueService(new JobRepository(database.database), (job) => {
    broadcastAppEvent({ type: 'job.updated', job })
  })
  const recovery = jobQueueService.recoverOnStartup()
  const vaultConnection = await vaultService.getConnection()
  console.info(`[phase-one] startup ${JSON.stringify({ recovery, vault: vaultConnection.state })}`)
  registerIpc(vaultService, jobQueueService)
  mainWindow = createWindow()

  powerMonitor.on('suspend', () => {
    lastLifecycleEvent = 'suspend'
    broadcastStatus()
  })
  powerMonitor.on('resume', () => {
    lastLifecycleEvent = 'resume'
    void refreshProviders()
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
  const interruptedJobs = jobQueueService?.interruptForShutdown() ?? 0
  if (interruptedJobs > 0) console.info(`[phase-one] interrupted-jobs-on-shutdown ${interruptedJobs}`)
  database?.close()
})

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
