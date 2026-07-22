import type { SupabaseClient } from '@supabase/supabase-js'
import {
  RemoteKnowledgeRefSchema,
  SyncChangeSchema,
  UserKnowledgeStateSchema,
  type KnowledgeRefUpsert,
  type RemoteKnowledgeRef,
  type SyncChange,
  type UserKnowledgeState,
  type UserKnowledgeStateUpsert,
} from '../../shared/domain/cloud-sync.js'
import type { RemoteDevice, RemoteSyncProvider } from './remote-sync-provider.js'

type KnowledgeRefRow = {
  id: string
  ref_key: string
  kind: string
  source_key: string | null
  external_id: string | null
  canonical_url: string | null
  content_hash: string | null
  title: string
  authors: unknown
  published_at: string | null
  discovered_at: string
  updated_at: string
}

type UserStateRow = {
  knowledge_ref_id: string
  is_read: boolean
  is_starred: boolean
  disposition: string | null
  updated_at: string
}

type ChangeRow = {
  id: string
  sequence: number
  entity_type: string
  entity_id: string
  operation: string
  changed_at: string
}

export class SupabaseRemoteSyncProvider implements RemoteSyncProvider {
  constructor(private readonly client: SupabaseClient) {}

  async registerDevice(ownerId: string, device: RemoteDevice): Promise<void> {
    const { error } = await this.client.from('devices').upsert(
      {
        id: device.id,
        owner_id: ownerId,
        name: device.name,
        platform: device.platform,
        app_version: device.appVersion,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'owner_id,id' },
    )
    if (error) throw error
  }

  async upsertKnowledgeRef(ownerId: string, ref: KnowledgeRefUpsert): Promise<RemoteKnowledgeRef> {
    const { data, error } = await this.client
      .from('knowledge_refs')
      .upsert(
        {
          owner_id: ownerId,
          ref_key: ref.refKey,
          kind: ref.kind,
          source_key: ref.sourceKey,
          external_id: ref.externalId,
          canonical_url: ref.canonicalUrl,
          content_hash: ref.contentHash,
          title: ref.title,
          authors: ref.authors,
          published_at: ref.publishedAt,
          discovered_at: ref.discoveredAt,
        },
        { onConflict: 'owner_id,ref_key' },
      )
      .select(KNOWLEDGE_REF_COLUMNS)
      .single()
    if (error) throw error
    return mapKnowledgeRef(data as KnowledgeRefRow)
  }

  async upsertUserState(
    ownerId: string,
    knowledgeRefId: string,
    state: UserKnowledgeStateUpsert,
  ): Promise<UserKnowledgeState> {
    const { data, error } = await this.client
      .from('user_knowledge_states')
      .upsert(
        {
          owner_id: ownerId,
          knowledge_ref_id: knowledgeRefId,
          is_read: state.read,
          is_starred: state.starred,
          disposition: state.disposition,
        },
        { onConflict: 'owner_id,knowledge_ref_id' },
      )
      .select(USER_STATE_COLUMNS)
      .single()
    if (error) throw error
    return mapUserState(data as UserStateRow)
  }

  async findKnowledgeRefByKey(ownerId: string, refKey: string): Promise<RemoteKnowledgeRef | null> {
    const { data, error } = await this.client
      .from('knowledge_refs')
      .select(KNOWLEDGE_REF_COLUMNS)
      .eq('owner_id', ownerId)
      .eq('ref_key', refKey)
      .maybeSingle()
    if (error) throw error
    return data ? mapKnowledgeRef(data as KnowledgeRefRow) : null
  }

  async pullChanges(ownerId: string, afterSequence: number, limit: number): Promise<SyncChange[]> {
    const { data, error } = await this.client
      .from('sync_changes')
      .select('id, sequence, entity_type, entity_id, operation, changed_at')
      .eq('owner_id', ownerId)
      .gt('sequence', afterSequence)
      .order('sequence', { ascending: true })
      .limit(limit)
    if (error) throw error
    return (data as ChangeRow[]).map((row) =>
      SyncChangeSchema.parse({
        id: row.id,
        sequence: Number(row.sequence),
        entityType: row.entity_type,
        entityId: row.entity_id,
        operation: row.operation,
        changedAt: row.changed_at,
      }),
    )
  }

  async fetchKnowledgeRefs(ownerId: string, ids: string[]): Promise<RemoteKnowledgeRef[]> {
    if (ids.length === 0) return []
    const { data, error } = await this.client
      .from('knowledge_refs')
      .select(KNOWLEDGE_REF_COLUMNS)
      .eq('owner_id', ownerId)
      .in('id', ids)
    if (error) throw error
    return (data as KnowledgeRefRow[]).map(mapKnowledgeRef)
  }

  async fetchUserStates(ownerId: string, knowledgeRefIds: string[]): Promise<UserKnowledgeState[]> {
    if (knowledgeRefIds.length === 0) return []
    const { data, error } = await this.client
      .from('user_knowledge_states')
      .select(USER_STATE_COLUMNS)
      .eq('owner_id', ownerId)
      .in('knowledge_ref_id', knowledgeRefIds)
    if (error) throw error
    return (data as UserStateRow[]).map(mapUserState)
  }
}

const KNOWLEDGE_REF_COLUMNS =
  'id, ref_key, kind, source_key, external_id, canonical_url, content_hash, title, authors, published_at, discovered_at, updated_at'
const USER_STATE_COLUMNS =
  'knowledge_ref_id, is_read, is_starred, disposition, updated_at'

function mapKnowledgeRef(row: KnowledgeRefRow): RemoteKnowledgeRef {
  return RemoteKnowledgeRefSchema.parse({
    id: row.id,
    refKey: row.ref_key,
    kind: row.kind,
    sourceKey: row.source_key,
    externalId: row.external_id,
    canonicalUrl: row.canonical_url,
    contentHash: row.content_hash,
    title: row.title,
    authors: row.authors,
    publishedAt: row.published_at,
    discoveredAt: row.discovered_at,
    updatedAt: row.updated_at,
  })
}

function mapUserState(row: UserStateRow): UserKnowledgeState {
  return UserKnowledgeStateSchema.parse({
    knowledgeRefId: row.knowledge_ref_id,
    read: row.is_read,
    starred: row.is_starred,
    disposition: row.disposition,
    updatedAt: row.updated_at,
  })
}
