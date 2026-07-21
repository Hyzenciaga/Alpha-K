import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openAlphaKDatabase } from '../../src/main/persistence/database.js'
import { JobRepository } from '../../src/main/persistence/repositories/job-repository.js'
import { VaultRepository } from '../../src/main/persistence/repositories/vault-repository.js'

const cleanupPaths: string[] = []
const VAULT_ID = '11111111-1111-4111-8111-111111111111'
const JOB_IDS = [
  '21111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '23333333-3333-4333-8333-333333333333',
  '24444444-4444-4444-8444-444444444444',
]

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('JobRepository', () => {
  it('enqueues idempotently, claims by priority, heartbeats, and completes', () => {
    const fixture = createFixture()
    const normal = fixture.jobs.enqueue({
      vaultId: VAULT_ID,
      type: 'source.sync',
      payload: { sourceId: 'rss' },
      idempotencyKey: 'source:daily',
    })
    const duplicate = fixture.jobs.enqueue({
      vaultId: VAULT_ID,
      type: 'source.sync',
      payload: { sourceId: 'changed' },
      idempotencyKey: 'source:daily',
    })
    expect(duplicate.id).toBe(normal.id)

    const interactive = fixture.jobs.enqueue({
      vaultId: VAULT_ID,
      type: 'knowledge.query',
      priority: 'interactive',
    })
    const claimed = fixture.jobs.claimNext('worker-1', 30_000)
    expect(claimed).toMatchObject({ id: interactive.id, status: 'running', attempt: 1, workerId: 'worker-1' })

    fixture.advance(10_000)
    const heartbeat = fixture.jobs.heartbeat(interactive.id, 'worker-1', 30_000)
    expect(heartbeat?.leaseExpiresAt).toBe('2026-07-22T00:00:40.000Z')
    expect(fixture.jobs.complete(interactive.id, 'worker-1')?.status).toBe('succeeded')
    expect(fixture.jobs.claimNext('worker-1', 30_000)?.id).toBe(normal.id)
    expect(
      fixture.jobs.fail(normal.id, 'worker-1', 'Feed request failed.', { retryable: false }),
    ).toMatchObject({ status: 'failed', lastError: 'Feed request failed.' })
    fixture.close()
  })

  it('marks expired work interrupted and recovers retryable work', () => {
    const fixture = createFixture()
    const job = fixture.jobs.enqueue({ type: 'document.extract', maxAttempts: 2 })
    expect(fixture.jobs.claimNext('worker-1', 1_000)?.id).toBe(job.id)

    fixture.advance(1_001)
    expect(fixture.jobs.interruptExpired()).toBe(1)
    expect(fixture.jobs.getById(job.id)?.status).toBe('interrupted')
    expect(fixture.jobs.recoverInterrupted()).toEqual({ requeued: 1, failed: 0 })
    expect(fixture.jobs.getById(job.id)).toMatchObject({ status: 'queued', attempt: 1 })

    expect(fixture.jobs.claimNext('worker-2', 1_000)?.attempt).toBe(2)
    fixture.advance(1_001)
    expect(fixture.jobs.interruptExpired()).toBe(1)
    expect(fixture.jobs.recoverInterrupted()).toEqual({ requeued: 0, failed: 1 })
    expect(fixture.jobs.getById(job.id)?.status).toBe('failed')
    fixture.close()
  })
})

function createFixture(): {
  jobs: JobRepository
  advance: (milliseconds: number) => void
  close: () => void
} {
  const directory = mkdtempSync(join(tmpdir(), 'alpha-k-jobs-'))
  cleanupPaths.push(directory)
  const connection = openAlphaKDatabase(join(directory, 'app.sqlite'))
  let currentTime = Date.parse('2026-07-22T00:00:00.000Z')
  const now = (): Date => new Date(currentTime)
  new VaultRepository(connection.database, now).registerAndActivate({
    rootPath: join(directory, 'vault'),
    created: true,
    manifest: {
      schemaVersion: 1,
      vaultId: VAULT_ID,
      createdAt: now().toISOString(),
      updatedAt: now().toISOString(),
    },
  })
  let idIndex = 0
  return {
    jobs: new JobRepository(connection.database, { now, createId: () => JOB_IDS[idIndex++]! }),
    advance: (milliseconds) => {
      currentTime += milliseconds
    },
    close: connection.close,
  }
}
