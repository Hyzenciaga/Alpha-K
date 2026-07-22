import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { IpcMain } from 'electron'
import { afterEach, describe, expect, it } from 'vitest'
import { JobQueueService } from '../../src/main/application/job-queue-service.js'
import { VaultService } from '../../src/main/application/vault-service.js'
import { registerPhaseOneIpcHandlers } from '../../src/main/ipc/phase-one-handlers.js'
import { openAlphaKDatabase } from '../../src/main/persistence/database.js'
import { JobRepository } from '../../src/main/persistence/repositories/job-repository.js'
import { KnowledgeRepository } from '../../src/main/persistence/repositories/knowledge-repository.js'
import { VaultRepository } from '../../src/main/persistence/repositories/vault-repository.js'
import { PHASE_ONE_IPC_CHANNELS, type IpcResult } from '../../src/shared/ipc/phase-one.js'

const cleanupPaths: string[] = []
const JOB_ID = '21111111-1111-4111-8111-111111111111'

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('Phase 1 IPC handlers', () => {
  it('validates DTOs and exposes Job list and cancellation without leaking repositories', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'alpha-k-ipc-'))
    cleanupPaths.push(directory)
    const connection = openAlphaKDatabase(join(directory, 'app.sqlite'))
    const jobRepository = new JobRepository(connection.database, { createId: () => JOB_ID })
    const queued = jobRepository.enqueue({ type: 'index.rebuild', priority: 'background' })
    const jobs = new JobQueueService(jobRepository)
    const vaults = new VaultService(
      new VaultRepository(connection.database),
      new KnowledgeRepository(connection.database),
    )
    const ipc = new FakeIpcMain()
    const unregister = registerPhaseOneIpcHandlers({
      ipcMain: ipc as unknown as Pick<IpcMain, 'handle' | 'removeHandler'>,
      vaultService: vaults,
      jobQueueService: jobs,
      selectVaultDirectory: async () => undefined,
    })

    const listed = await ipc.invoke<IpcResult<Array<{ id: string }>>>(PHASE_ONE_IPC_CHANNELS.jobsList, {})
    expect(listed).toEqual({ ok: true, data: [expect.objectContaining({ id: queued.id })] })

    const invalid = await ipc.invoke<IpcResult<unknown>>(PHASE_ONE_IPC_CHANNELS.jobsCancel, {
      jobId: 'not-a-uuid',
    })
    expect(invalid).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })

    const cancelled = await ipc.invoke<IpcResult<{ status: string }>>(PHASE_ONE_IPC_CHANNELS.jobsCancel, {
      jobId: queued.id,
    })
    expect(cancelled).toMatchObject({ ok: true, data: { status: 'cancelled' } })

    unregister()
    expect(ipc.size).toBe(0)
    connection.close()
  })
})

type FakeHandler = (...args: unknown[]) => unknown

class FakeIpcMain {
  private readonly handlers = new Map<string, FakeHandler>()

  get size(): number {
    return this.handlers.size
  }

  handle(channel: string, handler: FakeHandler): void {
    this.handlers.set(channel, handler)
  }

  removeHandler(channel: string): void {
    this.handlers.delete(channel)
  }

  async invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
    const handler = this.handlers.get(channel)
    if (!handler) throw new Error(`No handler registered for ${channel}.`)
    return (await handler({}, ...args)) as T
  }
}
