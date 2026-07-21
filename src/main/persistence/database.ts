import Database from 'better-sqlite3'
import type { DatabaseHealth } from '../../shared/contracts.js'

type Migration = {
  version: number
  statements: string[]
}

const migrations: Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
      `CREATE TABLE phase_zero_documents (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL
      )`,
    ],
  },
  {
    version: 2,
    statements: [
      `CREATE VIRTUAL TABLE phase_zero_documents_fts USING fts5(
        title,
        body,
        tokenize='trigram'
      )`,
    ],
  },
]

export type AlphaKDatabase = {
  database: Database.Database
  health: DatabaseHealth
  close: () => void
}

export function openAlphaKDatabase(path: string): AlphaKDatabase {
  const database = new Database(path)
  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `)

  applyMigrations(database)
  const migrationVersion = getMigrationVersion(database)
  const probe = probeFts(database)

  return {
    database,
    health: {
      path,
      migrationVersion,
      fts5: probe.fts5,
      trigramChinese: probe.trigramChinese,
      error: probe.error,
    },
    close: () => database.close(),
  }
}

function applyMigrations(database: Database.Database): void {
  const applied = new Set(
    database
      .prepare('SELECT version FROM schema_migrations ORDER BY version')
      .all()
      .map((row) => (row as { version: number }).version),
  )

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue

    database.transaction(() => {
      for (const statement of migration.statements) database.exec(statement)
      database
        .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
        .run(migration.version, new Date().toISOString())
    })()
  }
}

function getMigrationVersion(database: Database.Database): number {
  const row = database
    .prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations')
    .get() as { version: number }
  return row.version
}

function probeFts(database: Database.Database): {
  fts5: boolean
  trigramChinese: boolean
  error?: string
} {
  try {
    database.exec('DELETE FROM phase_zero_documents_fts')
    database
      .prepare('INSERT INTO phase_zero_documents_fts (title, body) VALUES (?, ?)')
      .run('Phase 0', '本地 Agent 驱动的知识管理客户端')
    const result = database
      .prepare("SELECT COUNT(*) AS count FROM phase_zero_documents_fts WHERE phase_zero_documents_fts MATCH '知识管理'")
      .get() as { count: number }
    database.exec('DELETE FROM phase_zero_documents_fts')
    return { fts5: true, trigramChinese: result.count === 1 }
  } catch (error) {
    return {
      fts5: false,
      trigramChinese: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
