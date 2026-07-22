import type { Migration } from './types.js'

export const cloudSyncCacheMigration: Migration = {
  version: 6,
  name: 'cloud-sync-cache',
  statements: [
    `ALTER TABLE cloud_sync_outbox
      ADD COLUMN local_knowledge_item_id TEXT REFERENCES knowledge_items(id) ON DELETE CASCADE`,
    `CREATE TABLE cloud_knowledge_ref_cache (
      owner_id TEXT NOT NULL,
      remote_ref_id TEXT NOT NULL,
      ref_key TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('rss', 'arxiv', 'url', 'file_hash')),
      source_key TEXT,
      external_id TEXT,
      canonical_url TEXT,
      content_hash TEXT,
      title TEXT NOT NULL,
      authors_json TEXT NOT NULL CHECK (json_valid(authors_json)),
      published_at TEXT,
      discovered_at TEXT NOT NULL,
      remote_updated_at TEXT NOT NULL,
      materialized_knowledge_item_id TEXT REFERENCES knowledge_items(id) ON DELETE SET NULL,
      PRIMARY KEY (owner_id, remote_ref_id),
      UNIQUE (owner_id, ref_key)
    ) STRICT`,
    `CREATE INDEX cloud_knowledge_ref_cache_materialized_idx
      ON cloud_knowledge_ref_cache(owner_id, materialized_knowledge_item_id)`,
    `CREATE TABLE cloud_user_state_cache (
      owner_id TEXT NOT NULL,
      remote_ref_id TEXT NOT NULL,
      is_read INTEGER NOT NULL CHECK (is_read IN (0, 1)),
      is_starred INTEGER NOT NULL CHECK (is_starred IN (0, 1)),
      disposition TEXT CHECK (disposition IS NULL OR disposition IN ('accepted', 'ignored')),
      remote_updated_at TEXT NOT NULL,
      PRIMARY KEY (owner_id, remote_ref_id),
      FOREIGN KEY (owner_id, remote_ref_id)
        REFERENCES cloud_knowledge_ref_cache(owner_id, remote_ref_id) ON DELETE CASCADE
    ) STRICT`,
  ],
}
