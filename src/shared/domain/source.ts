import { z } from 'zod'
import { IdSchema, IsoDateTimeSchema } from './common.js'

export const ScheduleDefinitionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('interval'), minutes: z.number().int().positive() }).strict(),
  z
    .object({ kind: z.literal('daily'), localTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) })
    .strict(),
  z
    .object({
      kind: z.literal('weekly'),
      weekday: z.number().int().min(0).max(6),
      localTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    })
    .strict(),
])

export const SourceTypeSchema = z.enum(['rss', 'arxiv', 'directory'])

export const SourceSchema = z
  .object({
    id: IdSchema,
    vaultId: IdSchema,
    type: SourceTypeSchema,
    name: z.string().min(1),
    enabled: z.boolean(),
    schedule: ScheduleDefinitionSchema,
    config: z.record(z.string(), z.unknown()),
    defaultLabels: z.array(z.string()),
    workflowId: IdSchema.nullable(),
    lastSyncAt: IsoDateTimeSchema.nullable(),
    nextSyncAt: IsoDateTimeSchema.nullable(),
    lastError: z.string().nullable(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict()

export const CreateSourceInputSchema = SourceSchema.pick({
  vaultId: true,
  type: true,
  name: true,
  schedule: true,
})
  .extend({
    enabled: z.boolean().default(true),
    config: z.record(z.string(), z.unknown()).default({}),
    defaultLabels: z.array(z.string()).default([]),
    workflowId: IdSchema.nullable().default(null),
  })
  .strict()

export const UpdateSourceInputSchema = SourceSchema.pick({
  name: true,
  enabled: true,
  schedule: true,
  config: true,
  defaultLabels: true,
  workflowId: true,
  nextSyncAt: true,
})
  .partial()
  .strict()

export type ScheduleDefinition = z.infer<typeof ScheduleDefinitionSchema>
export type Source = z.infer<typeof SourceSchema>
export type CreateSourceInput = z.input<typeof CreateSourceInputSchema>
export type UpdateSourceInput = z.input<typeof UpdateSourceInputSchema>
