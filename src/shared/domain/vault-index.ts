import { z } from 'zod'
import { IdSchema } from './common.js'

export const VAULT_SEARCH_METADATA_SCHEMA_VERSION = 1 as const

export const VaultSearchMetadataSchema = z
  .object({
    schemaVersion: z.literal(VAULT_SEARCH_METADATA_SCHEMA_VERSION),
    id: IdSchema,
    title: z.string().min(1),
    summary: z.string().default(''),
    authors: z.array(z.string()).default([]),
    labels: z.array(z.string()).default([]),
  })
  .passthrough()

export const SearchIndexRebuildIssueSchema = z
  .object({
    relativePath: z.string(),
    message: z.string(),
  })
  .strict()

export const SearchIndexRebuildReportSchema = z
  .object({
    indexed: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    issues: z.array(SearchIndexRebuildIssueSchema),
  })
  .strict()

export type SearchIndexRebuildReport = z.infer<typeof SearchIndexRebuildReportSchema>
