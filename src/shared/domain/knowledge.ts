import { z } from 'zod'
import { IdSchema, IsoDateTimeSchema } from './common.js'

export const KnowledgeItemStatusSchema = z.enum([
  'discovered',
  'fetched',
  'extracted',
  'analysis_queued',
  'review_required',
  'accepted',
  'ignored',
  'failed',
])

export const KnowledgeItemSchema = z
  .object({
    id: IdSchema,
    vaultId: IdSchema,
    sourceId: IdSchema,
    externalId: z.string().nullable(),
    canonicalUrl: z.string().url().nullable(),
    title: z.string().min(1),
    authors: z.array(z.string()),
    publishedAt: IsoDateTimeSchema.nullable(),
    fetchedAt: IsoDateTimeSchema,
    status: KnowledgeItemStatusSchema,
    primaryArtifactId: IdSchema.nullable(),
    contentHash: z.string().nullable(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict()

export const ArtifactKindSchema = z.enum(['markdown', 'pdf', 'html', 'text', 'external_reference'])
export const ArtifactStorageModeSchema = z.enum(['managed', 'copy', 'symlink', 'reference'])

export const ArtifactSchema = z
  .object({
    id: IdSchema,
    vaultId: IdSchema,
    knowledgeItemId: IdSchema,
    kind: ArtifactKindSchema,
    storageMode: ArtifactStorageModeSchema,
    path: z.string().min(1),
    realPath: z.string().nullable(),
    mimeType: z.string().nullable(),
    size: z.number().int().nonnegative().nullable(),
    contentHash: z.string().nullable(),
    lastSeenAt: IsoDateTimeSchema.nullable(),
    missingSince: IsoDateTimeSchema.nullable(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict()

export const CreateKnowledgeItemInputSchema = KnowledgeItemSchema.pick({
  vaultId: true,
  sourceId: true,
  title: true,
  fetchedAt: true,
})
  .extend({
    externalId: z.string().nullable().default(null),
    canonicalUrl: z.string().url().nullable().default(null),
    authors: z.array(z.string()).default([]),
    publishedAt: IsoDateTimeSchema.nullable().default(null),
    status: KnowledgeItemStatusSchema.default('discovered'),
    primaryArtifactId: IdSchema.nullable().default(null),
    contentHash: z.string().nullable().default(null),
  })
  .strict()

export const KnowledgeItemListFilterSchema = z
  .object({
    vaultId: IdSchema,
    statuses: z.array(KnowledgeItemStatusSchema).max(20).optional(),
    limit: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().nonnegative().default(0),
  })
  .strict()

export const CreateArtifactInputSchema = ArtifactSchema.pick({
  vaultId: true,
  knowledgeItemId: true,
  kind: true,
  storageMode: true,
  path: true,
})
  .extend({
    realPath: z.string().nullable().default(null),
    mimeType: z.string().nullable().default(null),
    size: z.number().int().nonnegative().nullable().default(null),
    contentHash: z.string().nullable().default(null),
    lastSeenAt: IsoDateTimeSchema.nullable().default(null),
    missingSince: IsoDateTimeSchema.nullable().default(null),
  })
  .strict()

export const SearchDocumentSchema = z
  .object({
    knowledgeItemId: IdSchema,
    title: z.string(),
    summary: z.string().default(''),
    authors: z.array(z.string()).default([]),
    labels: z.array(z.string()).default([]),
  })
  .strict()

export const SearchResultSchema = SearchDocumentSchema.extend({
  rank: z.number(),
  snippet: z.string(),
}).strict()

export type KnowledgeItem = z.infer<typeof KnowledgeItemSchema>
export type Artifact = z.infer<typeof ArtifactSchema>
export type CreateKnowledgeItemInput = z.input<typeof CreateKnowledgeItemInputSchema>
export type KnowledgeItemListFilter = z.input<typeof KnowledgeItemListFilterSchema>
export type CreateArtifactInput = z.input<typeof CreateArtifactInputSchema>
export type SearchDocument = z.input<typeof SearchDocumentSchema>
export type SearchResult = z.infer<typeof SearchResultSchema>
