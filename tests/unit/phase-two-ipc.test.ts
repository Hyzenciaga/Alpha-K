import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { IpcMain } from 'electron'
import { afterEach, describe, expect, it } from 'vitest'
import { SourceService } from '../../src/main/application/source-service.js'
import { RssConnector } from '../../src/main/connectors/rss-connector.js'
import { registerPhaseTwoIpcHandlers } from '../../src/main/ipc/phase-two-handlers.js'
import { openAlphaKDatabase } from '../../src/main/persistence/database.js'
import { JobRepository } from '../../src/main/persistence/repositories/job-repository.js'
import { KnowledgeRepository } from '../../src/main/persistence/repositories/knowledge-repository.js'
import { SourceRepository } from '../../src/main/persistence/repositories/source-repository.js'
import { SyncRunRepository } from '../../src/main/persistence/repositories/sync-run-repository.js'
import { VaultRepository } from '../../src/main/persistence/repositories/vault-repository.js'
import { PHASE_TWO_IPC_CHANNELS } from '../../src/shared/ipc/phase-two-contract.js'
import type { IpcResult } from '../../src/shared/ipc/common-contract.js'

const cleanupPaths: string[] = []
const VAULT_ID = '11111111-1111-4111-8111-111111111111'
const SOURCE_IDS = [
  '22222222-2222-4222-8222-222222222222',
  '23333333-3333-4333-8333-333333333333',
]
const NOW = new Date('2026-07-22T00:00:00.000Z')

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('Phase 2 IPC handlers', () => {
  it('validates every request and returns stable success and error envelopes', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'alpha-k-phase-two-ipc-'))
    cleanupPaths.push(directory)
    const connection = openAlphaKDatabase(join(directory, 'app.sqlite'))
    const now = () => NOW
    new VaultRepository(connection.database, now).registerAndActivate({
      rootPath: join(directory, 'vault'),
      created: true,
      manifest: {
        schemaVersion: 1,
        vaultId: VAULT_ID,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
    })
    let sourceIdIndex = 0
    const sourceRepository = new SourceRepository(connection.database, {
      now,
      createId: () => SOURCE_IDS[sourceIdIndex++]!,
    })
    const sourceService = new SourceService({
      database: connection.database,
      sourceRepository,
      syncRunRepository: new SyncRunRepository(connection.database, { now }),
      jobRepository: new JobRepository(connection.database, { now }),
      knowledgeRepository: new KnowledgeRepository(connection.database, { now }),
      rssConnector: new RssConnector({
        now,
        fetch: async () =>
          new Response(
            '<?xml version="1.0"?><rss><channel><title>Preview</title></channel></rss>',
            { status: 200 },
          ),
      }),
    })
    const ipc = new FakeIpcMain()
    const unregister = registerPhaseTwoIpcHandlers({
      ipcMain: ipc as unknown as Pick<IpcMain, 'handle' | 'removeHandler'>,
      sourceService,
    })
    expect(ipc.size).toBe(Object.keys(PHASE_TWO_IPC_CHANNELS).length)

    const invalid = await ipc.invoke<IpcResult<unknown>>(PHASE_TWO_IPC_CHANNELS.sourcesList, {})
    expect(invalid).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })

    const invalidConfig = await ipc.invoke<IpcResult<unknown>>(
      PHASE_TWO_IPC_CHANNELS.sourcesCreate,
      rssInput('ftp://example.com/feed.xml'),
    )
    expect(invalidConfig).toMatchObject({
      ok: false,
      error: { code: 'SOURCE_INVALID_CONFIG' },
    })

    const created = await ipc.invoke<IpcResult<{ id: string }>>(
      PHASE_TWO_IPC_CHANNELS.sourcesCreate,
      rssInput('https://example.com/feed.xml'),
    )
    expect(created).toEqual({ ok: true, data: expect.objectContaining({ id: SOURCE_IDS[0] }) })

    const listed = await ipc.invoke<IpcResult<Array<{ id: string }>>>(
      PHASE_TWO_IPC_CHANNELS.sourcesList,
      { vaultId: VAULT_ID, types: ['rss'], enabled: true },
    )
    expect(listed).toEqual({ ok: true, data: [expect.objectContaining({ id: SOURCE_IDS[0] })] })
    const updated = await ipc.invoke<IpcResult<{ name: string }>>(
      PHASE_TWO_IPC_CHANNELS.sourcesUpdate,
      { sourceId: SOURCE_IDS[0], input: { type: 'rss', name: 'Updated Research' } },
    )
    expect(updated).toEqual({ ok: true, data: expect.objectContaining({ name: 'Updated Research' }) })
    const wrongType = await ipc.invoke<IpcResult<unknown>>(
      PHASE_TWO_IPC_CHANNELS.sourcesUpdate,
      { sourceId: SOURCE_IDS[0], input: { type: 'arxiv' } },
    )
    expect(wrongType).toMatchObject({
      ok: false,
      error: { code: 'SOURCE_INVALID_CONFIG' },
    })

    const disposable = await ipc.invoke<IpcResult<{ id: string }>>(
      PHASE_TWO_IPC_CHANNELS.sourcesCreate,
      rssInput('https://example.com/disposable.xml'),
    )
    expect(disposable).toMatchObject({ ok: true, data: { id: SOURCE_IDS[1] } })
    const deleted = await ipc.invoke<IpcResult<{ sourceId: string }>>(
      PHASE_TWO_IPC_CHANNELS.sourcesDelete,
      { sourceId: SOURCE_IDS[1] },
    )
    expect(deleted).toEqual({ ok: true, data: { sourceId: SOURCE_IDS[1] } })

    const preview = await ipc.invoke<IpcResult<{ title: string; items: unknown[] }>>(
      PHASE_TWO_IPC_CHANNELS.sourcesPreview,
      rssInput('https://example.com/feed.xml'),
    )
    expect(preview).toEqual({ ok: true, data: expect.objectContaining({ title: 'Preview', items: [] }) })

    const sync = await ipc.invoke<IpcResult<{ job: { status: string }; syncRun: { status: string } }>>(
      PHASE_TWO_IPC_CHANNELS.sourcesSync,
      { sourceId: SOURCE_IDS[0] },
    )
    expect(sync).toEqual({
      ok: true,
      data: {
        job: expect.objectContaining({ status: 'queued' }),
        syncRun: expect.objectContaining({ status: 'queued' }),
      },
    })
    const conflict = await ipc.invoke<IpcResult<unknown>>(PHASE_TWO_IPC_CHANNELS.sourcesSync, {
      sourceId: SOURCE_IDS[0],
    })
    expect(conflict).toMatchObject({ ok: false, error: { code: 'SYNC_CONFLICT' } })

    const runs = await ipc.invoke<IpcResult<unknown[]>>(PHASE_TWO_IPC_CHANNELS.syncRunsList, {
      vaultId: VAULT_ID,
    })
    expect(runs).toEqual({ ok: true, data: [expect.objectContaining({ status: 'queued' })] })
    const inbox = await ipc.invoke<IpcResult<unknown[]>>(PHASE_TWO_IPC_CHANNELS.inboxList, {
      vaultId: VAULT_ID,
    })
    expect(inbox).toEqual({ ok: true, data: [] })

    const unsupported = await ipc.invoke<IpcResult<unknown>>(
      PHASE_TWO_IPC_CHANNELS.sourcesPreview,
      {
        vaultId: VAULT_ID,
        type: 'arxiv',
        name: 'arXiv',
        schedule: { kind: 'interval', minutes: 60 },
        config: { query: 'cat:cs.AI' },
      },
    )
    expect(unsupported).toMatchObject({ ok: false, error: { code: 'SOURCE_UNSUPPORTED' } })

    unregister()
    expect(ipc.size).toBe(0)
    connection.close()
  })
})

function rssInput(feedUrl: string) {
  return {
    vaultId: VAULT_ID,
    type: 'rss',
    name: 'Research',
    schedule: { kind: 'interval', minutes: 60 },
    config: { feedUrl },
  }
}

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
