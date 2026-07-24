import type { InboxItemListFilter, InboxItemSummary } from '../../shared/domain/inbox.js'
import type { SourcePreview } from '../../shared/domain/source-ingestion.js'
import type { CreateSourceInput, Source, UpdateSourceInput } from '../../shared/domain/source.js'
import type { SyncRun } from '../../shared/domain/sync-run.js'
import type { AppEvent, IpcError } from '../../shared/ipc/phase-one-contract.js'
import type { SyncSourceResult } from '../../shared/ipc/phase-two-contract.js'
import type { PhaseTwoRendererClient } from './phase-two-client.js'

export type ViewStatus = 'idle' | 'loading' | 'empty' | 'ready' | 'error'

export type SourcesViewState = {
  status: ViewStatus
  sources: Source[]
  syncRuns: SyncRun[]
  error: string | null
  actionError: string | null
  lastSyncRequest: SyncSourceResult | null
}

export type InboxViewState = {
  status: ViewStatus
  items: InboxItemSummary[]
  sources: Source[]
  error: string | null
  filter: InboxItemListFilter
}

type Listener = () => void

export class RendererIpcError extends Error {
  readonly code: IpcError['code']

  constructor(error: IpcError) {
    super(error.message)
    this.name = 'RendererIpcError'
    this.code = error.code
  }
}

export class SourcesViewModel {
  private listeners = new Set<Listener>()
  private stopEvents: (() => void) | null = null
  private requestId = 0

  state: SourcesViewState = {
    status: 'idle',
    sources: [],
    syncRuns: [],
    error: null,
    actionError: null,
    lastSyncRequest: null,
  }

  constructor(
    private readonly client: PhaseTwoRendererClient,
    private readonly vaultId: string,
  ) {}

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    if (this.stopEvents === null) {
      this.stopEvents = this.client.onAppEvent((event) => this.handleEvent(event))
    }
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) {
        this.stopEvents?.()
        this.stopEvents = null
      }
    }
  }

  async refresh(): Promise<void> {
    const requestId = ++this.requestId
    this.patch({ status: 'loading', error: null })
    try {
      const [sourcesResult, runsResult] = await Promise.all([
        this.client.listSources({ vaultId: this.vaultId }),
        this.client.listSyncRuns({ vaultId: this.vaultId, limit: 200, offset: 0 }),
      ])
      if (requestId !== this.requestId) return
      if (!sourcesResult.ok) throw new RendererIpcError(sourcesResult.error)
      if (!runsResult.ok) throw new RendererIpcError(runsResult.error)
      this.patch({
        status: sourcesResult.data.length === 0 ? 'empty' : 'ready',
        sources: sourcesResult.data,
        syncRuns: runsResult.data,
        error: null,
      })
    } catch (error) {
      if (requestId !== this.requestId) return
      this.patch({
        status: 'error',
        sources: [],
        syncRuns: [],
        error: errorMessage(error),
      })
    }
  }

  async preview(input: CreateSourceInput): Promise<SourcePreview> {
    return this.runAction(() => this.client.previewSource(input), false)
  }

  async create(input: CreateSourceInput): Promise<Source> {
    return this.runAction(() => this.client.createSource(input), true)
  }

  async update(sourceId: string, input: UpdateSourceInput): Promise<Source> {
    return this.runAction(() => this.client.updateSource(sourceId, input), true)
  }

  async delete(sourceId: string): Promise<string> {
    const result = await this.runAction(() => this.client.deleteSource(sourceId), true)
    return result.sourceId
  }

  async sync(sourceId: string): Promise<SyncSourceResult> {
    const result = await this.runAction(() => this.client.syncSource(sourceId), false)
    this.patch({ lastSyncRequest: result, actionError: null })
    await this.refresh()
    return result
  }

  clearActionError(): void {
    this.patch({ actionError: null })
  }

  private async runAction<T>(
    operation: () => Promise<{ ok: true; data: T } | { ok: false; error: IpcError }>,
    refreshAfter: boolean,
  ): Promise<T> {
    this.patch({ actionError: null })
    try {
      const result = await operation()
      if (!result.ok) throw new RendererIpcError(result.error)
      if (refreshAfter) await this.refresh()
      return result.data
    } catch (error) {
      this.patch({ actionError: errorMessage(error) })
      throw error
    }
  }

  private handleEvent(event: AppEvent): void {
    if (
      event.type === 'source.updated' ||
      event.type === 'source.deleted' ||
      event.type === 'source.sync.updated'
    ) {
      void this.refresh()
    }
  }

  private patch(patch: Partial<SourcesViewState>): void {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((listener) => listener())
  }
}

export class InboxViewModel {
  private listeners = new Set<Listener>()
  private stopEvents: (() => void) | null = null
  private requestId = 0

  state: InboxViewState

  constructor(
    private readonly client: PhaseTwoRendererClient,
    private readonly vaultId: string,
  ) {
    this.state = {
      status: 'idle',
      items: [],
      sources: [],
      error: null,
      filter: buildInboxFilter(vaultId),
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    if (this.stopEvents === null) {
      this.stopEvents = this.client.onAppEvent((event) => this.handleEvent(event))
    }
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) {
        this.stopEvents?.()
        this.stopEvents = null
      }
    }
  }

  async refresh(filter: InboxItemListFilter = this.state.filter): Promise<void> {
    const requestId = ++this.requestId
    this.patch({ status: 'loading', error: null, filter })
    try {
      const [itemsResult, sourcesResult] = await Promise.all([
        this.client.listInboxItems(filter),
        this.client.listSources({ vaultId: this.vaultId }),
      ])
      if (requestId !== this.requestId) return
      if (!itemsResult.ok) throw new RendererIpcError(itemsResult.error)
      if (!sourcesResult.ok) throw new RendererIpcError(sourcesResult.error)
      this.patch({
        status: itemsResult.data.length === 0 ? 'empty' : 'ready',
        items: itemsResult.data,
        sources: sourcesResult.data,
        error: null,
      })
    } catch (error) {
      if (requestId !== this.requestId) return
      this.patch({ status: 'error', items: [], error: errorMessage(error) })
    }
  }

  private handleEvent(event: AppEvent): void {
    if (
      event.type === 'inbox.changed' ||
      event.type === 'source.updated' ||
      event.type === 'source.deleted'
    ) {
      void this.refresh()
    }
  }

  private patch(patch: Partial<InboxViewState>): void {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((listener) => listener())
  }
}

export function buildInboxFilter(
  vaultId: string,
  selection: { sourceId?: string; status?: InboxItemSummary['status']; search?: string } = {},
): InboxItemListFilter {
  const search = selection.search?.trim()
  return {
    vaultId,
    ...(selection.sourceId ? { sourceIds: [selection.sourceId] } : {}),
    ...(selection.status ? { statuses: [selection.status] } : {}),
    ...(search ? { search } : {}),
    limit: 100,
    offset: 0,
  }
}

export function latestSyncRunsBySource(syncRuns: SyncRun[]): Map<string, SyncRun> {
  const latest = new Map<string, SyncRun>()
  for (const run of syncRuns) {
    const current = latest.get(run.sourceId)
    if (!current || Date.parse(run.createdAt) > Date.parse(current.createdAt)) {
      latest.set(run.sourceId, run)
    }
  }
  return latest
}

export const INBOX_PHASE_FOUR_ACTIONS = [
  { id: 'accept', label: '入库 · 尚未接入', disabled: true },
  { id: 'dislike', label: '不喜欢 · 尚未接入', disabled: true },
] as const

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}
