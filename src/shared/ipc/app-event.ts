import { z } from 'zod'
import { IdSchema } from '../domain/common.js'
import { JobSchema } from '../domain/job.js'
import { SourceSchema } from '../domain/source.js'
import { SyncRunSchema } from '../domain/sync-run.js'

export const AppEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('job.updated'), job: JobSchema }).strict(),
  z.object({ type: z.literal('source.updated'), source: SourceSchema }).strict(),
  z.object({ type: z.literal('source.deleted'), sourceId: IdSchema }).strict(),
  z.object({ type: z.literal('source.sync.updated'), syncRun: SyncRunSchema }).strict(),
  z.object({ type: z.literal('inbox.changed'), itemIds: z.array(IdSchema) }).strict(),
])

export type { AppEvent } from './app-event-contract.js'
