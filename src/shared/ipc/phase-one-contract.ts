import type { EnqueueJobInput, Job, JobListFilter } from '../domain/job.js'
import type { SearchIndexRebuildReport } from '../domain/vault-index.js'
import type { VaultConnection } from '../domain/vault.js'

export type IpcErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VAULT_NOT_FOUND'
  | 'VAULT_INVALID_MANIFEST'
  | 'VAULT_UNSUPPORTED_SCHEMA'
  | 'VAULT_UNSAFE_PATH'
  | 'VAULT_IO_ERROR'
  | 'INTERNAL_ERROR'

export type IpcError = {
  code: IpcErrorCode
  message: string
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: IpcError }

export type AppEvent = { type: 'job.updated'; job: Job }

export const PHASE_ONE_IPC_CHANNELS = {
  vaultGet: 'vault:get',
  vaultSelect: 'vault:select',
  vaultRebuildIndex: 'vault:rebuild-index',
  jobsCreate: 'jobs:create',
  jobsList: 'jobs:list',
  jobsCancel: 'jobs:cancel',
  jobsRetry: 'jobs:retry',
  appEvent: 'app:event',
} as const

export type PhaseOneApi = {
  getVault: () => Promise<IpcResult<VaultConnection>>
  selectVault: () => Promise<IpcResult<VaultConnection>>
  rebuildVaultIndex: () => Promise<IpcResult<SearchIndexRebuildReport>>
  createJob: (input: EnqueueJobInput) => Promise<IpcResult<Job>>
  listJobs: (filter?: JobListFilter) => Promise<IpcResult<Job[]>>
  cancelJob: (jobId: string) => Promise<IpcResult<Job>>
  retryJob: (jobId: string) => Promise<IpcResult<Job>>
  onAppEvent: (listener: (event: AppEvent) => void) => () => void
}
