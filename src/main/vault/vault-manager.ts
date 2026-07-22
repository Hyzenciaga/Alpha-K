import { randomUUID } from 'node:crypto'
import { readFile, realpath } from 'node:fs/promises'
import { join } from 'node:path'
import {
  VAULT_MANIFEST_FILENAME,
  VAULT_SCHEMA_VERSION,
  VaultManifestSchema,
  type VaultManifest,
} from '../../shared/domain/vault.js'
import { ensureControlledDirectory, writeAtomicJson } from './atomic-writer.js'
import { VaultError } from './vault-errors.js'

const REQUIRED_DIRECTORIES = [
  'inbox/rss',
  'inbox/arxiv',
  'inbox/external',
  'library',
  'collections',
  'reports/daily',
  'reports/weekly',
  'reports/topics',
  'attachments',
] as const

export type InitializedVault = {
  rootPath: string
  manifest: VaultManifest
  created: boolean
}

export async function initializeVault(
  selectedPath: string,
  dependencies: {
    now?: () => Date
    createId?: () => string
  } = {},
): Promise<InitializedVault> {
  const rootPath = await resolveSelectedDirectory(selectedPath)
  const existing = await readManifestIfPresent(rootPath)
  const now = dependencies.now?.() ?? new Date()
  const manifest: VaultManifest =
    existing ?? {
      schemaVersion: VAULT_SCHEMA_VERSION,
      vaultId: dependencies.createId?.() ?? randomUUID(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }

  for (const directory of REQUIRED_DIRECTORIES) {
    await ensureControlledDirectory(rootPath, directory)
  }
  if (!existing) await writeAtomicJson(rootPath, VAULT_MANIFEST_FILENAME, manifest)
  return { rootPath, manifest, created: existing === undefined }
}

export async function loadVault(selectedPath: string): Promise<InitializedVault> {
  const rootPath = await resolveSelectedDirectory(selectedPath)
  const manifest = await readManifestIfPresent(rootPath)
  if (!manifest) {
    throw new VaultError('VAULT_NOT_FOUND', `${VAULT_MANIFEST_FILENAME} was not found in ${rootPath}.`)
  }
  return { rootPath, manifest, created: false }
}

async function readManifestIfPresent(rootPath: string): Promise<VaultManifest | undefined> {
  const manifestPath = join(rootPath, VAULT_MANIFEST_FILENAME)
  try {
    const raw = JSON.parse(await readFile(manifestPath, 'utf8')) as unknown
    const version =
      raw && typeof raw === 'object' && 'schemaVersion' in raw ? (raw as { schemaVersion?: unknown }).schemaVersion : undefined
    if (version !== undefined && version !== VAULT_SCHEMA_VERSION) {
      throw new VaultError('VAULT_UNSUPPORTED_SCHEMA', `Unsupported Vault schema version: ${String(version)}.`)
    }
    const parsed = VaultManifestSchema.safeParse(raw)
    if (!parsed.success) {
      throw new VaultError('VAULT_INVALID_MANIFEST', `Invalid ${VAULT_MANIFEST_FILENAME}.`, {
        cause: parsed.error,
      })
    }
    return parsed.data
  } catch (error) {
    if (error instanceof VaultError) throw error
    if (isNodeError(error) && error.code === 'ENOENT') return undefined
    throw new VaultError('VAULT_INVALID_MANIFEST', `Unable to read ${manifestPath}.`, { cause: error })
  }
}

async function resolveSelectedDirectory(selectedPath: string): Promise<string> {
  if (!selectedPath.trim()) throw new VaultError('VAULT_NOT_FOUND', 'Vault path is required.')
  try {
    return await realpath(selectedPath)
  } catch (error) {
    throw new VaultError('VAULT_NOT_FOUND', `Vault directory does not exist: ${selectedPath}`, {
      cause: error,
    })
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
