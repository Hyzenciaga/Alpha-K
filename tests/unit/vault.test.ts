import { mkdtempSync } from 'node:fs'
import { lstat, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveVaultPath, writeAtomicFile } from '../../src/main/vault/atomic-writer.js'
import { hashFileSha256 } from '../../src/main/vault/file-hash.js'
import { initializeVault, loadVault } from '../../src/main/vault/vault-manager.js'
import { VaultError } from '../../src/main/vault/vault-errors.js'

const cleanupPaths: string[] = []
const VAULT_ID = '11111111-1111-4111-8111-111111111111'
const NOW = new Date('2026-07-22T00:00:00.000Z')

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('Vault lifecycle', () => {
  it('initializes the manifest and required directories, then loads the same Vault', async () => {
    const root = mkdtempSync(join(tmpdir(), 'alpha-k-vault-'))
    cleanupPaths.push(root)

    const initialized = await initializeVault(root, { now: () => NOW, createId: () => VAULT_ID })
    expect(initialized).toMatchObject({ rootPath: await realpath(root), created: true })
    expect(initialized.manifest).toEqual({
      schemaVersion: 1,
      vaultId: VAULT_ID,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    })
    expect((await lstat(join(root, 'reports/weekly'))).isDirectory()).toBe(true)

    const loaded = await loadVault(root)
    expect(loaded).toMatchObject({ created: false, manifest: initialized.manifest })
  })

  it('rejects path traversal and symlinked controlled directories', async () => {
    const root = mkdtempSync(join(tmpdir(), 'alpha-k-vault-'))
    const outside = mkdtempSync(join(tmpdir(), 'alpha-k-outside-'))
    cleanupPaths.push(root, outside)
    expect(() => resolveVaultPath(root, '../outside.txt')).toThrowError(VaultError)

    await mkdir(join(root, 'inbox'))
    await symlink(outside, join(root, 'inbox/rss'))
    await expect(initializeVault(root, { now: () => NOW, createId: () => VAULT_ID })).rejects.toMatchObject({
      code: 'VAULT_UNSAFE_PATH',
    })
  })

  it('publishes an atomic file and calculates its SHA-256 hash', async () => {
    const root = mkdtempSync(join(tmpdir(), 'alpha-k-vault-'))
    cleanupPaths.push(root)
    await initializeVault(root, { now: () => NOW, createId: () => VAULT_ID })

    const path = await writeAtomicFile(root, 'library/2026/note.txt', 'Alpha-K')
    expect(await readFile(path, 'utf8')).toBe('Alpha-K')
    expect(await hashFileSha256(path)).toBe('379029a4809cfef54d96749481f6bd317f867a95bebc955fdc754aa7fa270770')

    await writeFile(join(root, 'target.txt'), 'outside')
    await symlink(join(root, 'target.txt'), join(root, 'library/link.txt'))
    await expect(writeAtomicFile(root, 'library/link.txt', 'replacement')).rejects.toMatchObject({
      code: 'VAULT_UNSAFE_PATH',
    })
  })
})
