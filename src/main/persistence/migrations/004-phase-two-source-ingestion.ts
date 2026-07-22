import type { Migration } from './types.js'

export const phaseTwoSourceIngestionMigration: Migration = {
  version: 4,
  name: 'phase-two-source-ingestion',
  statements: [
    `UPDATE sources
     SET config_json = json_set(
       json_remove(config_json, '$.url'),
       '$.feedUrl',
       COALESCE(json_extract(config_json, '$.feedUrl'), json_extract(config_json, '$.url'))
     )
     WHERE type = 'rss'
       AND json_type(config_json, '$.url') = 'text'`,
    `CREATE TABLE source_sync_runs (
      id TEXT PRIMARY KEY,
      vault_id TEXT NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      job_id TEXT NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
      trigger TEXT NOT NULL CHECK (trigger IN ('manual', 'scheduled', 'missed_schedule')),
      status TEXT NOT NULL CHECK (status IN (
        'queued', 'running', 'succeeded', 'failed', 'interrupted', 'cancelled'
      )),
      discovered_count INTEGER NOT NULL DEFAULT 0 CHECK (discovered_count >= 0),
      created_count INTEGER NOT NULL DEFAULT 0 CHECK (created_count >= 0),
      updated_count INTEGER NOT NULL DEFAULT 0 CHECK (updated_count >= 0),
      skipped_count INTEGER NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
      error TEXT,
      started_at TEXT,
      finished_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT`,
    `CREATE UNIQUE INDEX source_sync_runs_active_source_unique
      ON source_sync_runs(source_id)
      WHERE status IN ('queued', 'running', 'interrupted')`,
    `CREATE INDEX source_sync_runs_vault_created_idx
      ON source_sync_runs(vault_id, created_at DESC)`,
    `CREATE INDEX source_sync_runs_source_created_idx
      ON source_sync_runs(source_id, created_at DESC)`,
    `CREATE INDEX knowledge_items_source_canonical_idx
      ON knowledge_items(source_id, canonical_url)
      WHERE canonical_url IS NOT NULL`,
    `CREATE INDEX knowledge_items_source_content_hash_idx
      ON knowledge_items(source_id, content_hash)
      WHERE content_hash IS NOT NULL`,
  ],
}
