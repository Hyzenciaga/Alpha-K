import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { access, mkdir, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream } from 'node:stream/web'
import type { PreparedUpdate, UpdateClient } from './app-update-service.js'
import { parseAndVerifyUpdateManifest, type VerifiedUpdateRelease } from './update-manifest.js'

type FetchLike = (input: string) => Promise<Response>

type GitHubUpdateClientDependencies = {
  manifestUrl: string
  expectedAssetPrefix: string
  publicKeyPem: string
  updateDirectory: string
  fetch?: FetchLike
}

export class GitHubUpdateClient implements UpdateClient {
  private readonly fetch: FetchLike

  constructor(private readonly dependencies: GitHubUpdateClientDependencies) {
    this.fetch = dependencies.fetch ?? ((input) => globalThis.fetch(input))
  }

  async checkForUpdate(): Promise<VerifiedUpdateRelease | null> {
    const response = await this.fetch(this.dependencies.manifestUrl)
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`检查更新失败（HTTP ${response.status}）。`)
    return parseAndVerifyUpdateManifest(
      await response.text(),
      this.dependencies.publicKeyPem,
      this.dependencies.expectedAssetPrefix,
    )
  }

  async downloadUpdate(
    release: VerifiedUpdateRelease,
    onProgress: (progress: { percent: number; transferred: number; total: number }) => void,
  ): Promise<PreparedUpdate> {
    await mkdir(this.dependencies.updateDirectory, { recursive: true })
    await access(this.dependencies.updateDirectory)
    const response = await this.fetch(release.asset.url)
    if (!response.ok || !response.body) throw new Error(`下载更新失败（HTTP ${response.status}）。`)
    const archivePath = join(this.dependencies.updateDirectory, `${release.version}-${release.asset.name}`)
    const partialPath = `${archivePath}.partial`
    await rm(partialPath, { force: true })
    let transferred = 0
    const checksum = createHash('sha256')
    const progress = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        transferred += chunk.length
        checksum.update(chunk)
        onProgress({
          percent: release.asset.size === 0 ? 0 : (transferred / release.asset.size) * 100,
          transferred,
          total: release.asset.size,
        })
        callback(null, chunk)
      },
    })
    try {
      await pipeline(
        Readable.fromWeb(response.body as ReadableStream),
        progress,
        createWriteStream(partialPath, { flags: 'w' }),
      )
      if (transferred !== release.asset.size) {
        throw new Error(`更新包大小不匹配（期望 ${release.asset.size}，收到 ${transferred}）。`)
      }
      if (checksum.digest('hex') !== release.asset.sha256) {
        throw new Error('更新包校验失败，已拒绝安装。')
      }
      await rename(partialPath, archivePath)
      return { release, archivePath }
    } catch (error) {
      await rm(partialPath, { force: true })
      throw error
    }
  }
}

export function updateDownloadDirectory(appBundlePath: string): string {
  return join(dirname(appBundlePath), '.alpha-k-update-downloads')
}
