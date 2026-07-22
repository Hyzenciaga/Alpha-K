import { z } from 'zod'
import { IdSchema } from '../domain/common.js'
import { InboxItemListFilterSchema, InboxItemSummarySchema } from '../domain/inbox.js'
import { JobSchema } from '../domain/job.js'
import { SourcePreviewSchema } from '../domain/source-ingestion.js'
import {
  CreateSourceInputSchema,
  SourceListFilterSchema,
  SourceSchema,
  UpdateSourceInputSchema,
} from '../domain/source.js'
import { SyncRunListFilterSchema, SyncRunSchema } from '../domain/sync-run.js'

export { PHASE_TWO_IPC_CHANNELS } from './phase-two-contract.js'
export type {
  DeleteSourceResult,
  PhaseTwoApi,
  SyncSourceResult,
} from './phase-two-contract.js'

export const SourceIdRequestSchema = z.object({ sourceId: IdSchema }).strict()
export const UpdateSourceRequestSchema = z
  .object({ sourceId: IdSchema, input: UpdateSourceInputSchema })
  .strict()
export const DeleteSourceResultSchema = z.object({ sourceId: IdSchema }).strict()
export const SyncSourceResultSchema = z.object({ job: JobSchema, syncRun: SyncRunSchema }).strict()

export const PhaseTwoIpcRequestSchemas = {
  sourcesList: SourceListFilterSchema,
  sourcesCreate: CreateSourceInputSchema,
  sourcesUpdate: UpdateSourceRequestSchema,
  sourcesDelete: SourceIdRequestSchema,
  sourcesPreview: CreateSourceInputSchema,
  sourcesSync: SourceIdRequestSchema,
  syncRunsList: SyncRunListFilterSchema,
  inboxList: InboxItemListFilterSchema,
} as const

export const PhaseTwoIpcResponseSchemas = {
  sourcesList: z.array(SourceSchema),
  sourcesCreate: SourceSchema,
  sourcesUpdate: SourceSchema,
  sourcesDelete: DeleteSourceResultSchema,
  sourcesPreview: SourcePreviewSchema,
  sourcesSync: SyncSourceResultSchema,
  syncRunsList: z.array(SyncRunSchema),
  inboxList: z.array(InboxItemSummarySchema),
} as const
