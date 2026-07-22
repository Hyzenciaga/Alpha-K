import type Database from 'better-sqlite3'
import { VaultSchema, type Vault } from '../../../shared/domain/vault.js'
import type { InitializedVault } from '../../vault/vault-manager.js'

type VaultRow = {
  id: string
  path: string
  manifest_schema_version: number
  created_at: string
  updated_at: string
  last_opened_at: string
}

export class VaultRepository {
  constructor(
    private readonly database: Database.Database,
    private readonly now: () => Date = () => new Date(),
  ) {}

  registerAndActivate(initialized: InitializedVault): Vault {
    const timestamp = this.now().toISOString()
    return this.database.transaction(() => {
      this.database
        .prepare(
          `INSERT INTO vaults (
            id, path, manifest_schema_version, created_at, updated_at, last_opened_at
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            path = excluded.path,
            manifest_schema_version = excluded.manifest_schema_version,
            updated_at = excluded.updated_at,
            last_opened_at = excluded.last_opened_at`,
        )
        .run(
          initialized.manifest.vaultId,
          initialized.rootPath,
          initialized.manifest.schemaVersion,
          initialized.manifest.createdAt,
          timestamp,
          timestamp,
        )
      this.database
        .prepare(
          `INSERT INTO app_meta (key, value) VALUES ('active_vault_id', ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        )
        .run(initialized.manifest.vaultId)
      return this.getById(initialized.manifest.vaultId)!
    })()
  }

  getById(id: string): Vault | undefined {
    const row = this.database.prepare('SELECT * FROM vaults WHERE id = ?').get(id) as VaultRow | undefined
    return row ? mapVault(row) : undefined
  }

  getActive(): Vault | undefined {
    const row = this.database
      .prepare(
        `SELECT vaults.*
         FROM vaults
         JOIN app_meta ON app_meta.key = 'active_vault_id' AND app_meta.value = vaults.id`,
      )
      .get() as VaultRow | undefined
    return row ? mapVault(row) : undefined
  }

  list(): Vault[] {
    return (this.database.prepare('SELECT * FROM vaults ORDER BY last_opened_at DESC').all() as VaultRow[]).map(
      mapVault,
    )
  }
}

function mapVault(row: VaultRow): Vault {
  return VaultSchema.parse({
    id: row.id,
    path: row.path,
    manifestSchemaVersion: row.manifest_schema_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastOpenedAt: row.last_opened_at,
  })
}
