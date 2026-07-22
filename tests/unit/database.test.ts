import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { openAlphaKDatabase } from '../../src/main/persistence/database.js'
import { migrations } from '../../src/main/persistence/migrations/index.js'
import { SourceRepository } from '../../src/main/persistence/repositories/source-repository.js'

const VAULT_ID = '11111111-1111-4111-8111-111111111111'
const SOURCE_ID = '22222222-2222-4222-8222-222222222222'
const NOW = '2026-07-22T00:00:00.000Z'

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
    expect(first.health).toMatchObject({ migrationVersion: 5, fts5: true, trigramChinese: true })
    first.close()

    const reopened = openAlphaKDatabase(path)
    expect(reopened.health.migrationVersion).toBe(5)
    reopened.close()
  })

  it('normalizes the legacy RSS url key before strict Source parsing', () => {
    const directory = mkdtempSync(join(tmpdir(), 'alpha-k-db-'))
    cleanupPaths.push(directory)
    const path = join(directory, 'app.sqlite')
    const legacy = new Database(path)
    legacy.pragma('foreign_keys = ON')
    legacy.exec(
      `CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`,
    )
    for (const migration of migrations.filter(({ version }) => version <= 3)) {
      for (const statement of migration.statements) legacy.exec(statement)
      legacy.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
        migration.version,
        NOW,
      )
    }
    legacy
      .prepare(
        `INSERT INTO vaults
          (id, path, manifest_schema_version, created_at, updated_at, last_opened_at)
         VALUES (?, ?, 1, ?, ?, ?)`,
      )
      .run(VAULT_ID, join(directory, 'vault'), NOW, NOW, NOW)
    legacy
      .prepare(
        `INSERT INTO sources (
          id, vault_id, type, name, enabled, schedule_json, config_json,
          default_labels_json, workflow_id, last_sync_at, next_sync_at,
          last_error, created_at, updated_at
        ) VALUES (?, ?, 'rss', 'Legacy', 1, ?, ?, '[]', NULL, NULL, NULL, NULL, ?, ?)`,
      )
      .run(
        SOURCE_ID,
        VAULT_ID,
        JSON.stringify({ kind: 'interval', minutes: 60 }),
        JSON.stringify({ url: 'https://example.com/legacy.xml' }),
        NOW,
        NOW,
      )
    legacy.close()

    const migrated = openAlphaKDatabase(path)
    expect(new SourceRepository(migrated.database).getById(SOURCE_ID)).toMatchObject({
      config: { feedUrl: 'https://example.com/legacy.xml' },
    })
    const config = migrated.database
      .prepare('SELECT config_json FROM sources WHERE id = ?')
      .get(SOURCE_ID) as { config_json: string }
    expect(JSON.parse(config.config_json)).not.toHaveProperty('url')
    migrated.close()
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
