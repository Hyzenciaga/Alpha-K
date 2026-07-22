import { z } from 'zod'
import { IdSchema, IsoDateTimeSchema } from './common.js'

export const SyncRunTriggerSchema = z.enum(['manual', 'scheduled', 'missed_schedule'])
export const SyncRunStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'failed',
  'interrupted',
  'cancelled',
])

export const SourceSyncJobPayloadSchema = z
  .object({
    sourceId: IdSchema,
    syncRunId: IdSchema,
    trigger: SyncRunTriggerSchema,
  })
  .strict()

export const SyncRunSchema = z
  .object({
    id: IdSchema,
    vaultId: IdSchema,
    sourceId: IdSchema,
    jobId: IdSchema,
    trigger: SyncRunTriggerSchema,
    status: SyncRunStatusSchema,
    discoveredCount: z.number().int().nonnegative(),
    createdCount: z.number().int().nonnegative(),
    updatedCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    error: z.string().nullable(),
    startedAt: IsoDateTimeSchema.nullable(),
    finishedAt: IsoDateTimeSchema.nullable(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict()

export const SyncRunListFilterSchema = z
  .object({
    vaultId: IdSchema,
    sourceId: IdSchema.optional(),
    statuses: z.array(SyncRunStatusSchema).max(10).optional(),
    limit: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().nonnegative().default(0),
  })
  .strict()

export type SyncRunTrigger = z.infer<typeof SyncRunTriggerSchema>
export type SyncRunStatus = z.infer<typeof SyncRunStatusSchema>
export type SourceSyncJobPayload = z.infer<typeof SourceSyncJobPayloadSchema>
export type SyncRun = z.infer<typeof SyncRunSchema>
export type SyncRunListFilter = z.input<typeof SyncRunListFilterSchema>
