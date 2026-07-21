import type { Migration } from './types.js'

export const phaseZeroFtsMigration: Migration = {
  version: 2,
  name: 'phase-zero-fts',
  statements: [
    `CREATE VIRTUAL TABLE phase_zero_documents_fts USING fts5(
      title,
      body,
      tokenize='trigram'
    )`,
  ],
}
