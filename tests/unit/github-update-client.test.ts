import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { GitHubUpdateClient } from '../../src/main/update/github-update-client.js'
import { canonicalManifestPayload } from '../../src/main/update/update-manifest.js'

const workspaces: string[] = []

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((workspace) => rm(workspace, { recursive: true, force: true })))
})

describe('GitHubUpdateClient', () => {
  it('downloads only an asset described by a valid signed manifest and verifies its SHA-256', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'alpha-k-update-client-'))
    workspaces.push(workspace)
    const { privateKey, publicKey } = generateKeyPairSync('ed25519')
    const archive = Buffer.from('verified Alpha-K archive')
    const manifest = unsignedManifest(createHash('sha256').update(archive).digest('hex'), archive.length)
    const rawManifest = JSON.stringify({
      ...manifest,
      signature: sign(null, Buffer.from(canonicalManifestPayload(manifest)), privateKey).toString('base64'),
    })
    const client = new GitHubUpdateClient({
      manifestUrl: 'https://github.com/Hyzenciaga/Alpha-K/releases/latest/download/latest.json',
      expectedAssetPrefix: 'https://github.com/Hyzenciaga/Alpha-K/releases/download/',
      publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      updateDirectory: join(workspace, 'downloads'),
      fetch: async (url) => url.endsWith('latest.json') ? new Response(rawManifest) : new Response(archive),
    })

    const release = await client.checkForUpdate()
    expect(release?.version).toBe('0.2.0')
    const downloaded = await client.downloadUpdate(release!, () => undefined)
    await expect(readFile(downloaded.archivePath)).resolves.toEqual(archive)
  })

  it('rejects a downloaded archive whose checksum differs from the signed manifest', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'alpha-k-update-client-'))
    workspaces.push(workspace)
    const { privateKey, publicKey } = generateKeyPairSync('ed25519')
    const manifest = unsignedManifest('a'.repeat(64), 5)
    const rawManifest = JSON.stringify({
      ...manifest,
      signature: sign(null, Buffer.from(canonicalManifestPayload(manifest)), privateKey).toString('base64'),
    })
    const client = new GitHubUpdateClient({
      manifestUrl: 'https://github.com/Hyzenciaga/Alpha-K/releases/latest/download/latest.json',
      expectedAssetPrefix: 'https://github.com/Hyzenciaga/Alpha-K/releases/download/',
      publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      updateDirectory: join(workspace, 'downloads'),
      fetch: async (url) => url.endsWith('latest.json') ? new Response(rawManifest) : new Response('wrong'),
    })

    const release = await client.checkForUpdate()
    await expect(client.downloadUpdate(release!, () => undefined)).rejects.toThrow('校验失败')
  })
})

function unsignedManifest(sha256: string, size: number) {
  return {
    schemaVersion: 1 as const,
    version: '0.2.0',
    publishedAt: '2026-07-28T00:00:00.000Z',
    releaseNotes: null,
    asset: {
      name: 'Alpha-K-0.2.0-arm64.zip',
      url: 'https://github.com/Hyzenciaga/Alpha-K/releases/download/v0.2.0/Alpha-K-0.2.0-arm64.zip',
      sha256,
      size,
    },
  }
}
