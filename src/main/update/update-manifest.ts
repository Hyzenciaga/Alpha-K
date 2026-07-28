import { createPublicKey, verify } from 'node:crypto'

export type SignedUpdateManifest = {
  schemaVersion: 1
  version: string
  publishedAt: string
  releaseNotes: string | null
  asset: {
    name: string
    url: string
    sha256: string
    size: number
  }
  signature: string
}

export type VerifiedUpdateRelease = Omit<SignedUpdateManifest, 'signature'>

const MAX_MANIFEST_BYTES = 64 * 1024
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/

export function parseAndVerifyUpdateManifest(
  raw: string,
  publicKeyPem: string,
  expectedAssetPrefix: string,
): VerifiedUpdateRelease {
  if (Buffer.byteLength(raw, 'utf8') > MAX_MANIFEST_BYTES) {
    throw new Error('更新清单超过大小限制。')
  }
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    throw new Error('更新清单不是有效 JSON。')
  }
  if (!isRecord(value)) throw new Error('更新清单格式无效。')
  const manifest = readManifest(value)
  const payload = canonicalManifestPayload(manifest)
  const signature = Buffer.from(manifest.signature, 'base64')
  if (signature.length === 0 || !verify(null, Buffer.from(payload), createPublicKey(publicKeyPem), signature)) {
    throw new Error('更新清单签名无效。')
  }
  const assetUrl = new URL(manifest.asset.url)
  if (assetUrl.protocol !== 'https:' || !manifest.asset.url.startsWith(expectedAssetPrefix)) {
    throw new Error('更新包地址不在允许的发布源。')
  }
  return {
    schemaVersion: manifest.schemaVersion,
    version: manifest.version,
    publishedAt: manifest.publishedAt,
    releaseNotes: manifest.releaseNotes,
    asset: manifest.asset,
  }
}

export function canonicalManifestPayload(manifest: Omit<SignedUpdateManifest, 'signature'>): string {
  return JSON.stringify({
    schemaVersion: manifest.schemaVersion,
    version: manifest.version,
    publishedAt: manifest.publishedAt,
    releaseNotes: manifest.releaseNotes,
    asset: {
      name: manifest.asset.name,
      url: manifest.asset.url,
      sha256: manifest.asset.sha256,
      size: manifest.asset.size,
    },
  })
}

export function compareVersions(left: string, right: string): number {
  const leftVersion = parseVersion(left)
  const rightVersion = parseVersion(right)
  for (let index = 0; index < 3; index += 1) {
    if (leftVersion.parts[index] !== rightVersion.parts[index]) {
      return leftVersion.parts[index] - rightVersion.parts[index]
    }
  }
  if (leftVersion.prerelease === rightVersion.prerelease) return 0
  if (leftVersion.prerelease === null) return 1
  if (rightVersion.prerelease === null) return -1
  return leftVersion.prerelease.localeCompare(rightVersion.prerelease, undefined, { numeric: true })
}

function readManifest(value: Record<string, unknown>): SignedUpdateManifest {
  const asset = value.asset
  if (!isRecord(asset)) throw new Error('更新清单缺少更新包。')
  const manifest: SignedUpdateManifest = {
    schemaVersion: value.schemaVersion === 1 ? 1 : invalid('更新清单版本不受支持。'),
    version: readString(value.version, '更新版本无效。'),
    publishedAt: readString(value.publishedAt, '发布时间无效。'),
    releaseNotes: value.releaseNotes === null ? null : readString(value.releaseNotes, '更新说明无效。'),
    asset: {
      name: readString(asset.name, '更新包名称无效。'),
      url: readString(asset.url, '更新包地址无效。'),
      sha256: readString(asset.sha256, '更新包校验值无效。'),
      size: readPositiveInteger(asset.size, '更新包大小无效。'),
    },
    signature: readString(value.signature, '更新清单缺少签名。'),
  }
  if (!VERSION_PATTERN.test(manifest.version)) throw new Error('更新版本格式无效。')
  if (Number.isNaN(Date.parse(manifest.publishedAt))) throw new Error('发布时间格式无效。')
  if (!manifest.asset.name.endsWith('.zip') || manifest.asset.name.includes('/') || manifest.asset.name.includes('..')) {
    throw new Error('更新包名称不安全。')
  }
  if (!SHA256_PATTERN.test(manifest.asset.sha256)) throw new Error('更新包 SHA-256 无效。')
  if (manifest.releaseNotes && manifest.releaseNotes.length > 16_000) throw new Error('更新说明过长。')
  return manifest
}

function parseVersion(value: string): { parts: number[]; prerelease: string | null } {
  if (!VERSION_PATTERN.test(value)) throw new Error(`版本号无效：${value}`)
  const [main, prerelease = null] = value.split('-', 2)
  return { parts: main.split('.').map(Number), prerelease }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readString(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(message)
  return value
}

function readPositiveInteger(value: unknown, message: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new Error(message)
  return value
}

function invalid(message: string): never {
  throw new Error(message)
}
