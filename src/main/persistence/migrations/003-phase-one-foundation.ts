import type { Migration } from './types.js'

export const phaseOneFoundationMigration: Migration = {
  version: 3,
  name: 'phase-one-foundation',
  statements: [
    `CREATE TABLE vaults (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      manifest_schema_version INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_opened_at TEXT NOT NULL
    ) STRICT`,
    `CREATE TABLE sources (
      id TEXT PRIMARY KEY,
      vault_id TEXT NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('rss', 'arxiv', 'directory')),
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
      schedule_json TEXT NOT NULL CHECK (json_valid(schedule_json)),
      config_json TEXT NOT NULL CHECK (json_valid(config_json)),
      default_labels_json TEXT NOT NULL CHECK (json_valid(default_labels_json)),
      workflow_id TEXT,
      last_sync_at TEXT,
      next_sync_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT`,
    `CREATE TABLE knowledge_items (
      id TEXT PRIMARY KEY,
      vault_id TEXT NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
      external_id TEXT,
      canonical_url TEXT,
      title TEXT NOT NULL,
      authors_json TEXT NOT NULL CHECK (json_valid(authors_json)),
      published_at TEXT,
      fetched_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN (
        'discovered', 'fetched', 'extracted', 'analysis_queued',
        'review_required', 'accepted', 'ignored', 'failed'
      )),
      primary_artifact_id TEXT,
      content_hash TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT`,
    `CREATE UNIQUE INDEX knowledge_items_source_external_unique
      ON knowledge_items(source_id, external_id)
      WHERE external_id IS NOT NULL`,
    `CREATE INDEX knowledge_items_canonical_url_idx ON knowledge_items(canonical_url)`,
    `CREATE INDEX knowledge_items_status_idx ON knowledge_items(vault_id, status, fetched_at DESC)`,
    `CREATE TABLE artifacts (
      id TEXT PRIMARY KEY,
      vault_id TEXT NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
      knowledge_item_id TEXT NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('markdown', 'pdf', 'html', 'text', 'external_reference')),
      storage_mode TEXT NOT NULL CHECK (storage_mode IN ('managed', 'copy', 'symlink', 'reference')),
      path TEXT NOT NULL,
      real_path TEXT,
      mime_type TEXT,
      size INTEGER CHECK (size IS NULL OR size >= 0),
      content_hash TEXT,
      last_seen_at TEXT,
      missing_since TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT`,
    `CREATE INDEX artifacts_knowledge_item_idx ON artifacts(knowledge_item_id)`,
    `CREATE INDEX artifacts_content_hash_idx ON artifacts(content_hash)`,
    `CREATE TABLE jobs (
      id TEXT PRIMARY KEY,
      vault_id TEXT REFERENCES vaults(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN (
        'source.sync', 'document.extract', 'document.preannotate', 'knowledge.query',
        'collection.summarize', 'report.daily', 'report.weekly', 'external.scan',
        'external.analyze', 'index.rebuild'
      )),
      status TEXT NOT NULL CHECK (status IN (
        'scheduled', 'queued', 'running', 'succeeded', 'failed', 'interrupted', 'cancelled'
      )),
      priority TEXT NOT NULL CHECK (priority IN ('interactive', 'normal', 'background')),
      idempotency_key TEXT,
      payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
      attempt INTEGER NOT NULL DEFAULT 0 CHECK (attempt >= 0),
      max_attempts INTEGER NOT NULL CHECK (max_attempts > 0),
      scheduled_at TEXT,
      run_after TEXT NOT NULL,
      worker_id TEXT,
      lease_expires_at TEXT,
      heartbeat_at TEXT,
      started_at TEXT,
      finished_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT`,
    `CREATE UNIQUE INDEX jobs_idempotency_unique
      ON jobs(type, idempotency_key)
      WHERE idempotency_key IS NOT NULL`,
    `CREATE INDEX jobs_claim_idx ON jobs(status, run_after, priority, created_at)`,
    `CREATE INDEX jobs_lease_idx ON jobs(status, lease_expires_at)`,
    `CREATE INDEX jobs_vault_created_idx ON jobs(vault_id, created_at DESC)`,
    `CREATE TABLE file_operations (
      id TEXT PRIMARY KEY,
      vault_id TEXT NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('write', 'move', 'delete')),
      status TEXT NOT NULL CHECK (status IN ('prepared', 'published', 'committed', 'failed')),
      temporary_path TEXT,
      target_path TEXT NOT NULL,
      content_hash TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT`,
    `CREATE INDEX file_operations_recovery_idx ON file_operations(status, updated_at)`,
    `CREATE VIRTUAL TABLE knowledge_items_fts USING fts5(
      knowledge_item_id UNINDEXED,
      title,
      summary,
      authors,
      labels,
      tokenize='trigram'
    )`,
  ],
}
