import { z } from 'zod'
import { IsoDateTimeSchema } from './common.js'
import { SourceTypeSchema } from './source.js'

export const DiscoveredAttachmentSchema = z
  .object({
    url: z.string().url(),
    title: z.string().min(1).nullable().default(null),
    mimeType: z.string().min(1).nullable().default(null),
  })
  .strict()

const DiscoveredItemBaseSchema = z
  .object({
    externalId: z.string().min(1).nullable().default(null),
    canonicalUrl: z.string().url().nullable().default(null),
    title: z.string().min(1),
    authors: z.array(z.string().min(1)).default([]),
    publishedAt: IsoDateTimeSchema.nullable().default(null),
    rawMetadata: z.record(z.string(), z.unknown()).default({}),
    content: z.string().nullable().default(null),
    contentHash: z.string().min(1).nullable().default(null),
    attachments: z.array(DiscoveredAttachmentSchema).max(50).default([]),
  })
  .strict()

export const DiscoveredItemSchema = DiscoveredItemBaseSchema.refine(
  (item) => item.externalId !== null || item.canonicalUrl !== null || item.contentHash !== null,
  {
    message: 'A discovered item requires externalId, canonicalUrl, or contentHash.',
  },
)

export const DiscoveredItemPreviewSchema = DiscoveredItemBaseSchema.pick({
  externalId: true,
  canonicalUrl: true,
  title: true,
  authors: true,
  publishedAt: true,
  contentHash: true,
}).extend({
  excerpt: z.string().nullable().default(null),
})

export const SourcePreviewSchema = z
  .object({
    sourceType: SourceTypeSchema,
    title: z.string().min(1).nullable(),
    description: z.string().nullable(),
    items: z.array(DiscoveredItemPreviewSchema).max(50),
    warnings: z.array(z.string()),
  })
  .strict()

export type DiscoveredAttachment = z.infer<typeof DiscoveredAttachmentSchema>
export type DiscoveredItem = z.input<typeof DiscoveredItemSchema>
export type DiscoveredItemPreview = z.infer<typeof DiscoveredItemPreviewSchema>
export type SourcePreview = z.infer<typeof SourcePreviewSchema>
