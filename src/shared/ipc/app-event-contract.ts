import type { Job } from '../domain/job.js'
import type { Source } from '../domain/source.js'
import type { SyncRun } from '../domain/sync-run.js'

export type AppEvent =
  | { type: 'job.updated'; job: Job }
  | { type: 'source.updated'; source: Source }
  | { type: 'source.deleted'; sourceId: string }
  | { type: 'source.sync.updated'; syncRun: SyncRun }
  | { type: 'inbox.changed'; itemIds: string[] }
