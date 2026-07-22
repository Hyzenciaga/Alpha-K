import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { IdSchema } from '../../../shared/domain/common.js'
import {
  SyncRunListFilterSchema,
  SyncRunSchema,
  SyncRunStatusSchema,
  SyncRunTriggerSchema,
  type SyncRun,
  type SyncRunListFilter,
  type SyncRunStatus,
  type SyncRunTrigger,
} from '../../../shared/domain/sync-run.js'

type SyncRunRow = {
  id: string
  vault_id: string
  source_id: string
  job_id: string
  trigger: string
  status: string
  discovered_count: number
  created_count: number
  updated_count: number
  skipped_count: number
  error: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
  updated_at: string
}

export type SyncRunCounts = {
  discoveredCount: number
  createdCount: number
  updatedCount: number
  skippedCount: number
}

export class SyncRunRepository {
  constructor(
    private readonly database: Database.Database,
    private readonly dependencies: {
      now?: () => Date
      createId?: () => string
    } = {},
  ) {}

  create(input: {
    id?: string
    vaultId: string
    sourceId: string
    jobId: string
    trigger: SyncRunTrigger
  }): SyncRun {
    const id = IdSchema.parse(input.id ?? this.dependencies.createId?.() ?? randomUUID())
    const vaultId = IdSchema.parse(input.vaultId)
    const sourceId = IdSchema.parse(input.sourceId)
    const jobId = IdSchema.parse(input.jobId)
    const trigger = SyncRunTriggerSchema.parse(input.trigger)
    const now = this.now()
    this.database
      .prepare(
        `INSERT INTO source_sync_runs (
          id, vault_id, source_id, job_id, trigger, status,
          discovered_count, created_count, updated_count, skipped_count,
          error, started_at, finished_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'queued', 0, 0, 0, 0, NULL, NULL, NULL, ?, ?)`,
      )
      .run(id, vaultId, sourceId, jobId, trigger, now, now)
    return this.getById(id)!
  }

  getById(id: string): SyncRun | undefined {
    const row = this.database
      .prepare('SELECT * FROM source_sync_runs WHERE id = ?')
      .get(IdSchema.parse(id)) as SyncRunRow | undefined
    return row ? mapSyncRun(row) : undefined
  }

  getByJobId(jobId: string): SyncRun | undefined {
    const row = this.database
      .prepare('SELECT * FROM source_sync_runs WHERE job_id = ?')
      .get(IdSchema.parse(jobId)) as SyncRunRow | undefined
    return row ? mapSyncRun(row) : undefined
  }

  findActiveBySource(sourceId: string): SyncRun | undefined {
    const row = this.database
      .prepare(
        `SELECT * FROM source_sync_runs
         WHERE source_id = ? AND status IN ('queued', 'running', 'interrupted')
         ORDER BY created_at DESC LIMIT 1`,
      )
      .get(IdSchema.parse(sourceId)) as SyncRunRow | undefined
    return row ? mapSyncRun(row) : undefined
  }

  list(filter: SyncRunListFilter): SyncRun[] {
    const parsed = SyncRunListFilterSchema.parse(filter)
    const conditions = ['vault_id = ?']
    const parameters: unknown[] = [parsed.vaultId]
    if (parsed.sourceId) {
      conditions.push('source_id = ?')
      parameters.push(parsed.sourceId)
    }
    if (parsed.statuses?.length) {
      conditions.push(`status IN (${parsed.statuses.map(() => '?').join(', ')})`)
      parameters.push(...parsed.statuses)
    }
    parameters.push(parsed.limit, parsed.offset)
    const rows = this.database
      .prepare(
        `SELECT * FROM source_sync_runs
         WHERE ${conditions.join(' AND ')}
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...parameters) as SyncRunRow[]
    return rows.map(mapSyncRun)
  }

  markRunning(id: string): SyncRun | undefined {
    const now = this.now()
    const result = this.database
      .prepare(
        `UPDATE source_sync_runs SET
          status = 'running', started_at = COALESCE(started_at, ?),
          finished_at = NULL, error = NULL, updated_at = ?
         WHERE id = ? AND status IN ('queued', 'interrupted')`,
      )
      .run(now, now, IdSchema.parse(id))
    return result.changes === 1 ? this.getById(id) : undefined
  }

  recordProgress(id: string, counts: SyncRunCounts): SyncRun | undefined {
    validateCounts(counts, false)
    const now = this.now()
    const result = this.database
      .prepare(
        `UPDATE source_sync_runs SET
          discovered_count = ?, created_count = ?, updated_count = ?, skipped_count = ?, updated_at = ?
         WHERE id = ? AND status = 'running'`,
      )
      .run(
        counts.discoveredCount,
        counts.createdCount,
        counts.updatedCount,
        counts.skippedCount,
        now,
        IdSchema.parse(id),
      )
    return result.changes === 1 ? this.getById(id) : undefined
  }

  succeed(id: string, counts: SyncRunCounts): SyncRun | undefined {
    validateCounts(counts, true)
    return this.finish(id, 'succeeded', counts, null)
  }

  fail(id: string, error: string, counts: SyncRunCounts): SyncRun | undefined {
    if (!error.trim()) throw new Error('A failed SyncRun requires an error.')
    validateCounts(counts, false)
    return this.finish(id, 'failed', counts, error)
  }

  interrupt(id: string, error: string, counts: SyncRunCounts): SyncRun | undefined {
    if (!error.trim()) throw new Error('An interrupted SyncRun requires an error.')
    validateCounts(counts, false)
    return this.finish(id, 'interrupted', counts, error, false)
  }

  cancelByJobId(jobId: string): SyncRun | undefined {
    return this.transitionByJobId(jobId, 'cancelled', 'Sync cancelled.', true)
  }

  requeueByJobId(jobId: string): SyncRun | undefined {
    const now = this.now()
    const result = this.database
      .prepare(
        `UPDATE source_sync_runs SET status = 'queued', finished_at = NULL, updated_at = ?
         WHERE job_id = ? AND status = 'interrupted'`,
      )
      .run(now, IdSchema.parse(jobId))
    return result.changes === 1 ? this.getByJobId(jobId) : undefined
  }

  interruptAllRunning(reason = 'Application stopped while synchronization was running.'): number {
    const now = this.now()
    return this.database
      .prepare(
        `UPDATE source_sync_runs SET status = 'interrupted', error = ?, finished_at = NULL, updated_at = ?
         WHERE status = 'running'`,
      )
      .run(reason, now).changes
  }

  reconcileJobStatuses(): number {
    const now = this.now()
    return this.database.transaction(() => {
      let changes = 0
      changes += this.database
        .prepare(
          `UPDATE source_sync_runs SET status = 'queued', finished_at = NULL, updated_at = ?
           WHERE status IN ('running', 'interrupted')
             AND job_id IN (SELECT id FROM jobs WHERE status = 'queued')`,
        )
        .run(now).changes
      changes += this.database
        .prepare(
          `UPDATE source_sync_runs SET status = 'failed',
             error = COALESCE(error, (SELECT last_error FROM jobs WHERE jobs.id = source_sync_runs.job_id), 'Job failed.'),
             finished_at = COALESCE(finished_at, ?), updated_at = ?
           WHERE status IN ('queued', 'running', 'interrupted')
             AND job_id IN (SELECT id FROM jobs WHERE status = 'failed')`,
        )
        .run(now, now).changes
      changes += this.database
        .prepare(
          `UPDATE source_sync_runs SET status = 'cancelled', error = COALESCE(error, 'Sync cancelled.'),
             finished_at = COALESCE(finished_at, ?), updated_at = ?
           WHERE status IN ('queued', 'running', 'interrupted')
             AND job_id IN (SELECT id FROM jobs WHERE status = 'cancelled')`,
        )
        .run(now, now).changes
      return changes
    })()
  }

  private transitionByJobId(
    jobId: string,
    status: SyncRunStatus,
    error: string | null,
    finished: boolean,
  ): SyncRun | undefined {
    const parsedStatus = SyncRunStatusSchema.parse(status)
    const now = this.now()
    const result = this.database
      .prepare(
        `UPDATE source_sync_runs SET status = ?, error = ?, finished_at = ?, updated_at = ?
         WHERE job_id = ? AND status IN ('queued', 'running', 'interrupted')`,
      )
      .run(parsedStatus, error, finished ? now : null, now, IdSchema.parse(jobId))
    return result.changes === 1 ? this.getByJobId(jobId) : undefined
  }

  private finish(
    id: string,
    status: 'succeeded' | 'failed' | 'interrupted',
    counts: SyncRunCounts,
    error: string | null,
    finished = true,
  ): SyncRun | undefined {
    const now = this.now()
    const result = this.database
      .prepare(
        `UPDATE source_sync_runs SET
          status = ?, discovered_count = ?, created_count = ?, updated_count = ?, skipped_count = ?,
          error = ?, finished_at = ?, updated_at = ?
         WHERE id = ? AND status = 'running'`,
      )
      .run(
        status,
        counts.discoveredCount,
        counts.createdCount,
        counts.updatedCount,
        counts.skippedCount,
        error,
        finished ? now : null,
        now,
        IdSchema.parse(id),
      )
    return result.changes === 1 ? this.getById(id) : undefined
  }

  private now(): string {
    return (this.dependencies.now?.() ?? new Date()).toISOString()
  }
}

function validateCounts(counts: SyncRunCounts, requireBalanced: boolean): void {
  const values = Object.values(counts)
  if (values.some((value) => !Number.isInteger(value) || value < 0)) {
    throw new Error('SyncRun counters must be non-negative integers.')
  }
  const processed = counts.createdCount + counts.updatedCount + counts.skippedCount
  if (processed > counts.discoveredCount || (requireBalanced && processed !== counts.discoveredCount)) {
    throw new Error('SyncRun counters are inconsistent.')
  }
}

function mapSyncRun(row: SyncRunRow): SyncRun {
  return SyncRunSchema.parse({
    id: row.id,
    vaultId: row.vault_id,
    sourceId: row.source_id,
    jobId: row.job_id,
    trigger: row.trigger,
    status: row.status,
    discoveredCount: row.discovered_count,
    createdCount: row.created_count,
    updatedCount: row.updated_count,
    skippedCount: row.skipped_count,
    error: row.error,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}
