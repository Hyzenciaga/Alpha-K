import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { IdSchema } from '../../../shared/domain/common.js'
import {
  ArtifactSchema,
  CreateArtifactInputSchema,
  type Artifact,
  type CreateArtifactInput,
} from '../../../shared/domain/knowledge.js'

type ArtifactRow = {
  id: string
  vault_id: string
  knowledge_item_id: string
  kind: string
  storage_mode: string
  path: string
  real_path: string | null
  mime_type: string | null
  size: number | null
  content_hash: string | null
  last_seen_at: string | null
  missing_since: string | null
  created_at: string
  updated_at: string
}

export class ArtifactRepository {
  constructor(
    private readonly database: Database.Database,
    private readonly dependencies: {
      now?: () => Date
      createId?: () => string
    } = {},
  ) {}

  create(input: CreateArtifactInput): Artifact {
    const parsed = CreateArtifactInputSchema.parse(input)
    const id = this.dependencies.createId?.() ?? randomUUID()
    const now = this.now()
    this.database
      .prepare(
        `INSERT INTO artifacts (
          id, vault_id, knowledge_item_id, kind, storage_mode, path, real_path,
          mime_type, size, content_hash, last_seen_at, missing_since, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        parsed.vaultId,
        parsed.knowledgeItemId,
        parsed.kind,
        parsed.storageMode,
        parsed.path,
        parsed.realPath,
        parsed.mimeType,
        parsed.size,
        parsed.contentHash,
        parsed.lastSeenAt,
        parsed.missingSince,
        now,
        now,
      )
    return this.getById(id)!
  }

  getById(id: string): Artifact | undefined {
    const row = this.database
      .prepare('SELECT * FROM artifacts WHERE id = ?')
      .get(IdSchema.parse(id)) as ArtifactRow | undefined
    return row ? mapArtifact(row) : undefined
  }

  listByKnowledgeItem(knowledgeItemId: string): Artifact[] {
    return (
      this.database
        .prepare('SELECT * FROM artifacts WHERE knowledge_item_id = ? ORDER BY created_at')
        .all(IdSchema.parse(knowledgeItemId)) as ArtifactRow[]
    ).map(mapArtifact)
  }

  markSeen(id: string, details: { size?: number | null; contentHash?: string | null } = {}): Artifact | undefined {
    const parsedId = IdSchema.parse(id)
    const now = this.now()
    const result = this.database
      .prepare(
        `UPDATE artifacts SET
          size = COALESCE(?, size), content_hash = COALESCE(?, content_hash),
          last_seen_at = ?, missing_since = NULL, updated_at = ?
         WHERE id = ?`,
      )
      .run(details.size ?? null, details.contentHash ?? null, now, now, parsedId)
    return result.changes === 1 ? this.getById(parsedId) : undefined
  }

  markMissing(id: string): Artifact | undefined {
    const parsedId = IdSchema.parse(id)
    const now = this.now()
    const result = this.database
      .prepare(
        `UPDATE artifacts SET missing_since = COALESCE(missing_since, ?), updated_at = ? WHERE id = ?`,
      )
      .run(now, now, parsedId)
    return result.changes === 1 ? this.getById(parsedId) : undefined
  }

  private now(): string {
    return (this.dependencies.now?.() ?? new Date()).toISOString()
  }
}

function mapArtifact(row: ArtifactRow): Artifact {
  return ArtifactSchema.parse({
    id: row.id,
    vaultId: row.vault_id,
    knowledgeItemId: row.knowledge_item_id,
    kind: row.kind,
    storageMode: row.storage_mode,
    path: row.path,
    realPath: row.real_path,
    mimeType: row.mime_type,
    size: row.size,
    contentHash: row.content_hash,
    lastSeenAt: row.last_seen_at,
    missingSince: row.missing_since,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}
