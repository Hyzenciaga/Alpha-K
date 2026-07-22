import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { access, lstat, mkdir, open, realpath, rename, unlink } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { VaultError } from './vault-errors.js'

export async function writeAtomicFile(
  vaultRoot: string,
  relativePath: string,
  content: string | Uint8Array,
): Promise<string> {
  const root = await realpath(vaultRoot)
  const target = resolveVaultPath(root, relativePath)
  await ensureControlledDirectory(root, relative(root, dirname(target)))
  await assertNotSymlink(target)

  const temporary = join(dirname(target), `.${basename(target)}.${randomUUID()}.tmp`)
  let handle
  try {
    handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600)
    await handle.writeFile(content)
    await handle.sync()
    await handle.close()
    handle = undefined
    await rename(temporary, target)
    await syncDirectory(dirname(target))
    return target
  } catch (error) {
    await handle?.close().catch(() => undefined)
    await unlink(temporary).catch(() => undefined)
    throw new VaultError('VAULT_IO_ERROR', `Failed to atomically write ${relativePath}.`, {
      cause: error,
    })
  }
}

export async function writeAtomicJson(
  vaultRoot: string,
  relativePath: string,
  value: unknown,
): Promise<string> {
  return writeAtomicFile(vaultRoot, relativePath, `${JSON.stringify(value, null, 2)}\n`)
}

export function resolveVaultPath(vaultRoot: string, relativePath: string): string {
  if (!relativePath || isAbsolute(relativePath)) {
    throw new VaultError('VAULT_UNSAFE_PATH', 'Vault paths must be non-empty relative paths.')
  }
  const root = resolve(vaultRoot)
  const target = resolve(root, relativePath)
  const relation = relative(root, target)
  if (relation === '..' || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
    throw new VaultError('VAULT_UNSAFE_PATH', `Path escapes the Vault root: ${relativePath}`)
  }
  return target
}

export async function ensureControlledDirectory(vaultRoot: string, relativeDirectory: string): Promise<string> {
  const root = await realpath(vaultRoot)
  if (!relativeDirectory || relativeDirectory === '.') return root
  const target = resolveVaultPath(root, relativeDirectory)
  const segments = relative(root, target).split(sep).filter(Boolean)
  let current = root
  for (const segment of segments) {
    current = join(current, segment)
    try {
      const stats = await lstat(current)
      if (stats.isSymbolicLink()) {
        throw new VaultError('VAULT_UNSAFE_PATH', `Vault directory contains a symlink: ${current}`)
      }
      if (!stats.isDirectory()) {
        throw new VaultError('VAULT_UNSAFE_PATH', `Vault path component is not a directory: ${current}`)
      }
    } catch (error) {
      if (error instanceof VaultError) throw error
      if (isNodeError(error) && error.code === 'ENOENT') {
        await mkdir(current)
      } else {
        throw new VaultError('VAULT_IO_ERROR', `Unable to prepare Vault directory: ${current}`, {
          cause: error,
        })
      }
    }
  }
  return target
}

async function assertNotSymlink(path: string): Promise<void> {
  try {
    if ((await lstat(path)).isSymbolicLink()) {
      throw new VaultError('VAULT_UNSAFE_PATH', `Refusing to replace a symlink: ${path}`)
    }
  } catch (error) {
    if (error instanceof VaultError) throw error
    if (!isNodeError(error) || error.code !== 'ENOENT') throw error
  }
}

async function syncDirectory(path: string): Promise<void> {
  try {
    await access(path, constants.R_OK)
    const handle = await open(path, constants.O_RDONLY)
    await handle.sync()
    await handle.close()
  } catch {
    // Some platforms do not allow fsync on directory handles.
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

