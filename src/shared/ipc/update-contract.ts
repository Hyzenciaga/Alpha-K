export type AppUpdatePhase =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'installing'
  | 'error'

export type AppUpdateStatus = {
  supported: boolean
  currentVersion: string
  phase: AppUpdatePhase
  availableVersion: string | null
  releaseNotes: string | null
  percent: number | null
  transferred: number | null
  total: number | null
  error: string | null
}

export const UPDATE_IPC_CHANNELS = {
  statusGet: 'update:status:get',
  check: 'update:check',
  download: 'update:download',
  restartAndInstall: 'update:restart-and-install',
  statusChanged: 'update:status-changed',
} as const

export type UpdateApi = {
  getUpdateStatus: () => Promise<AppUpdateStatus>
  checkForUpdate: () => Promise<AppUpdateStatus>
  downloadUpdate: () => Promise<AppUpdateStatus>
  restartAndInstallUpdate: () => Promise<AppUpdateStatus>
  onUpdateStatus: (listener: (status: AppUpdateStatus) => void) => () => void
}
