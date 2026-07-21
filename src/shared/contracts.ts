export type ProviderProbeStatus =
  | 'not_installed'
  | 'broken_installation'
  | 'unauthenticated'
  | 'unsupported_version'
  | 'available'

export type ProviderProbeAttempt = {
  executable: string
  source: 'configured' | 'path' | 'app_bundle' | 'sdk_bundle'
  status: ProviderProbeStatus
  version?: string
  detail?: string
}

export type ProviderProbe = {
  provider: 'codex' | 'qoder'
  status: ProviderProbeStatus
  selectedExecutable?: string
  version?: string
  detail: string
  attempts: ProviderProbeAttempt[]
}

export type DatabaseHealth = {
  path: string
  migrationVersion: number
  fts5: boolean
  trigramChinese: boolean
  error?: string
}

export type PhaseZeroStatus = {
  startedAt: string
  backgroundTicks: number
  windowVisible: boolean
  lastLifecycleEvent: 'started' | 'window-hidden' | 'window-restored' | 'suspend' | 'resume'
  database: DatabaseHealth
  providers: ProviderProbe[]
}

export type AlphaKApi = {
  getPhaseZeroStatus: () => Promise<PhaseZeroStatus>
  refreshProviders: () => Promise<ProviderProbe[]>
  onPhaseZeroStatus: (listener: (status: PhaseZeroStatus) => void) => () => void
}

export const IPC_CHANNELS = {
  getPhaseZeroStatus: 'phase-zero:get-status',
  refreshProviders: 'phase-zero:refresh-providers',
  phaseZeroStatus: 'phase-zero:status',
} as const
