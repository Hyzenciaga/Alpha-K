import { z } from 'zod'
import { IdSchema, IsoDateTimeSchema } from './common.js'

const LocalTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

export const ScheduleDefinitionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('interval'), minutes: z.number().int().min(5).max(10_080) }).strict(),
  z.object({ kind: z.literal('daily'), localTime: LocalTimeSchema }).strict(),
  z
    .object({
      kind: z.literal('weekly'),
      weekday: z.number().int().min(0).max(6),
      localTime: LocalTimeSchema,
    })
    .strict(),
])

export const RssSourceConfigSchema = z
  .object({
    feedUrl: z.string().url(),
    includeKeywords: z.array(z.string().min(1)).max(100).default([]),
    excludeKeywords: z.array(z.string().min(1)).max(100).default([]),
    historyWindowDays: z.number().int().min(1).max(3650).default(30),
    maxItemsPerSync: z.number().int().min(1).max(500).default(100),
  })
  .strict()

export const ArxivSourceConfigSchema = z
  .object({
    query: z.string().min(1),
    categories: z.array(z.string().min(1)).max(50).default([]),
    authors: z.array(z.string().min(1)).max(50).default([]),
    maxResultsPerSync: z.number().int().min(1).max(200).default(50),
    downloadPdf: z.boolean().default(false),
  })
  .strict()

export const DirectorySourceConfigSchema = z
  .object({
    path: z.string().min(1),
    include: z.array(z.string().min(1)).max(100).default(['**/*']),
    exclude: z.array(z.string().min(1)).max(100).default([]),
    importMode: z.enum(['reference', 'symlink', 'copy']).default('reference'),
    settleTimeMs: z.number().int().min(100).max(300_000).default(2000),
    recursive: z.boolean().default(true),
    autoAnalyze: z.boolean().default(false),
  })
  .strict()

export const SourceTypeSchema = z.enum(['rss', 'arxiv', 'directory'])
export const SourceConfigSchema = z.union([
  RssSourceConfigSchema,
  ArxivSourceConfigSchema,
  DirectorySourceConfigSchema,
])

const SourceCommonSchema = z.object({
  id: IdSchema,
  vaultId: IdSchema,
  name: z.string().min(1),
  enabled: z.boolean(),
  schedule: ScheduleDefinitionSchema,
  defaultLabels: z.array(z.string().min(1)).max(100),
  workflowId: IdSchema.nullable(),
  lastSyncAt: IsoDateTimeSchema.nullable(),
  nextSyncAt: IsoDateTimeSchema.nullable(),
  lastError: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
})

export const SourceSchema = z.discriminatedUnion('type', [
  SourceCommonSchema.extend({ type: z.literal('rss'), config: RssSourceConfigSchema }).strict(),
  SourceCommonSchema.extend({ type: z.literal('arxiv'), config: ArxivSourceConfigSchema }).strict(),
  SourceCommonSchema.extend({ type: z.literal('directory'), config: DirectorySourceConfigSchema }).strict(),
])

const CreateSourceCommonSchema = z.object({
  vaultId: IdSchema,
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  schedule: ScheduleDefinitionSchema,
  defaultLabels: z.array(z.string().min(1)).max(100).default([]),
  workflowId: IdSchema.nullable().default(null),
})

export const CreateSourceInputSchema = z.discriminatedUnion('type', [
  CreateSourceCommonSchema.extend({ type: z.literal('rss'), config: RssSourceConfigSchema }).strict(),
  CreateSourceCommonSchema.extend({ type: z.literal('arxiv'), config: ArxivSourceConfigSchema }).strict(),
  CreateSourceCommonSchema.extend({
    type: z.literal('directory'),
    config: DirectorySourceConfigSchema,
  }).strict(),
])

const UpdateSourceCommonShape = {
  name: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  schedule: ScheduleDefinitionSchema.optional(),
  defaultLabels: z.array(z.string().min(1)).max(100).optional(),
  workflowId: IdSchema.nullable().optional(),
  nextSyncAt: IsoDateTimeSchema.nullable().optional(),
}

export const UpdateSourceInputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('rss'), config: RssSourceConfigSchema.optional(), ...UpdateSourceCommonShape }).strict(),
  z
    .object({ type: z.literal('arxiv'), config: ArxivSourceConfigSchema.optional(), ...UpdateSourceCommonShape })
    .strict(),
  z
    .object({
      type: z.literal('directory'),
      config: DirectorySourceConfigSchema.optional(),
      ...UpdateSourceCommonShape,
    })
    .strict(),
])

export const SourceListFilterSchema = z
  .object({
    vaultId: IdSchema,
    types: z.array(SourceTypeSchema).max(3).optional(),
    enabled: z.boolean().optional(),
  })
  .strict()

export type ScheduleDefinition = z.infer<typeof ScheduleDefinitionSchema>
export type RssSourceConfig = z.infer<typeof RssSourceConfigSchema>
export type ArxivSourceConfig = z.infer<typeof ArxivSourceConfigSchema>
export type DirectorySourceConfig = z.infer<typeof DirectorySourceConfigSchema>
export type SourceType = z.infer<typeof SourceTypeSchema>
export type Source = z.infer<typeof SourceSchema>
export type CreateSourceInput = z.input<typeof CreateSourceInputSchema>
export type UpdateSourceInput = z.input<typeof UpdateSourceInputSchema>
export type SourceListFilter = z.input<typeof SourceListFilterSchema>
