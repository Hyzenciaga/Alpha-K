import type { InboxItemListFilter, InboxItemSummary } from '../domain/inbox.js'
import type { Job } from '../domain/job.js'
import type { SourcePreview } from '../domain/source-ingestion.js'
import type {
  CreateSourceInput,
  Source,
  SourceListFilter,
  UpdateSourceInput,
} from '../domain/source.js'
import type { SyncRun, SyncRunListFilter } from '../domain/sync-run.js'
import type { IpcResult } from './common-contract.js'

export type DeleteSourceResult = { sourceId: string }
export type SyncSourceResult = { job: Job; syncRun: SyncRun }

export const PHASE_TWO_IPC_CHANNELS = {
  sourcesList: 'sources:list',
  sourcesCreate: 'sources:create',
  sourcesUpdate: 'sources:update',
  sourcesDelete: 'sources:delete',
  sourcesPreview: 'sources:preview',
  sourcesSync: 'sources:sync',
  syncRunsList: 'source-sync-runs:list',
  inboxList: 'inbox:list',
} as const

export type PhaseTwoApi = {
  listSources: (filter: SourceListFilter) => Promise<IpcResult<Source[]>>
  createSource: (input: CreateSourceInput) => Promise<IpcResult<Source>>
  updateSource: (sourceId: string, input: UpdateSourceInput) => Promise<IpcResult<Source>>
  deleteSource: (sourceId: string) => Promise<IpcResult<DeleteSourceResult>>
  previewSource: (input: CreateSourceInput) => Promise<IpcResult<SourcePreview>>
  syncSource: (sourceId: string) => Promise<IpcResult<SyncSourceResult>>
  listSyncRuns: (filter: SyncRunListFilter) => Promise<IpcResult<SyncRun[]>>
  listInboxItems: (filter: InboxItemListFilter) => Promise<IpcResult<InboxItemSummary[]>>
}
