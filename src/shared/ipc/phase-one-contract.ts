import type { EnqueueJobInput, Job, JobListFilter } from '../domain/job.js'
import type { SearchIndexRebuildReport } from '../domain/vault-index.js'
import type { VaultConnection } from '../domain/vault.js'
import type { AppEvent } from './app-event-contract.js'
import type { IpcResult } from './common-contract.js'

export type { AppEvent } from './app-event-contract.js'
export type { IpcError, IpcErrorCode, IpcResult } from './common-contract.js'

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
