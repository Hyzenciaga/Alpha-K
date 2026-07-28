import { generateKeyPairSync, sign } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { canonicalManifestPayload, compareVersions, parseAndVerifyUpdateManifest } from '../../src/main/update/update-manifest.js'

describe('signed update manifest', () => {
  it('accepts a correctly signed manifest and rejects a modified asset', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519')
    const unsigned = {
      schemaVersion: 1 as const,
      version: '0.2.0',
      publishedAt: '2026-07-28T00:00:00.000Z',
      releaseNotes: 'A safer update.',
      asset: {
        name: 'Alpha-K-0.2.0-arm64.zip',
        url: 'https://github.com/Hyzenciaga/Alpha-K/releases/download/v0.2.0/Alpha-K-0.2.0-arm64.zip',
        sha256: 'a'.repeat(64),
        size: 1_024,
      },
    }
    const signature = sign(null, Buffer.from(canonicalManifestPayload(unsigned)), privateKey).toString('base64')
    const raw = JSON.stringify({ ...unsigned, signature })

    expect(parseAndVerifyUpdateManifest(raw, publicKey.export({ type: 'spki', format: 'pem' }).toString(), 'https://github.com/Hyzenciaga/Alpha-K/releases/download/')).toMatchObject({ version: '0.2.0' })
    expect(() => parseAndVerifyUpdateManifest(raw.replace('0.2.0-arm64', '0.2.1-arm64'), publicKey.export({ type: 'spki', format: 'pem' }).toString(), 'https://github.com/Hyzenciaga/Alpha-K/releases/download/')).toThrow('签名无效')
  })

  it('compares stable and prerelease versions predictably', () => {
    expect(compareVersions('0.2.0', '0.1.9')).toBeGreaterThan(0)
    expect(compareVersions('0.2.0', '0.2.0')).toBe(0)
    expect(compareVersions('0.2.0', '0.2.0-beta.1')).toBeGreaterThan(0)
  })
})
