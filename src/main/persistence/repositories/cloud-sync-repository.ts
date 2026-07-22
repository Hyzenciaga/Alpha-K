import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  KnowledgeRefUpsertSchema,
  RemoteKnowledgeRefSchema,
  UserKnowledgeStateSchema,
  UserKnowledgeStateUpsertSchema,
  type KnowledgeRefUpsert,
  type RemoteKnowledgeRef,
  type SyncEntityType,
  type UserKnowledgeState,
  type UserKnowledgeStateUpsert,
} from '../../../shared/domain/cloud-sync.js'

export type CloudOutboxEntry = {
  id: string
  ownerId: string
  entityType: SyncEntityType
  entityKey: string
  operation: 'upsert'
  payload: KnowledgeRefUpsert | UserKnowledgeStateUpsert
  attemptCount: number
  localKnowledgeItemId: string | null
}

type OutboxRow = {
  id: string
  owner_id: string
  entity_type: SyncEntityType
  entity_key: string
  operation: 'upsert'
  payload_json: string
  attempt_count: number
  local_knowledge_item_id: string | null
}

export type CloudCursor = {
  pullSequence: number
  lastPushedAt: string | null
  lastPulledAt: string | null
  lastError: string | null
}

export class CloudSyncRepository {
  constructor(
    private readonly database: Database.Database,
    private readonly dependencies: { now?: () => Date; createId?: () => string } = {},
  ) {}

  getOrCreateDeviceId(): string {
    const existing = this.database
      .prepare("SELECT device_id FROM cloud_device_installation WHERE singleton_key = 'device'")
      .get() as { device_id: string } | undefined
    if (existing) {
      this.database
        .prepare("UPDATE cloud_device_installation SET last_seen_at = ? WHERE singleton_key = 'device'")
        .run(this.now())
      return existing.device_id
    }
    const id = this.createId()
    const now = this.now()
    this.database
      .prepare(
        `INSERT INTO cloud_device_installation
          (singleton_key, device_id, created_at, last_seen_at)
         VALUES ('device', ?, ?, ?)`,
      )
      .run(id, now, now)
    return id
  }

  bindAccount(ownerId: string, email: string | null): { firstBinding: boolean } {
    const existing = this.database
      .prepare('SELECT owner_id FROM cloud_account_bindings WHERE owner_id = ?')
      .get(ownerId) as { owner_id: string } | undefined
    const now = this.now()
    this.database
      .prepare(
        `INSERT INTO cloud_account_bindings
          (owner_id, provider, email, first_seen_at, last_seen_at)
         VALUES (?, 'github', ?, ?, ?)
         ON CONFLICT (owner_id) DO UPDATE SET
          email = excluded.email,
          last_seen_at = excluded.last_seen_at`,
      )
      .run(ownerId, email, now, now)
    this.ensureCursor(ownerId)
    return { firstBinding: !existing }
  }

  enqueueKnowledgeRef(ownerId: string, knowledgeItemId: string, payload: KnowledgeRefUpsert): void {
    const parsed = KnowledgeRefUpsertSchema.parse(payload)
    this.enqueue(ownerId, 'knowledge_ref', parsed.refKey, knowledgeItemId, parsed)
  }

  enqueueUserState(ownerId: string, knowledgeItemId: string, payload: UserKnowledgeStateUpsert): void {
    const parsed = UserKnowledgeStateUpsertSchema.parse(payload)
    this.enqueue(ownerId, 'user_knowledge_state', parsed.refKey, knowledgeItemId, parsed)
  }

  listDue(ownerId: string, limit = 50): CloudOutboxEntry[] {
    const rows = this.database
      .prepare(
        `SELECT id, owner_id, entity_type, entity_key, operation, payload_json, attempt_count,
          local_knowledge_item_id
         FROM cloud_sync_outbox
         WHERE owner_id = ? AND next_attempt_at <= ?
         ORDER BY created_at, id LIMIT ?`,
      )
      .all(ownerId, this.now(), limit) as OutboxRow[]
    return rows.map((row) => ({
      id: row.id,
      ownerId: row.owner_id,
      entityType: row.entity_type,
      entityKey: row.entity_key,
      operation: row.operation,
      payload:
        row.entity_type === 'knowledge_ref'
          ? KnowledgeRefUpsertSchema.parse(JSON.parse(row.payload_json))
          : UserKnowledgeStateUpsertSchema.parse(JSON.parse(row.payload_json)),
      attemptCount: row.attempt_count,
      localKnowledgeItemId: row.local_knowledge_item_id,
    }))
  }

  acknowledge(id: string): void {
    this.database.prepare('DELETE FROM cloud_sync_outbox WHERE id = ?').run(id)
  }

  retry(id: string, error: string, retryAt: string): void {
    this.database
      .prepare(
        `UPDATE cloud_sync_outbox SET
          attempt_count = attempt_count + 1,
          next_attempt_at = ?, last_error = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(retryAt, error, this.now(), id)
  }

  pendingCount(ownerId: string): number {
    const row = this.database
      .prepare('SELECT COUNT(*) AS count FROM cloud_sync_outbox WHERE owner_id = ?')
      .get(ownerId) as { count: number }
    return row.count
  }

  getCursor(ownerId: string): CloudCursor {
    this.ensureCursor(ownerId)
    const row = this.database
      .prepare(
        `SELECT pull_sequence, last_pushed_at, last_pulled_at, last_error
         FROM cloud_sync_cursors WHERE owner_id = ?`,
      )
      .get(ownerId) as {
      pull_sequence: number
      last_pushed_at: string | null
      last_pulled_at: string | null
      last_error: string | null
    }
    return {
      pullSequence: row.pull_sequence,
      lastPushedAt: row.last_pushed_at,
      lastPulledAt: row.last_pulled_at,
      lastError: row.last_error,
    }
  }

  recordPush(ownerId: string): void {
    this.updateCursor(ownerId, { lastPushedAt: this.now(), lastError: null })
  }

  recordPull(ownerId: string, sequence: number): void {
    this.updateCursor(ownerId, {
      pullSequence: sequence,
      lastPulledAt: this.now(),
      lastError: null,
    })
  }

  recordError(ownerId: string, error: string): void {
    this.updateCursor(ownerId, { lastError: error })
  }

  bindKnowledge(
    ownerId: string,
    knowledgeItemId: string,
    remote: Pick<RemoteKnowledgeRef, 'id' | 'refKey' | 'updatedAt'>,
  ): void {
    this.database
      .prepare(
        `INSERT INTO cloud_knowledge_bindings
          (owner_id, knowledge_item_id, remote_ref_id, ref_key, materialized_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (owner_id, knowledge_item_id) DO UPDATE SET
          remote_ref_id = excluded.remote_ref_id,
          ref_key = excluded.ref_key,
          materialized_at = excluded.materialized_at,
          updated_at = excluded.updated_at`,
      )
      .run(ownerId, knowledgeItemId, remote.id, remote.refKey, this.now(), remote.updatedAt)
  }

  findKnowledgeItemId(ownerId: string, refKey: string): string | null {
    const row = this.database
      .prepare(
        `SELECT knowledge_item_id FROM cloud_knowledge_bindings
         WHERE owner_id = ? AND ref_key = ?`,
      )
      .get(ownerId, refKey) as { knowledge_item_id: string } | undefined
    return row?.knowledge_item_id ?? null
  }

  findRemoteRefId(ownerId: string, refKey: string): string | null {
    const row = this.database
      .prepare(
        `SELECT remote_ref_id FROM cloud_knowledge_bindings
         WHERE owner_id = ? AND ref_key = ?`,
      )
      .get(ownerId, refKey) as { remote_ref_id: string } | undefined
    return row?.remote_ref_id ?? null
  }

  findMaterializedKnowledgeItemId(ownerId: string, remoteRefId: string): string | null {
    const row = this.database
      .prepare(
        `SELECT materialized_knowledge_item_id FROM cloud_knowledge_ref_cache
         WHERE owner_id = ? AND remote_ref_id = ?`,
      )
      .get(ownerId, remoteRefId) as { materialized_knowledge_item_id: string | null } | undefined
    return row?.materialized_knowledge_item_id ?? null
  }

  cacheKnowledgeRef(ownerId: string, ref: RemoteKnowledgeRef): void {
    const parsed = RemoteKnowledgeRefSchema.parse(ref)
    const materializedId = this.findKnowledgeItemId(ownerId, parsed.refKey)
    this.database
      .prepare(
        `INSERT INTO cloud_knowledge_ref_cache (
          owner_id, remote_ref_id, ref_key, kind, source_key, external_id,
          canonical_url, content_hash, title, authors_json, published_at,
          discovered_at, remote_updated_at, materialized_knowledge_item_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (owner_id, remote_ref_id) DO UPDATE SET
          ref_key = excluded.ref_key,
          kind = excluded.kind,
          source_key = excluded.source_key,
          external_id = excluded.external_id,
          canonical_url = excluded.canonical_url,
          content_hash = excluded.content_hash,
          title = excluded.title,
          authors_json = excluded.authors_json,
          published_at = excluded.published_at,
          discovered_at = excluded.discovered_at,
          remote_updated_at = excluded.remote_updated_at,
          materialized_knowledge_item_id = excluded.materialized_knowledge_item_id`,
      )
      .run(
        ownerId,
        parsed.id,
        parsed.refKey,
        parsed.kind,
        parsed.sourceKey,
        parsed.externalId,
        parsed.canonicalUrl,
        parsed.contentHash,
        parsed.title,
        JSON.stringify(parsed.authors),
        parsed.publishedAt,
        parsed.discoveredAt,
        parsed.updatedAt,
        materializedId,
      )
  }

  cacheUserState(ownerId: string, state: UserKnowledgeState): void {
    const parsed = UserKnowledgeStateSchema.parse(state)
    this.database
      .prepare(
        `INSERT INTO cloud_user_state_cache
          (owner_id, remote_ref_id, is_read, is_starred, disposition, remote_updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (owner_id, remote_ref_id) DO UPDATE SET
          is_read = excluded.is_read,
          is_starred = excluded.is_starred,
          disposition = excluded.disposition,
          remote_updated_at = excluded.remote_updated_at`,
      )
      .run(
        ownerId,
        parsed.knowledgeRefId,
        parsed.read ? 1 : 0,
        parsed.starred ? 1 : 0,
        parsed.disposition,
        parsed.updatedAt,
      )
  }

  removeCachedEntity(ownerId: string, entityType: SyncEntityType, remoteId: string): void {
    const table = entityType === 'knowledge_ref' ? 'cloud_knowledge_ref_cache' : 'cloud_user_state_cache'
    this.database.prepare(`DELETE FROM ${table} WHERE owner_id = ? AND remote_ref_id = ?`).run(ownerId, remoteId)
  }

  private enqueue(
    ownerId: string,
    entityType: SyncEntityType,
    entityKey: string,
    localKnowledgeItemId: string,
    payload: KnowledgeRefUpsert | UserKnowledgeStateUpsert,
  ): void {
    const now = this.now()
    this.database
      .prepare(
        `INSERT INTO cloud_sync_outbox (
          id, owner_id, entity_type, entity_key, operation, payload_json,
          attempt_count, next_attempt_at, last_error, created_at, updated_at,
          local_knowledge_item_id
        ) VALUES (?, ?, ?, ?, 'upsert', ?, 0, ?, NULL, ?, ?, ?)
        ON CONFLICT (owner_id, entity_type, entity_key) DO UPDATE SET
          operation = 'upsert',
          payload_json = excluded.payload_json,
          attempt_count = 0,
          next_attempt_at = excluded.next_attempt_at,
          last_error = NULL,
          updated_at = excluded.updated_at,
          local_knowledge_item_id = excluded.local_knowledge_item_id`,
      )
      .run(
        this.createId(),
        ownerId,
        entityType,
        entityKey,
        JSON.stringify(payload),
        now,
        now,
        now,
        localKnowledgeItemId,
      )
  }

  private ensureCursor(ownerId: string): void {
    const now = this.now()
    this.database
      .prepare(
        `INSERT INTO cloud_sync_cursors
          (owner_id, pull_sequence, last_pushed_at, last_pulled_at, last_error, updated_at)
         VALUES (?, 0, NULL, NULL, NULL, ?)
         ON CONFLICT (owner_id) DO NOTHING`,
      )
      .run(ownerId, now)
  }

  private updateCursor(
    ownerId: string,
    patch: Partial<{
      pullSequence: number
      lastPushedAt: string | null
      lastPulledAt: string | null
      lastError: string | null
    }>,
  ): void {
    const existing = this.getCursor(ownerId)
    this.database
      .prepare(
        `UPDATE cloud_sync_cursors SET
          pull_sequence = ?, last_pushed_at = ?, last_pulled_at = ?, last_error = ?, updated_at = ?
         WHERE owner_id = ?`,
      )
      .run(
        patch.pullSequence ?? existing.pullSequence,
        patch.lastPushedAt === undefined ? existing.lastPushedAt : patch.lastPushedAt,
        patch.lastPulledAt === undefined ? existing.lastPulledAt : patch.lastPulledAt,
        patch.lastError === undefined ? existing.lastError : patch.lastError,
        this.now(),
        ownerId,
      )
  }

  private now(): string {
    return (this.dependencies.now?.() ?? new Date()).toISOString()
  }

  private createId(): string {
    return this.dependencies.createId?.() ?? randomUUID()
  }
}
