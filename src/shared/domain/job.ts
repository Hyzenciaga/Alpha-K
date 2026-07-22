import { z } from 'zod'
import { IdSchema, IsoDateTimeSchema } from './common.js'

export const JobTypeSchema = z.enum([
  'source.sync',
  'document.extract',
  'document.preannotate',
  'knowledge.query',
  'collection.summarize',
  'report.daily',
  'report.weekly',
  'external.scan',
  'external.analyze',
  'index.rebuild',
])

export const JobStatusSchema = z.enum([
  'scheduled',
  'queued',
  'running',
  'succeeded',
  'failed',
  'interrupted',
  'cancelled',
])

export const JobPrioritySchema = z.enum(['interactive', 'normal', 'background'])

export const JobPayloadSchema = z.record(z.string(), z.unknown())

export const JobSchema = z
  .object({
    id: IdSchema,
    vaultId: IdSchema.nullable(),
    type: JobTypeSchema,
    status: JobStatusSchema,
    priority: JobPrioritySchema,
    idempotencyKey: z.string().min(1).nullable(),
    payload: JobPayloadSchema,
    attempt: z.number().int().nonnegative(),
    maxAttempts: z.number().int().positive(),
    scheduledAt: IsoDateTimeSchema.nullable(),
    runAfter: IsoDateTimeSchema,
    workerId: z.string().min(1).nullable(),
    leaseExpiresAt: IsoDateTimeSchema.nullable(),
    heartbeatAt: IsoDateTimeSchema.nullable(),
    startedAt: IsoDateTimeSchema.nullable(),
    finishedAt: IsoDateTimeSchema.nullable(),
    lastError: z.string().nullable(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict()

export const EnqueueJobInputSchema = z
  .object({
    vaultId: IdSchema.nullable().optional(),
    type: JobTypeSchema,
    priority: JobPrioritySchema.default('normal'),
    idempotencyKey: z.string().min(1).nullable().optional(),
    payload: JobPayloadSchema.default({}),
    maxAttempts: z.number().int().positive().max(100).default(3),
    scheduledAt: IsoDateTimeSchema.nullable().optional(),
    runAfter: IsoDateTimeSchema.optional(),
  })
  .strict()

export const JobListFilterSchema = z
  .object({
    vaultId: IdSchema.nullable().optional(),
    statuses: z.array(JobStatusSchema).max(20).optional(),
    types: z.array(JobTypeSchema).max(30).optional(),
    limit: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().nonnegative().default(0),
  })
  .strict()

export type JobType = z.infer<typeof JobTypeSchema>
export type JobStatus = z.infer<typeof JobStatusSchema>
export type JobPriority = z.infer<typeof JobPrioritySchema>
export type Job = z.infer<typeof JobSchema>
export type EnqueueJobInput = z.input<typeof EnqueueJobInputSchema>
export type JobListFilter = z.input<typeof JobListFilterSchema>

