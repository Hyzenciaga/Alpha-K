import { mkdtempSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { VaultService } from '../../src/main/application/vault-service.js'
import { openAlphaKDatabase } from '../../src/main/persistence/database.js'
import { KnowledgeRepository } from '../../src/main/persistence/repositories/knowledge-repository.js'
import { VaultRepository } from '../../src/main/persistence/repositories/vault-repository.js'
import { writeAtomicJson } from '../../src/main/vault/atomic-writer.js'

const cleanupPaths: string[] = []
const ITEM_ID = '33333333-3333-4333-8333-333333333333'

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('VaultService', () => {
  it('restores the active Vault after restart', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'alpha-k-vault-service-'))
    cleanupPaths.push(directory)
    const vaultPath = join(directory, 'vault')
    const databasePath = join(directory, 'app.sqlite')
    await mkdir(vaultPath)

    const first = openAlphaKDatabase(databasePath)
    const firstService = createService(first.database)
    const selected = await firstService.initializeAndActivate(vaultPath)
    expect(selected.state).toBe('ready')
    first.close()

    const reopened = openAlphaKDatabase(databasePath)
    const restored = await createService(reopened.database).getConnection()
    expect(restored).toMatchObject({ state: 'ready', vault: { id: selected.vault?.id } })
    reopened.close()
  })

  it('rebuilds the basic search index from Vault metadata after SQLite is deleted', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'alpha-k-vault-rebuild-'))
    cleanupPaths.push(directory)
    const vaultPath = join(directory, 'vault')
    const databasePath = join(directory, 'app.sqlite')
    await mkdir(vaultPath)

    const first = openAlphaKDatabase(databasePath)
    const firstService = createService(first.database)
    await firstService.initializeAndActivate(vaultPath)
    await writeAtomicJson(vaultPath, `library/2026/${ITEM_ID}/metadata.json`, {
      schemaVersion: 1,
      id: ITEM_ID,
      title: '离线知识库',
      summary: 'SQLite 删除后仍可恢复搜索索引',
      authors: ['Alpha-K'],
      labels: ['本地优先'],
    })
    first.close()
    await rm(databasePath, { force: true })

    const rebuiltDatabase = openAlphaKDatabase(databasePath)
    const knowledge = new KnowledgeRepository(rebuiltDatabase.database)
    const rebuiltService = new VaultService(new VaultRepository(rebuiltDatabase.database), knowledge)
    await rebuiltService.initializeAndActivate(vaultPath)
    expect(await rebuiltService.rebuildActiveSearchIndex()).toEqual({ indexed: 1, skipped: 0, issues: [] })
    expect(knowledge.search('恢复搜索')).toEqual([
      expect.objectContaining({ knowledgeItemId: ITEM_ID, title: '离线知识库' }),
    ])
    rebuiltDatabase.close()
  })
})

function createService(database: Database.Database): VaultService {
  return new VaultService(new VaultRepository(database), new KnowledgeRepository(database))
}
