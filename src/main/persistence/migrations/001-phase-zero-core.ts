import type { Migration } from './types.js'

export const phaseZeroCoreMigration: Migration = {
  version: 1,
  name: 'phase-zero-core',
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
}
