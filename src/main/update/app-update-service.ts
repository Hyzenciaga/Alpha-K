import type { AppUpdateStatus } from '../../shared/ipc/update-contract.js'
import { compareVersions, type VerifiedUpdateRelease } from './update-manifest.js'

type ScheduleHandle = {
  unref?: () => void
}

export type PreparedUpdate = {
  release: VerifiedUpdateRelease
  archivePath: string
}

export type StagedUpdateInstallation = {
  update: PreparedUpdate
}

export type UpdateClient = {
  checkForUpdate: () => Promise<VerifiedUpdateRelease | null>
  downloadUpdate: (
    release: VerifiedUpdateRelease,
    onProgress: (progress: { percent: number; transferred: number; total: number }) => void,
  ) => Promise<PreparedUpdate>
}

export type UpdateInstaller = {
  stageInstallation: (update: PreparedUpdate) => Promise<StagedUpdateInstallation>
  launchInstallation: (installation: StagedUpdateInstallation) => Promise<void>
}

type AppUpdateServiceDependencies = {
  client: UpdateClient
  installer: UpdateInstaller
  currentVersion: string
  isPackaged: boolean
  prepareForInstall: () => Promise<void>
  quitForInstall: () => void
  onStatusChanged?: (status: AppUpdateStatus) => void
  schedule?: (callback: () => void, delayMs: number) => ScheduleHandle
  initialCheckDelayMs?: number
}

export class AppUpdateService {
  private started = false
  private release: VerifiedUpdateRelease | null = null
  private preparedUpdate: PreparedUpdate | null = null
  private status: AppUpdateStatus

  constructor(private readonly dependencies: AppUpdateServiceDependencies) {
    this.status = {
      supported: dependencies.isPackaged,
      currentVersion: dependencies.currentVersion,
      phase: 'idle',
      availableVersion: null,
      releaseNotes: null,
      percent: null,
      transferred: null,
      total: null,
      error: null,
    }
  }

  start(): void {
    if (this.started || !this.status.supported) return
    this.started = true
    const schedule = this.dependencies.schedule ?? ((callback, delayMs) => setTimeout(callback, delayMs))
    const timer = schedule(
      () => void this.checkForUpdates(),
      this.dependencies.initialCheckDelayMs ?? 3_000,
    )
    timer.unref?.()
  }

  getStatus(): AppUpdateStatus {
    return { ...this.status }
  }

  async checkForUpdates(): Promise<AppUpdateStatus> {
    if (!this.status.supported || this.status.phase === 'checking' || this.status.phase === 'downloading') {
      return this.getStatus()
    }
    if (this.status.phase === 'ready' || this.status.phase === 'installing') return this.getStatus()
    this.patchStatus({ phase: 'checking', error: null })
    try {
      const release = await this.dependencies.client.checkForUpdate()
      if (!release || compareVersions(release.version, this.status.currentVersion) <= 0) {
        this.release = null
        this.preparedUpdate = null
        this.patchStatus({
          phase: 'up-to-date',
          availableVersion: null,
          releaseNotes: null,
          percent: null,
          transferred: null,
          total: null,
          error: null,
        })
      } else {
        this.release = release
        this.preparedUpdate = null
        this.patchStatus({
          phase: 'available',
          availableVersion: release.version,
          releaseNotes: release.releaseNotes,
          percent: null,
          transferred: null,
          total: release.asset.size,
          error: null,
        })
      }
    } catch (error) {
      this.patchStatus({ phase: 'error', error: messageOf(error) })
    }
    return this.getStatus()
  }

  async downloadUpdate(): Promise<AppUpdateStatus> {
    if (!this.status.supported || !this.release) return this.getStatus()
    if (this.status.phase !== 'available' && this.status.phase !== 'error') return this.getStatus()
    this.patchStatus({
      phase: 'downloading',
      percent: 0,
      transferred: 0,
      total: this.release.asset.size,
      error: null,
    })
    try {
      this.preparedUpdate = await this.dependencies.client.downloadUpdate(this.release, (progress) => {
        this.patchStatus({
          phase: 'downloading',
          percent: Math.max(0, Math.min(100, progress.percent)),
          transferred: progress.transferred,
          total: progress.total,
          error: null,
        })
      })
      this.patchStatus({
        phase: 'ready',
        percent: 100,
        transferred: this.release.asset.size,
        total: this.release.asset.size,
        error: null,
      })
    } catch (error) {
      this.patchStatus({ phase: 'error', error: messageOf(error) })
    }
    return this.getStatus()
  }

  async restartAndInstall(): Promise<AppUpdateStatus> {
    if (!this.status.supported || !this.preparedUpdate || this.status.phase !== 'ready') return this.getStatus()
    this.patchStatus({ phase: 'installing', error: null })
    try {
      const installation = await this.dependencies.installer.stageInstallation(this.preparedUpdate)
      await this.dependencies.prepareForInstall()
      await this.dependencies.installer.launchInstallation(installation)
      this.dependencies.quitForInstall()
    } catch (error) {
      this.patchStatus({ phase: 'error', error: messageOf(error) })
    }
    return this.getStatus()
  }

  private patchStatus(patch: Partial<AppUpdateStatus>): void {
    this.status = { ...this.status, ...patch }
    this.dependencies.onStatusChanged?.(this.getStatus())
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
