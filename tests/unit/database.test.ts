import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { openAlphaKDatabase } from '../../src/main/persistence/database.js'

const cleanupPaths: string[] = []

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('database bootstrap', () => {
  it('runs versioned migrations and supports Chinese trigram search', () => {
    const directory = mkdtempSync(join(tmpdir(), 'alpha-k-db-'))
    cleanupPaths.push(directory)
    const path = join(directory, 'app.sqlite')

    const first = openAlphaKDatabase(path)
    expect(first.health).toMatchObject({ migrationVersion: 3, fts5: true, trigramChinese: true })
    first.close()

    const reopened = openAlphaKDatabase(path)
    expect(reopened.health.migrationVersion).toBe(3)
    reopened.close()
  })

  it('does not erase the persistent search index while probing database health', () => {
    const directory = mkdtempSync(join(tmpdir(), 'alpha-k-db-'))
    cleanupPaths.push(directory)
    const path = join(directory, 'app.sqlite')

    const first = openAlphaKDatabase(path)
    first.database
      .prepare(
        `INSERT INTO knowledge_items_fts
          (knowledge_item_id, title, summary, authors, labels)
          VALUES (?, ?, ?, ?, ?)`,
      )
      .run('persistent-item', '保留索引', '不能被健康检查删除', '', '')
    first.close()

    const reopened = openAlphaKDatabase(path)
    const row = reopened.database
      .prepare('SELECT knowledge_item_id FROM knowledge_items_fts WHERE knowledge_item_id = ?')
      .get('persistent-item') as { knowledge_item_id: string } | undefined
    expect(row?.knowledge_item_id).toBe('persistent-item')
    reopened.close()
  })
})
