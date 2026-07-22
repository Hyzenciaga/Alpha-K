import type { InboxItemListFilter, InboxItemSummary } from '../../../shared/domain/inbox.js'
import type { Job } from '../../../shared/domain/job.js'
import type { SourcePreview } from '../../../shared/domain/source-ingestion.js'
import {
  CreateSourceInputSchema,
  SourceSchema,
  UpdateSourceInputSchema,
  type Source,
} from '../../../shared/domain/source.js'
import type { SyncRun } from '../../../shared/domain/sync-run.js'
import type { AppEvent, IpcError } from '../../../shared/ipc/phase-one-contract.js'
import type { PhaseTwoApi, SyncSourceResult } from '../../../shared/ipc/phase-two-contract.js'
import type { PhaseTwoRendererClient } from '../phase-two-client.js'

export const FIXTURE_VAULT_ID = '11111111-1111-4111-8111-111111111111'
export const FIXTURE_SOURCE_ID = '22222222-2222-4222-8222-222222222222'
export const FIXTURE_DISABLED_SOURCE_ID = '23222222-2222-4222-8222-222222222222'
export const FIXTURE_JOB_ID = '33333333-3333-4333-8333-333333333333'
export const FIXTURE_RUN_ID = '44444444-4444-4444-8444-444444444444'
export const FIXTURE_FAILED_RUN_ID = '45444444-4444-4444-8444-444444444444'
export const FIXTURE_ITEM_ID = '55555555-5555-4555-8555-555555555555'
export const FIXTURE_FAILED_ITEM_ID = '56555555-5555-4555-8555-555555555555'
const NOW = '2026-07-22T03:00:00.000Z'

export const rssSource = {
  id: FIXTURE_SOURCE_ID,
  vaultId: FIXTURE_VAULT_ID,
  type: 'rss',
  name: 'Example Engineering',
  enabled: true,
  schedule: { kind: 'interval', minutes: 60 },
  defaultLabels: ['Engineering'],
  workflowId: null,
  config: {
    feedUrl: 'https://example.com/feed.xml',
    includeKeywords: ['desktop'],
    excludeKeywords: [],
    historyWindowDays: 30,
    maxItemsPerSync: 100,
  },
  lastSyncAt: '2026-07-22T02:00:00.000Z',
  nextSyncAt: '2026-07-22T04:00:00.000Z',
  lastError: null,
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: NOW,
} satisfies Source

export const disabledRssSource = {
  ...rssSource,
  id: FIXTURE_DISABLED_SOURCE_ID,
  name: 'Paused Feed',
  enabled: false,
  config: {
    ...rssSource.config,
    feedUrl: 'https://paused.example.com/feed.xml',
    includeKeywords: [],
  },
  nextSyncAt: null,
} satisfies Source

export const succeededSyncRun = {
  id: FIXTURE_RUN_ID,
  vaultId: FIXTURE_VAULT_ID,
  sourceId: FIXTURE_SOURCE_ID,
  jobId: FIXTURE_JOB_ID,
  trigger: 'manual',
  status: 'succeeded',
  discoveredCount: 3,
  createdCount: 2,
  updatedCount: 0,
  skippedCount: 1,
  error: null,
  startedAt: '2026-07-22T02:00:00.000Z',
  finishedAt: '2026-07-22T02:00:04.000Z',
  createdAt: '2026-07-22T02:00:00.000Z',
  updatedAt: '2026-07-22T02:00:04.000Z',
} satisfies SyncRun

export const failedSyncRun = {
  ...succeededSyncRun,
  id: FIXTURE_FAILED_RUN_ID,
  status: 'failed',
  discoveredCount: 0,
  createdCount: 0,
  skippedCount: 0,
  error: 'Feed returned HTTP 503.',
  createdAt: NOW,
  updatedAt: NOW,
  finishedAt: NOW,
} satisfies SyncRun

export const fetchedInboxItem = {
  id: FIXTURE_ITEM_ID,
  vaultId: FIXTURE_VAULT_ID,
  sourceId: FIXTURE_SOURCE_ID,
  sourceName: rssSource.name,
  sourceType: 'rss',
  externalId: 'post-1',
  canonicalUrl: 'https://example.com/post-1',
  title: 'Deterministic desktop ingestion',
  authors: ['Ada Example'],
  publishedAt: '2026-07-22T01:30:00.000Z',
  fetchedAt: '2026-07-22T02:00:03.000Z',
  status: 'fetched',
  primaryArtifactId: '66666666-6666-4666-8666-666666666666',
  excerpt: 'A deterministic excerpt produced by the ingestion pipeline.',
  labels: ['Engineering'],
} satisfies InboxItemSummary

export const failedInboxItem = {
  ...fetchedInboxItem,
  id: FIXTURE_FAILED_ITEM_ID,
  externalId: 'post-2',
  canonicalUrl: 'https://example.com/post-2',
  title: 'An item that could not be fetched',
  status: 'failed',
  primaryArtifactId: null,
  excerpt: null,
} satisfies InboxItemSummary

export const sourcePreview = {
  sourceType: 'rss',
  title: 'Example Engineering',
  description: 'Independent preview; no Source has been persisted.',
  items: [
    {
      externalId: 'post-preview',
      canonicalUrl: 'https://example.com/preview',
      title: 'Preview item',
      authors: ['Preview Author'],
      publishedAt: NOW,
      contentHash: null,
      excerpt: 'Preview excerpt.',
    },
  ],
  warnings: [],
} satisfies SourcePreview

export const queuedSyncResult = {
  job: {
    id: FIXTURE_JOB_ID,
    vaultId: FIXTURE_VAULT_ID,
    type: 'source.sync',
    status: 'queued',
    priority: 'interactive',
    idempotencyKey: null,
    payload: {
      sourceId: FIXTURE_SOURCE_ID,
      syncRunId: FIXTURE_RUN_ID,
      trigger: 'manual',
    },
    attempt: 0,
    maxAttempts: 3,
    scheduledAt: null,
    runAfter: NOW,
    workerId: null,
    leaseExpiresAt: null,
    heartbeatAt: null,
    startedAt: null,
    finishedAt: null,
    lastError: null,
    createdAt: NOW,
    updatedAt: NOW,
  } satisfies Job,
  syncRun: {
    ...succeededSyncRun,
    status: 'queued',
    discoveredCount: 0,
    createdCount: 0,
    skippedCount: 0,
    startedAt: null,
    finishedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  } satisfies SyncRun,
} satisfies SyncSourceResult

type ClientMethod = keyof PhaseTwoApi

export class InMemoryPhaseTwoClient implements PhaseTwoRendererClient {
  sources: Source[]
  syncRuns: SyncRun[]
  inboxItems: InboxItemSummary[]
  preview: SourcePreview
  syncResult: SyncSourceResult
  failures = new Map<ClientMethod, IpcError>()
  calls = {
    listSources: 0,
    createSource: 0,
    updateSource: 0,
    deleteSource: 0,
    previewSource: 0,
    syncSource: 0,
    listSyncRuns: 0,
    listInboxItems: [] as InboxItemListFilter[],
  }

  private listeners = new Set<(event: AppEvent) => void>()
  private nextId = 10

  constructor(seed: {
    sources?: Source[]
    syncRuns?: SyncRun[]
    inboxItems?: InboxItemSummary[]
    preview?: SourcePreview
    syncResult?: SyncSourceResult
  } = {}) {
    this.sources = [...(seed.sources ?? [])]
    this.syncRuns = [...(seed.syncRuns ?? [])]
    this.inboxItems = [...(seed.inboxItems ?? [])]
    this.preview = seed.preview ?? sourcePreview
    this.syncResult = seed.syncResult ?? queuedSyncResult
  }

  listSources: PhaseTwoApi['listSources'] = async (filter) => {
    this.calls.listSources += 1
    const failed = this.failed('listSources')
    if (failed) return failed
    return {
      ok: true,
      data: this.sources.filter(
        (source) =>
          source.vaultId === filter.vaultId &&
          (filter.types === undefined || filter.types.includes(source.type)) &&
          (filter.enabled === undefined || filter.enabled === source.enabled),
      ),
    }
  }

  createSource: PhaseTwoApi['createSource'] = async (input) => {
    this.calls.createSource += 1
    const failed = this.failed('createSource')
    if (failed) return failed
    const parsed = CreateSourceInputSchema.parse(input)
    const idSuffix = String(this.nextId++).padStart(12, '0')
    const source = SourceSchema.parse({
      ...parsed,
      id: `70000000-0000-4000-8000-${idSuffix}`,
      lastSyncAt: null,
      nextSyncAt: null,
      lastError: null,
      createdAt: NOW,
      updatedAt: NOW,
    })
    this.sources.push(source)
    return { ok: true, data: source }
  }

  updateSource: PhaseTwoApi['updateSource'] = async (sourceId, input) => {
    this.calls.updateSource += 1
    const failed = this.failed('updateSource')
    if (failed) return failed
    const index = this.sources.findIndex((source) => source.id === sourceId)
    if (index === -1) return ipcFailure('SOURCE_NOT_FOUND', 'Source not found.')
    const parsed = UpdateSourceInputSchema.parse(input)
    const source = SourceSchema.parse({ ...this.sources[index], ...parsed, updatedAt: NOW })
    this.sources[index] = source
    return { ok: true, data: source }
  }

  deleteSource: PhaseTwoApi['deleteSource'] = async (sourceId) => {
    this.calls.deleteSource += 1
    const failed = this.failed('deleteSource')
    if (failed) return failed
    const exists = this.sources.some((source) => source.id === sourceId)
    if (!exists) return ipcFailure('SOURCE_NOT_FOUND', 'Source not found.')
    this.sources = this.sources.filter((source) => source.id !== sourceId)
    return { ok: true, data: { sourceId } }
  }

  previewSource: PhaseTwoApi['previewSource'] = async () => {
    this.calls.previewSource += 1
    const failed = this.failed('previewSource')
    if (failed) return failed
    return { ok: true, data: this.preview }
  }

  syncSource: PhaseTwoApi['syncSource'] = async () => {
    this.calls.syncSource += 1
    const failed = this.failed('syncSource')
    if (failed) return failed
    this.syncRuns = [this.syncResult.syncRun, ...this.syncRuns]
    return { ok: true, data: this.syncResult }
  }

  listSyncRuns: PhaseTwoApi['listSyncRuns'] = async (filter) => {
    this.calls.listSyncRuns += 1
    const failed = this.failed('listSyncRuns')
    if (failed) return failed
    const filtered = this.syncRuns.filter(
      (run) =>
        run.vaultId === filter.vaultId &&
        (filter.sourceId === undefined || run.sourceId === filter.sourceId) &&
        (filter.statuses === undefined || filter.statuses.includes(run.status)),
    )
    const offset = filter.offset ?? 0
    const limit = filter.limit ?? 50
    return { ok: true, data: filtered.slice(offset, offset + limit) }
  }

  listInboxItems: PhaseTwoApi['listInboxItems'] = async (filter) => {
    this.calls.listInboxItems.push(filter)
    const failed = this.failed('listInboxItems')
    if (failed) return failed
    const query = filter.search?.toLocaleLowerCase()
    const filtered = this.inboxItems.filter(
      (item) =>
        item.vaultId === filter.vaultId &&
        (filter.sourceIds === undefined || filter.sourceIds.includes(item.sourceId)) &&
        (filter.statuses === undefined || filter.statuses.includes(item.status)) &&
        (query === undefined ||
          `${item.title} ${item.excerpt ?? ''} ${item.sourceName}`.toLocaleLowerCase().includes(query)),
    )
    const offset = filter.offset ?? 0
    const limit = filter.limit ?? 50
    return { ok: true, data: filtered.slice(offset, offset + limit) }
  }

  onAppEvent(listener: (event: AppEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit(event: AppEvent): void {
    this.listeners.forEach((listener) => listener(event))
  }

  fail(method: ClientMethod, error: IpcError): void {
    this.failures.set(method, error)
  }

  recover(method: ClientMethod): void {
    this.failures.delete(method)
  }

  private failed(method: ClientMethod): { ok: false; error: IpcError } | null {
    const error = this.failures.get(method)
    return error ? { ok: false, error } : null
  }
}

function ipcFailure(code: IpcError['code'], message: string): { ok: false; error: IpcError } {
  return { ok: false, error: { code, message } }
}
