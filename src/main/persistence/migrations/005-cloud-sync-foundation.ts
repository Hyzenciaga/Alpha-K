import type { Migration } from './types.js'

export const cloudSyncFoundationMigration: Migration = {
  version: 5,
  name: 'cloud-sync-foundation',
  statements: [
    `CREATE TABLE knowledge_item_user_states (
      knowledge_item_id TEXT PRIMARY KEY REFERENCES knowledge_items(id) ON DELETE CASCADE,
      is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
      is_starred INTEGER NOT NULL DEFAULT 0 CHECK (is_starred IN (0, 1)),
      disposition TEXT CHECK (disposition IS NULL OR disposition IN ('accepted', 'ignored')),
      updated_at TEXT NOT NULL
    ) STRICT`,
    `CREATE INDEX knowledge_item_user_states_read_idx
      ON knowledge_item_user_states(is_read, updated_at DESC)`,
    `CREATE TABLE cloud_device_installation (
      singleton_key TEXT PRIMARY KEY CHECK (singleton_key = 'device'),
      device_id TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    ) STRICT`,
    `CREATE TABLE cloud_account_bindings (
      owner_id TEXT PRIMARY KEY,
      provider TEXT NOT NULL CHECK (provider = 'github'),
      email TEXT,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    ) STRICT`,
    `CREATE TABLE cloud_knowledge_bindings (
      owner_id TEXT NOT NULL,
      knowledge_item_id TEXT NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
      remote_ref_id TEXT NOT NULL,
      ref_key TEXT NOT NULL,
      materialized_at TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (owner_id, knowledge_item_id),
      UNIQUE (owner_id, remote_ref_id),
      UNIQUE (owner_id, ref_key)
    ) STRICT`,
    `CREATE TABLE cloud_sync_outbox (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      entity_type TEXT NOT NULL CHECK (entity_type IN ('knowledge_ref', 'user_knowledge_state')),
      entity_key TEXT NOT NULL,
      operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
      payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
      attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
      next_attempt_at TEXT NOT NULL,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT`,
    `CREATE UNIQUE INDEX cloud_sync_outbox_entity_unique
      ON cloud_sync_outbox(owner_id, entity_type, entity_key)`,
    `CREATE INDEX cloud_sync_outbox_claim_idx
      ON cloud_sync_outbox(owner_id, next_attempt_at, created_at)`,
    `CREATE TABLE cloud_sync_cursors (
      owner_id TEXT PRIMARY KEY,
      pull_sequence INTEGER NOT NULL DEFAULT 0 CHECK (pull_sequence >= 0),
      last_pushed_at TEXT,
      last_pulled_at TEXT,
      last_error TEXT,
      updated_at TEXT NOT NULL
    ) STRICT`,
  ],
}
