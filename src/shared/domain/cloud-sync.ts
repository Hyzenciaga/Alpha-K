import { z } from 'zod'
import { IdSchema, IsoDateTimeSchema } from './common.js'

export const CloudConfigurationStatusSchema = z.enum(['ready', 'missing_publishable_key'])
export const CloudAuthStatusSchema = z.enum(['signed_out', 'signing_in', 'signed_in', 'error'])
export const RemoteSyncStatusSchema = z.enum(['disabled', 'idle', 'syncing', 'offline', 'error'])

export const CloudUserSchema = z
  .object({
    id: IdSchema,
    provider: z.literal('github'),
    email: z.string().email().nullable(),
    displayName: z.string().min(1).nullable(),
    avatarUrl: z.string().url().nullable(),
  })
  .strict()

export const CloudStatusSchema = z
  .object({
    projectRef: z.string().min(1),
    region: z.literal('Singapore'),
    configuration: CloudConfigurationStatusSchema,
    auth: CloudAuthStatusSchema,
    user: CloudUserSchema.nullable(),
    sync: RemoteSyncStatusSchema,
    pendingChanges: z.number().int().nonnegative(),
    lastSyncedAt: IsoDateTimeSchema.nullable(),
    lastError: z.string().nullable(),
  })
  .strict()

export const KnowledgeRefKindSchema = z.enum(['rss', 'arxiv', 'url', 'file_hash'])
export const KnowledgeDispositionSchema = z.enum(['accepted', 'ignored'])

export const RemoteKnowledgeRefSchema = z
  .object({
    id: IdSchema,
    refKey: z.string().min(1).max(1_000),
    kind: KnowledgeRefKindSchema,
    sourceKey: z.string().max(1_000).nullable(),
    externalId: z.string().max(2_000).nullable(),
    canonicalUrl: z.string().url().max(8_000).nullable(),
    contentHash: z.string().max(256).nullable(),
    title: z.string().min(1).max(4_000),
    authors: z.array(z.string().max(1_000)).max(100),
    publishedAt: IsoDateTimeSchema.nullable(),
    discoveredAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict()

export const UserKnowledgeStateSchema = z
  .object({
    knowledgeRefId: IdSchema,
    read: z.boolean(),
    starred: z.boolean(),
    disposition: KnowledgeDispositionSchema.nullable(),
    updatedAt: IsoDateTimeSchema,
  })
  .strict()

export const KnowledgeRefUpsertSchema = RemoteKnowledgeRefSchema.omit({
  id: true,
  updatedAt: true,
})

export const UserKnowledgeStateUpsertSchema = UserKnowledgeStateSchema.omit({
  knowledgeRefId: true,
  updatedAt: true,
})
  .extend({ refKey: z.string().min(1).max(1_000) })
  .strict()

export const SyncEntityTypeSchema = z.enum(['knowledge_ref', 'user_knowledge_state'])
export const SyncOperationSchema = z.enum(['upsert', 'delete'])

export const SyncChangeSchema = z
  .object({
    id: IdSchema,
    sequence: z.number().int().nonnegative(),
    entityType: SyncEntityTypeSchema,
    entityId: IdSchema,
    operation: SyncOperationSchema,
    changedAt: IsoDateTimeSchema,
  })
  .strict()

export type CloudConfigurationStatus = z.infer<typeof CloudConfigurationStatusSchema>
export type CloudAuthStatus = z.infer<typeof CloudAuthStatusSchema>
export type RemoteSyncStatus = z.infer<typeof RemoteSyncStatusSchema>
export type CloudUser = z.infer<typeof CloudUserSchema>
export type CloudStatus = z.infer<typeof CloudStatusSchema>
export type KnowledgeRefKind = z.infer<typeof KnowledgeRefKindSchema>
export type KnowledgeDisposition = z.infer<typeof KnowledgeDispositionSchema>
export type RemoteKnowledgeRef = z.infer<typeof RemoteKnowledgeRefSchema>
export type UserKnowledgeState = z.infer<typeof UserKnowledgeStateSchema>
export type KnowledgeRefUpsert = z.infer<typeof KnowledgeRefUpsertSchema>
export type UserKnowledgeStateUpsert = z.infer<typeof UserKnowledgeStateUpsertSchema>
export type SyncEntityType = z.infer<typeof SyncEntityTypeSchema>
export type SyncOperation = z.infer<typeof SyncOperationSchema>
export type SyncChange = z.infer<typeof SyncChangeSchema>
