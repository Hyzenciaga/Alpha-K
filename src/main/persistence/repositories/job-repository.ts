import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  EnqueueJobInputSchema,
  JobListFilterSchema,
  JobSchema,
  type EnqueueJobInput,
  type Job,
  type JobListFilter,
} from '../../../shared/domain/job.js'

type JobRow = {
  id: string
  vault_id: string | null
  type: string
  status: string
  priority: string
  idempotency_key: string | null
  payload_json: string
  attempt: number
  max_attempts: number
  scheduled_at: string | null
  run_after: string
  worker_id: string | null
  lease_expires_at: string | null
  heartbeat_at: string | null
  started_at: string | null
  finished_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export class JobRepository {
  constructor(
    private readonly database: Database.Database,
    private readonly dependencies: {
      now?: () => Date
      createId?: () => string
    } = {},
  ) {}

  enqueue(input: EnqueueJobInput): Job {
    const parsed = EnqueueJobInputSchema.parse(input)
    const now = this.now()
    const scheduledAt = parsed.scheduledAt ?? null
    const runAfter = parsed.runAfter ?? scheduledAt ?? now
    const status = scheduledAt && Date.parse(scheduledAt) > Date.parse(now) ? 'scheduled' : 'queued'

    return this.database.transaction(() => {
      if (parsed.idempotencyKey) {
        const existing = this.database
          .prepare('SELECT * FROM jobs WHERE type = ? AND idempotency_key = ?')
          .get(parsed.type, parsed.idempotencyKey) as JobRow | undefined
        if (existing) return mapJob(existing)
      }

      const id = this.dependencies.createId?.() ?? randomUUID()
      this.database
        .prepare(
          `INSERT INTO jobs (
            id, vault_id, type, status, priority, idempotency_key, payload_json,
            attempt, max_attempts, scheduled_at, run_after, worker_id,
            lease_expires_at, heartbeat_at, started_at, finished_at, last_error,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?)`,
        )
        .run(
          id,
          parsed.vaultId ?? null,
          parsed.type,
          status,
          parsed.priority,
          parsed.idempotencyKey ?? null,
          JSON.stringify(parsed.payload),
          parsed.maxAttempts,
          scheduledAt,
          runAfter,
          now,
          now,
        )
      return this.getById(id)!
    })()
  }

  getById(id: string): Job | undefined {
    const row = this.database.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as JobRow | undefined
    return row ? mapJob(row) : undefined
  }

  list(filter: JobListFilter = {}): Job[] {
    const parsed = JobListFilterSchema.parse(filter)
    const conditions: string[] = []
    const parameters: unknown[] = []
    if (parsed.vaultId !== undefined) {
      conditions.push(parsed.vaultId === null ? 'vault_id IS NULL' : 'vault_id = ?')
      if (parsed.vaultId !== null) parameters.push(parsed.vaultId)
    }
    if (parsed.statuses?.length) {
      conditions.push(`status IN (${parsed.statuses.map(() => '?').join(', ')})`)
      parameters.push(...parsed.statuses)
    }
    if (parsed.types?.length) {
      conditions.push(`type IN (${parsed.types.map(() => '?').join(', ')})`)
      parameters.push(...parsed.types)
    }
    parameters.push(parsed.limit, parsed.offset)
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const rows = this.database
      .prepare(`SELECT * FROM jobs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...parameters) as JobRow[]
    return rows.map(mapJob)
  }

  promoteDueScheduled(now = this.now()): number {
    return this.database
      .prepare(
        `UPDATE jobs
         SET status = 'queued', updated_at = ?
         WHERE status = 'scheduled' AND run_after <= ?`,
      )
      .run(now, now).changes
  }

  claimNext(workerId: string, leaseDurationMs: number): Job | undefined {
    if (!workerId.trim()) throw new Error('workerId is required.')
    if (!Number.isFinite(leaseDurationMs) || leaseDurationMs <= 0) {
      throw new Error('leaseDurationMs must be positive.')
    }
    return this.database.transaction(() => {
      const now = this.now()
      const candidate = this.database
        .prepare(
          `SELECT id FROM jobs
           WHERE status = 'queued' AND run_after <= ?
           ORDER BY
             CASE priority WHEN 'interactive' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
             run_after ASC,
             created_at ASC
           LIMIT 1`,
        )
        .get(now) as { id: string } | undefined
      if (!candidate) return undefined

      const leaseExpiresAt = new Date(Date.parse(now) + leaseDurationMs).toISOString()
      const result = this.database
        .prepare(
          `UPDATE jobs SET
            status = 'running',
            attempt = attempt + 1,
            worker_id = ?,
            lease_expires_at = ?,
            heartbeat_at = ?,
            started_at = COALESCE(started_at, ?),
            finished_at = NULL,
            updated_at = ?
           WHERE id = ? AND status = 'queued'`,
        )
        .run(workerId, leaseExpiresAt, now, now, now, candidate.id)
      return result.changes === 1 ? this.getById(candidate.id) : undefined
    }).immediate()
  }

  heartbeat(jobId: string, workerId: string, leaseDurationMs: number): Job | undefined {
    if (!workerId.trim()) throw new Error('workerId is required.')
    if (!Number.isFinite(leaseDurationMs) || leaseDurationMs <= 0) {
      throw new Error('leaseDurationMs must be positive.')
    }
    const now = this.now()
    const leaseExpiresAt = new Date(Date.parse(now) + leaseDurationMs).toISOString()
    const result = this.database
      .prepare(
        `UPDATE jobs SET heartbeat_at = ?, lease_expires_at = ?, updated_at = ?
         WHERE id = ? AND status = 'running' AND worker_id = ?`,
      )
      .run(now, leaseExpiresAt, now, jobId, workerId)
    return result.changes === 1 ? this.getById(jobId) : undefined
  }

  complete(jobId: string, workerId: string): Job | undefined {
    return this.finishRunning(jobId, workerId, 'succeeded', null)
  }

  fail(
    jobId: string,
    workerId: string,
    error: string,
    options: { retryable: boolean; retryAt?: string },
  ): Job | undefined {
    return this.database.transaction(() => {
      const job = this.getById(jobId)
      if (!job || job.status !== 'running' || job.workerId !== workerId) return undefined
      const now = this.now()
      if (options.retryable && job.attempt < job.maxAttempts) {
        this.database
          .prepare(
            `UPDATE jobs SET
              status = 'queued', run_after = ?, worker_id = NULL, lease_expires_at = NULL,
              heartbeat_at = NULL, finished_at = NULL, last_error = ?, updated_at = ?
             WHERE id = ? AND status = 'running' AND worker_id = ?`,
          )
          .run(options.retryAt ?? now, error, now, jobId, workerId)
      } else {
        this.finishRunning(jobId, workerId, 'failed', error)
      }
      return this.getById(jobId)
    })()
  }

  interruptExpired(now = this.now()): number {
    return this.database
      .prepare(
        `UPDATE jobs SET
          status = 'interrupted', worker_id = NULL, lease_expires_at = NULL,
          heartbeat_at = NULL, last_error = COALESCE(last_error, 'Worker lease expired.'), updated_at = ?
         WHERE status = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?`,
      )
      .run(now, now).changes
  }

  interruptAllRunning(reason = 'Application stopped while the Job was running.'): number {
    const now = this.now()
    return this.database
      .prepare(
        `UPDATE jobs SET
          status = 'interrupted', worker_id = NULL, lease_expires_at = NULL,
          heartbeat_at = NULL, last_error = ?, updated_at = ?
         WHERE status = 'running'`,
      )
      .run(reason, now).changes
  }

  recoverInterrupted(now = this.now()): { requeued: number; failed: number } {
    return this.database.transaction(() => {
      const requeued = this.database
        .prepare(
          `UPDATE jobs SET
            status = 'queued', run_after = ?, worker_id = NULL,
            lease_expires_at = NULL, heartbeat_at = NULL, updated_at = ?
           WHERE status = 'interrupted' AND attempt < max_attempts`,
        )
        .run(now, now).changes
      const failed = this.database
        .prepare(
          `UPDATE jobs SET status = 'failed', finished_at = ?, updated_at = ?
           WHERE status = 'interrupted' AND attempt >= max_attempts`,
        )
        .run(now, now).changes
      return { requeued, failed }
    })()
  }

  cancel(jobId: string): Job | undefined {
    const now = this.now()
    const result = this.database
      .prepare(
        `UPDATE jobs SET
          status = 'cancelled', worker_id = NULL, lease_expires_at = NULL,
          heartbeat_at = NULL, finished_at = ?, updated_at = ?
         WHERE id = ? AND status IN ('scheduled', 'queued', 'interrupted')`,
      )
      .run(now, now, jobId)
    return result.changes === 1 ? this.getById(jobId) : undefined
  }

  retry(jobId: string): Job | undefined {
    const now = this.now()
    const result = this.database
      .prepare(
        `UPDATE jobs SET
          status = 'queued', run_after = ?, finished_at = NULL, last_error = NULL, updated_at = ?
         WHERE id = ? AND status IN ('failed', 'interrupted') AND attempt < max_attempts`,
      )
      .run(now, now, jobId)
    return result.changes === 1 ? this.getById(jobId) : undefined
  }

  private finishRunning(
    jobId: string,
    workerId: string,
    status: 'succeeded' | 'failed',
    lastError: string | null,
  ): Job | undefined {
    const now = this.now()
    const result = this.database
      .prepare(
        `UPDATE jobs SET
          status = ?, worker_id = NULL, lease_expires_at = NULL, heartbeat_at = NULL,
          finished_at = ?, last_error = ?, updated_at = ?
         WHERE id = ? AND status = 'running' AND worker_id = ?`,
      )
      .run(status, now, lastError, now, jobId, workerId)
    return result.changes === 1 ? this.getById(jobId) : undefined
  }

  private now(): string {
    return (this.dependencies.now?.() ?? new Date()).toISOString()
  }
}

function mapJob(row: JobRow): Job {
  return JobSchema.parse({
    id: row.id,
    vaultId: row.vault_id,
    type: row.type,
    status: row.status,
    priority: row.priority,
    idempotencyKey: row.idempotency_key,
    payload: JSON.parse(row.payload_json) as unknown,
    attempt: row.attempt,
    maxAttempts: row.max_attempts,
    scheduledAt: row.scheduled_at,
    runAfter: row.run_after,
    workerId: row.worker_id,
    leaseExpiresAt: row.lease_expires_at,
    heartbeatAt: row.heartbeat_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}
