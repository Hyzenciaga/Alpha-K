import type { AlphaKApi, PhaseZeroStatus, ProviderProbe } from '@shared/contracts'
import type { CloudStatus } from '@shared/domain/cloud-sync'
import type { CreateLearningCaptureInput, LearningCapture, LearningCaptureListFilter } from '@shared/domain/capture'
import type { EnqueueJobInput, Job, JobListFilter } from '@shared/domain/job'
import type { VaultConnection } from '@shared/domain/vault'
import type { SearchIndexRebuildReport } from '@shared/domain/vault-index'
import type { CloudApi } from '@shared/ipc/cloud-contract'
import type { CaptureApi } from '@shared/ipc/capture-contract'
import type { AppEvent, PhaseOneApi } from '@shared/ipc/phase-one-contract'
import type { PhaseTwoApi } from '@shared/ipc/phase-two-contract'
import type { AppUpdateStatus, UpdateApi } from '@shared/ipc/update-contract'
import type { IpcErrorCode } from '@shared/ipc/common-contract'
import {
  FIXTURE_VAULT_ID,
  InMemoryPhaseTwoClient,
  disabledRssSource,
  failedInboxItem,
  failedSyncRun,
  fetchedInboxItem,
  rssSource,
  succeededSyncRun,
} from './fixtures/phase-two-client'

const PREVIEW_NOW = '2026-07-28T08:30:00.000Z'
const PREVIEW_VAULT: VaultConnection = {
  state: 'ready',
  vault: {
    id: FIXTURE_VAULT_ID,
    path: '/Users/you/Documents/Alpha-K Vault',
    manifestSchemaVersion: 1,
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: PREVIEW_NOW,
    lastOpenedAt: PREVIEW_NOW,
  },
  error: null,
}

const PREVIEW_STATUS: PhaseZeroStatus = {
  startedAt: PREVIEW_NOW,
  backgroundTicks: 0,
  windowVisible: true,
  lastLifecycleEvent: 'started',
  database: {
    path: 'Browser preview — in memory only',
    migrationVersion: 6,
    fts5: true,
    trigramChinese: true,
  },
  providers: [
    provider('codex', 'available', 'Codex CLI 已就绪（浏览器预览数据）', '0.93.0'),
    provider('qoder', 'available', 'Qoder CLI 已就绪（浏览器预览数据）', '1.0.15'),
  ],
}

const INITIAL_CLOUD_STATUS: CloudStatus = {
  projectRef: 'browser-preview',
  region: 'Singapore',
  configuration: 'ready',
  auth: 'signed_in',
  user: {
    id: '77777777-7777-4777-8777-777777777777',
    provider: 'github',
    email: 'you@example.com',
    displayName: '本地预览',
    avatarUrl: null,
  },
  sync: 'idle',
  pendingChanges: 0,
  lastSyncedAt: PREVIEW_NOW,
  lastError: null,
}

const INITIAL_UPDATE_STATUS: AppUpdateStatus = {
  supported: false,
  currentVersion: '0.0.2-preview',
  phase: 'idle',
  availableVersion: null,
  releaseNotes: null,
  percent: null,
  transferred: null,
  total: null,
  error: null,
}

/** Browser-only preload substitute. It never touches local or cloud data. */
export function installBrowserPreviewBridge(): void {
  if (window.alphaK) return

  const phaseTwo = new InMemoryPhaseTwoClient({
    sources: [rssSource, disabledRssSource],
    syncRuns: [succeededSyncRun, failedSyncRun],
    inboxItems: [fetchedInboxItem, failedInboxItem],
  })
  const appListeners = new Set<(event: AppEvent) => void>()
  const phaseZeroListeners = new Set<(status: PhaseZeroStatus) => void>()
  const updateListeners = new Set<(status: AppUpdateStatus) => void>()
  let cloudStatus = INITIAL_CLOUD_STATUS
  const updateStatus = INITIAL_UPDATE_STATUS
  let jobs: Job[] = []
  let nextJob = 1
  let nextCapture = 1
  let captures: LearningCapture[] = [
    {
      id: '99999999-9999-4999-8999-999999999991',
      kind: 'link',
      title: null,
      note: '想看看它如何把本地优先做成具体的文件契约。',
      content: 'https://www.inkandswitch.com/essay/local-first/',
      normalizedUrl: 'https://www.inkandswitch.com/essay/local-first/',
      sourceHost: 'inkandswitch.com',
      archivedAt: null,
      createdAt: PREVIEW_NOW,
      updatedAt: PREVIEW_NOW,
    },
    {
      id: '99999999-9999-4999-8999-999999999992',
      kind: 'note',
      title: '关于“待学习”的一个问题',
      note: null,
      content: 'Agent 先给出整理建议，还是等我主动触发一次？这两种节奏的界线要设计清楚。',
      normalizedUrl: null,
      sourceHost: null,
      archivedAt: null,
      createdAt: PREVIEW_NOW,
      updatedAt: PREVIEW_NOW,
    },
  ]

  function emit(event: AppEvent): void {
    appListeners.forEach((listener) => listener(event))
    phaseTwo.emit(event)
  }

  function updateJob(jobId: string, status: 'cancelled' | 'queued'): ReturnType<PhaseOneApi['cancelJob']> {
    const index = jobs.findIndex((job) => job.id === jobId)
    if (index === -1) {
      return Promise.resolve({ ok: false, error: { code: 'NOT_FOUND', message: '预览 Job 不存在。' } })
    }
    const job = {
      ...jobs[index],
      status,
      updatedAt: PREVIEW_NOW,
      finishedAt: status === 'cancelled' ? PREVIEW_NOW : null,
    }
    jobs = [job, ...jobs.filter((candidate) => candidate.id !== jobId)]
    emit({ type: 'job.updated', job })
    return Promise.resolve(success(job))
  }

  function createCapture(input: CreateLearningCaptureInput): ReturnType<CaptureApi['createLearningCapture']> {
    if (cloudStatus.auth !== 'signed_in') return Promise.resolve(failure('AUTH_REQUIRED', '请先登录后再录入。'))
    const content = input.content.trim()
    let normalizedUrl: string | null = null
    let sourceHost: string | null = null
    if (input.kind === 'link') {
      try {
        const url = new URL(content)
        if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('unsupported protocol')
        url.hash = ''
        normalizedUrl = url.toString()
        sourceHost = url.hostname.replace(/^www\./, '')
      } catch {
        return Promise.resolve(failure('CAPTURE_INVALID_URL', '请输入完整的 http 或 https 链接。'))
      }
    }
    const id = `99999999-9999-4999-8999-${String(nextCapture++).padStart(12, '0')}`
    const capture: LearningCapture = {
      id,
      kind: input.kind,
      title: input.kind === 'note' ? input.title?.trim() || null : null,
      note: input.kind === 'link' ? input.note?.trim() || null : null,
      content,
      normalizedUrl,
      sourceHost,
      archivedAt: null,
      createdAt: PREVIEW_NOW,
      updatedAt: PREVIEW_NOW,
    }
    captures = [capture, ...captures]
    emit({ type: 'capture.changed', captureId: id, kind: capture.kind })
    return Promise.resolve(success(capture))
  }

  function listCaptures(filter: LearningCaptureListFilter): ReturnType<CaptureApi['listLearningCaptures']> {
    const offset = filter.offset ?? 0
    const limit = filter.limit ?? 50
    return Promise.resolve(success(captures
      .filter((capture) => capture.kind === filter.kind && (filter.includeArchived || !capture.archivedAt))
      .slice(offset, offset + limit)))
  }

  function archiveCapture(captureId: string): ReturnType<CaptureApi['archiveLearningCapture']> {
    const capture = captures.find((item) => item.id === captureId && !item.archivedAt)
    if (!capture) return Promise.resolve(failure('CAPTURE_NOT_FOUND', '待学习内容不存在。'))
    const archived = { ...capture, archivedAt: PREVIEW_NOW, updatedAt: PREVIEW_NOW }
    captures = captures.map((item) => item.id === captureId ? archived : item)
    emit({ type: 'capture.changed', captureId, kind: archived.kind })
    return Promise.resolve(success(archived))
  }

  const api: AlphaKApi & PhaseOneApi & PhaseTwoApi & CloudApi & CaptureApi & UpdateApi = {
    getPhaseZeroStatus: async () => PREVIEW_STATUS,
    refreshProviders: async () => {
      phaseZeroListeners.forEach((listener) => listener(PREVIEW_STATUS))
      return PREVIEW_STATUS.providers
    },
    onPhaseZeroStatus: (listener) => subscribe(phaseZeroListeners, listener),

    getVault: async () => success(PREVIEW_VAULT),
    selectVault: async () => success(PREVIEW_VAULT),
    rebuildVaultIndex: async () => success<SearchIndexRebuildReport>({ indexed: 42, skipped: 0, issues: [] }),
    createJob: async (input) => {
      const job = makeJob(input, nextJob++)
      jobs = [job, ...jobs]
      emit({ type: 'job.updated', job })
      return success(job)
    },
    listJobs: async (filter = {}) => success(filterJobs(jobs, filter)),
    cancelJob: (jobId) => updateJob(jobId, 'cancelled'),
    retryJob: (jobId) => updateJob(jobId, 'queued'),

    ...phaseTwo,
    onAppEvent: (listener) => subscribe(appListeners, listener),

    getCloudStatus: async () => success(cloudStatus),
    signInWithGitHub: async () => {
      cloudStatus = { ...cloudStatus, auth: 'signed_in', sync: 'idle' }
      emit({ type: 'cloud.status.changed', status: cloudStatus })
      return success(cloudStatus)
    },
    signOutCloud: async () => {
      cloudStatus = { ...cloudStatus, auth: 'signed_out', user: null, sync: 'disabled', lastSyncedAt: null }
      emit({ type: 'cloud.status.changed', status: cloudStatus })
      return success(cloudStatus)
    },
    createLearningCapture: async (input) => createCapture(input),
    listLearningCaptures: async (filter) => listCaptures(filter),
    archiveLearningCapture: async (captureId) => archiveCapture(captureId),

    getUpdateStatus: async () => updateStatus,
    checkForUpdate: async () => updateStatus,
    downloadUpdate: async () => updateStatus,
    restartAndInstallUpdate: async () => updateStatus,
    onUpdateStatus: (listener) => subscribe(updateListeners, listener),
  }

  window.alphaK = api
}

function provider(
  providerName: ProviderProbe['provider'],
  status: ProviderProbe['status'],
  detail: string,
  version: string,
): ProviderProbe {
  return {
    provider: providerName,
    status,
    selectedExecutable: `/mock/${providerName}`,
    version,
    detail,
    attempts: [{ executable: `/mock/${providerName}`, source: 'path', status, version, detail }],
  }
}

function subscribe<T>(listeners: Set<(value: T) => void>, listener: (value: T) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function success<T>(data: T): { ok: true; data: T } {
  return { ok: true, data }
}

function failure(code: IpcErrorCode, message: string): { ok: false; error: { code: IpcErrorCode; message: string } } {
  return { ok: false, error: { code, message } }
}

function makeJob(input: EnqueueJobInput, sequence: number): Job {
  const id = `88888888-8888-4888-8888-${String(sequence).padStart(12, '0')}`
  return {
    id,
    vaultId: input.vaultId ?? FIXTURE_VAULT_ID,
    type: input.type,
    status: 'queued',
    priority: input.priority ?? 'normal',
    idempotencyKey: input.idempotencyKey ?? null,
    payload: input.payload ?? {},
    attempt: 0,
    maxAttempts: input.maxAttempts ?? 3,
    scheduledAt: input.scheduledAt ?? null,
    runAfter: input.runAfter ?? PREVIEW_NOW,
    workerId: null,
    leaseExpiresAt: null,
    heartbeatAt: null,
    startedAt: null,
    finishedAt: null,
    lastError: null,
    createdAt: PREVIEW_NOW,
    updatedAt: PREVIEW_NOW,
  }
}

function filterJobs(jobs: Job[], filter: JobListFilter): Job[] {
  const offset = filter.offset ?? 0
  const limit = filter.limit ?? 50
  return jobs
    .filter((job) =>
      (filter.vaultId === undefined || job.vaultId === filter.vaultId) &&
      (filter.statuses === undefined || filter.statuses.includes(job.status)) &&
      (filter.types === undefined || filter.types.includes(job.type)),
    )
    .slice(offset, offset + limit)
}
