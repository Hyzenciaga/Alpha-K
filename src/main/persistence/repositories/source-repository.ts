import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { IdSchema } from '../../../shared/domain/common.js'
import {
  CreateSourceInputSchema,
  SourceSchema,
  UpdateSourceInputSchema,
  type CreateSourceInput,
  type Source,
  type UpdateSourceInput,
} from '../../../shared/domain/source.js'

type SourceRow = {
  id: string
  vault_id: string
  type: string
  name: string
  enabled: number
  schedule_json: string
  config_json: string
  default_labels_json: string
  workflow_id: string | null
  last_sync_at: string | null
  next_sync_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export class SourceRepository {
  constructor(
    private readonly database: Database.Database,
    private readonly dependencies: {
      now?: () => Date
      createId?: () => string
    } = {},
  ) {}

  create(input: CreateSourceInput): Source {
    const parsed = CreateSourceInputSchema.parse(input)
    const id = this.dependencies.createId?.() ?? randomUUID()
    const now = this.now()
    this.database
      .prepare(
        `INSERT INTO sources (
          id, vault_id, type, name, enabled, schedule_json, config_json,
          default_labels_json, workflow_id, last_sync_at, next_sync_at,
          last_error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`,
      )
      .run(
        id,
        parsed.vaultId,
        parsed.type,
        parsed.name,
        parsed.enabled ? 1 : 0,
        JSON.stringify(parsed.schedule),
        JSON.stringify(parsed.config),
        JSON.stringify(parsed.defaultLabels),
        parsed.workflowId,
        now,
        now,
      )
    return this.getById(id)!
  }

  getById(id: string): Source | undefined {
    const parsedId = IdSchema.parse(id)
    const row = this.database.prepare('SELECT * FROM sources WHERE id = ?').get(parsedId) as SourceRow | undefined
    return row ? mapSource(row) : undefined
  }

  listByVault(vaultId: string): Source[] {
    const parsedVaultId = IdSchema.parse(vaultId)
    return (
      this.database
        .prepare('SELECT * FROM sources WHERE vault_id = ? ORDER BY name COLLATE NOCASE, created_at')
        .all(parsedVaultId) as SourceRow[]
    ).map(mapSource)
  }

  update(id: string, input: UpdateSourceInput): Source | undefined {
    const parsedId = IdSchema.parse(id)
    const patch = UpdateSourceInputSchema.parse(input)
    const existing = this.getById(parsedId)
    if (!existing) return undefined
    const updated = {
      ...existing,
      ...patch,
      updatedAt: this.now(),
    }
    this.database
      .prepare(
        `UPDATE sources SET
          name = ?, enabled = ?, schedule_json = ?, config_json = ?,
          default_labels_json = ?, workflow_id = ?, next_sync_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        updated.name,
        updated.enabled ? 1 : 0,
        JSON.stringify(updated.schedule),
        JSON.stringify(updated.config),
        JSON.stringify(updated.defaultLabels),
        updated.workflowId,
        updated.nextSyncAt,
        updated.updatedAt,
        parsedId,
      )
    return this.getById(parsedId)
  }

  recordSyncResult(
    id: string,
    result: { error?: string; nextSyncAt?: string | null },
  ): Source | undefined {
    const parsedId = IdSchema.parse(id)
    const now = this.now()
    const update = this.database
      .prepare(
        `UPDATE sources SET
          last_sync_at = ?, next_sync_at = COALESCE(?, next_sync_at),
          last_error = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(now, result.nextSyncAt ?? null, result.error ?? null, now, parsedId)
    return update.changes === 1 ? this.getById(parsedId) : undefined
  }

  delete(id: string): boolean {
    return this.database.prepare('DELETE FROM sources WHERE id = ?').run(IdSchema.parse(id)).changes === 1
  }

  private now(): string {
    return (this.dependencies.now?.() ?? new Date()).toISOString()
  }
}

function mapSource(row: SourceRow): Source {
  return SourceSchema.parse({
    id: row.id,
    vaultId: row.vault_id,
    type: row.type,
    name: row.name,
    enabled: row.enabled === 1,
    schedule: JSON.parse(row.schedule_json) as unknown,
    config: JSON.parse(row.config_json) as unknown,
    defaultLabels: JSON.parse(row.default_labels_json) as unknown,
    workflowId: row.workflow_id,
    lastSyncAt: row.last_sync_at,
    nextSyncAt: row.next_sync_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}
