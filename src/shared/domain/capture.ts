import { z } from 'zod'
import { IdSchema, IsoDateTimeSchema } from './common.js'

export const CaptureKindSchema = z.enum(['link', 'note'])

export const LearningCaptureSchema = z
  .object({
    id: IdSchema,
    kind: CaptureKindSchema,
    title: z.string().min(1).max(500).nullable(),
    note: z.string().min(1).max(2_000).nullable(),
    content: z.string().min(1).max(20_000),
    normalizedUrl: z.string().url().max(8_000).nullable(),
    sourceHost: z.string().min(1).max(255).nullable(),
    archivedAt: IsoDateTimeSchema.nullable(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict()

export const CreateLearningCaptureInputSchema = z
  .object({
    kind: CaptureKindSchema,
    title: z.string().trim().min(1).max(500).optional(),
    note: z.string().trim().min(1).max(2_000).optional(),
    content: z.string().trim().min(1).max(20_000),
  })
  .strict()

export const LearningCaptureListFilterSchema = z
  .object({
    kind: CaptureKindSchema,
    includeArchived: z.boolean().default(false),
    limit: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().nonnegative().default(0),
  })
  .strict()

export const ArchiveLearningCaptureRequestSchema = z.object({ captureId: IdSchema }).strict()

export type CaptureKind = z.infer<typeof CaptureKindSchema>
export type LearningCapture = z.infer<typeof LearningCaptureSchema>
export type CreateLearningCaptureInput = z.input<typeof CreateLearningCaptureInputSchema>
export type LearningCaptureListFilter = z.input<typeof LearningCaptureListFilterSchema>
