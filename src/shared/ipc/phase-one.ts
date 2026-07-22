import { z } from 'zod'
import { IdSchema } from '../domain/common.js'
import { EnqueueJobInputSchema, JobListFilterSchema, JobSchema } from '../domain/job.js'
import { VaultConnectionSchema } from '../domain/vault.js'
import { SearchIndexRebuildReportSchema } from '../domain/vault-index.js'

export { PHASE_ONE_IPC_CHANNELS } from './phase-one-contract.js'
export type { AppEvent, IpcError, IpcResult, PhaseOneApi } from './phase-one-contract.js'

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

export const JobIdRequestSchema = z.object({ jobId: IdSchema }).strict()

export const AppEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('job.updated'), job: JobSchema }).strict(),
])

export const PhaseOneIpcResponseSchemas = {
  vaultGet: VaultConnectionSchema,
  vaultSelect: VaultConnectionSchema,
  vaultRebuildIndex: SearchIndexRebuildReportSchema,
  jobsCreate: JobSchema,
  jobsList: z.array(JobSchema),
  jobsCancel: JobSchema,
  jobsRetry: JobSchema,
  jobsCreateRequest: EnqueueJobInputSchema,
  jobsListRequest: JobListFilterSchema,
} as const
