import { describe, expect, it, vi } from 'vitest'
import {
  AppUpdateService,
  type PreparedUpdate,
  type StagedUpdateInstallation,
  type UpdateClient,
  type UpdateInstaller,
} from '../../src/main/update/app-update-service.js'
import type { VerifiedUpdateRelease } from '../../src/main/update/update-manifest.js'

const release: VerifiedUpdateRelease = {
  schemaVersion: 1,
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

describe('AppUpdateService', () => {
  it('checks a signed release, downloads it, stages it before shutdown, and then requests restart', async () => {
    const client = new FakeClient(release)
    const installer = new FakeInstaller()
    const prepareForInstall = vi.fn(async () => undefined)
    const quitForInstall = vi.fn()
    const statuses: string[] = []
    let scheduledCheck: (() => void) | undefined
    const service = new AppUpdateService({
      client,
      installer,
      currentVersion: '0.1.0',
      isPackaged: true,
      prepareForInstall,
      quitForInstall,
      onStatusChanged: (status) => statuses.push(status.phase),
      schedule: (callback) => {
        scheduledCheck = callback
        return {}
      },
    })

    service.start()
    expect(scheduledCheck).toBeTypeOf('function')

    await service.checkForUpdates()
    expect(service.getStatus()).toMatchObject({
      phase: 'available',
      availableVersion: '0.2.0',
      releaseNotes: 'A safer update.',
    })

    await service.downloadUpdate()
    expect(service.getStatus()).toMatchObject({
      phase: 'ready',
      availableVersion: '0.2.0',
      percent: 100,
    })
    expect(statuses).toContain('downloading')

    await service.restartAndInstall()
    expect(installer.events).toEqual(['stage', 'launch'])
    expect(prepareForInstall).toHaveBeenCalledOnce()
    expect(quitForInstall).toHaveBeenCalledOnce()
  })

  it('does not offer a release that is not newer than the installed app', async () => {
    const service = new AppUpdateService({
      client: new FakeClient({ ...release, version: '0.1.0' }),
      installer: new FakeInstaller(),
      currentVersion: '0.1.0',
      isPackaged: true,
      prepareForInstall: async () => undefined,
      quitForInstall: () => undefined,
    })

    expect(await service.checkForUpdates()).toMatchObject({ phase: 'up-to-date', availableVersion: null })
  })

  it('stays unsupported for development builds', async () => {
    const client = new FakeClient(release)
    const service = new AppUpdateService({
      client,
      installer: new FakeInstaller(),
      currentVersion: '0.1.0',
      isPackaged: false,
      prepareForInstall: async () => undefined,
      quitForInstall: () => undefined,
    })

    service.start()
    expect(await service.checkForUpdates()).toMatchObject({ supported: false, phase: 'idle' })
    expect(client.checkCount).toBe(0)
  })
})

class FakeClient implements UpdateClient {
  checkCount = 0

  constructor(private readonly nextRelease: VerifiedUpdateRelease | null) {}

  async checkForUpdate(): Promise<VerifiedUpdateRelease | null> {
    this.checkCount += 1
    return this.nextRelease
  }

  async downloadUpdate(
    nextRelease: VerifiedUpdateRelease,
    onProgress: (progress: { percent: number; transferred: number; total: number }) => void,
  ): Promise<PreparedUpdate> {
    onProgress({ percent: 50, transferred: 512, total: 1_024 })
    return { release: nextRelease, archivePath: '/tmp/alpha-k-update.zip' }
  }
}

class FakeInstaller implements UpdateInstaller {
  events: string[] = []

  async stageInstallation(update: PreparedUpdate): Promise<StagedUpdateInstallation> {
    this.events.push('stage')
    return { update }
  }

  async launchInstallation(): Promise<void> {
    this.events.push('launch')
  }
}
