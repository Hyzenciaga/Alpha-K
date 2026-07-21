import { z } from 'zod'
import { IdSchema } from '../domain/common.js'
import { JobListFilterSchema, JobSchema, type Job, type JobListFilter } from '../domain/job.js'
import { VaultConnectionSchema, type VaultConnection } from '../domain/vault.js'
import {
  SearchIndexRebuildReportSchema,
  type SearchIndexRebuildReport,
} from '../domain/vault-index.js'

export const IpcErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'VAULT_NOT_FOUND',
  'VAULT_INVALID_MANIFEST',
  'VAULT_UNSUPPORTED_SCHEMA',
  'VAULT_UNSAFE_PATH',
  'VAULT_IO_ERROR',
  'INTERNAL_ERROR',
])

export const IpcErrorSchema = z
  .object({
    code: IpcErrorCodeSchema,
    message: z.string(),
  })
  .strict()

export type IpcError = z.infer<typeof IpcErrorSchema>
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: IpcError }

export const JobIdRequestSchema = z.object({ jobId: IdSchema }).strict()

export const AppEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('job.updated'), job: JobSchema }).strict(),
])

export type AppEvent = z.infer<typeof AppEventSchema>

export const PHASE_ONE_IPC_CHANNELS = {
  vaultGet: 'vault:get',
  vaultSelect: 'vault:select',
  vaultRebuildIndex: 'vault:rebuild-index',
  jobsList: 'jobs:list',
  jobsCancel: 'jobs:cancel',
  jobsRetry: 'jobs:retry',
  appEvent: 'app:event',
} as const

export type PhaseOneApi = {
  getVault: () => Promise<IpcResult<VaultConnection>>
  selectVault: () => Promise<IpcResult<VaultConnection>>
  rebuildVaultIndex: () => Promise<IpcResult<SearchIndexRebuildReport>>
  listJobs: (filter?: JobListFilter) => Promise<IpcResult<Job[]>>
  cancelJob: (jobId: string) => Promise<IpcResult<Job>>
  retryJob: (jobId: string) => Promise<IpcResult<Job>>
  onAppEvent: (listener: (event: AppEvent) => void) => () => void
}

export const PhaseOneIpcResponseSchemas = {
  vaultGet: VaultConnectionSchema,
  vaultSelect: VaultConnectionSchema,
  vaultRebuildIndex: SearchIndexRebuildReportSchema,
  jobsList: z.array(JobSchema),
  jobsCancel: JobSchema,
  jobsRetry: JobSchema,
  jobsListRequest: JobListFilterSchema,
} as const
