import { z } from 'zod'
import { IdSchema, IsoDateTimeSchema } from './common.js'
import { SourceTypeSchema } from './source.js'

export const InboxItemStatusSchema = z.enum(['discovered', 'fetched', 'extracted', 'failed'])

export const InboxItemSummarySchema = z
  .object({
    id: IdSchema,
    vaultId: IdSchema,
    sourceId: IdSchema,
    sourceName: z.string().min(1),
    sourceType: SourceTypeSchema,
    externalId: z.string().nullable(),
    canonicalUrl: z.string().url().nullable(),
    title: z.string().min(1),
    authors: z.array(z.string()),
    publishedAt: IsoDateTimeSchema.nullable(),
    fetchedAt: IsoDateTimeSchema,
    status: InboxItemStatusSchema,
    primaryArtifactId: IdSchema.nullable(),
    excerpt: z.string().nullable(),
    labels: z.array(z.string()),
  })
  .strict()

export const InboxItemListFilterSchema = z
  .object({
    vaultId: IdSchema,
    sourceIds: z.array(IdSchema).max(100).optional(),
    statuses: z.array(InboxItemStatusSchema).max(4).optional(),
    search: z.string().max(500).optional(),
    limit: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().nonnegative().default(0),
  })
  .strict()

export type InboxItemStatus = z.infer<typeof InboxItemStatusSchema>
export type InboxItemSummary = z.infer<typeof InboxItemSummarySchema>
export type InboxItemListFilter = z.input<typeof InboxItemListFilterSchema>
