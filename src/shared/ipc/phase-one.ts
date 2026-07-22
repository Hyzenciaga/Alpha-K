import { z } from 'zod'
import { IdSchema } from '../domain/common.js'
import { EnqueueJobInputSchema, JobListFilterSchema, JobSchema } from '../domain/job.js'
import { VaultConnectionSchema } from '../domain/vault.js'
import { SearchIndexRebuildReportSchema } from '../domain/vault-index.js'

export { PHASE_ONE_IPC_CHANNELS } from './phase-one-contract.js'
export type { AppEvent, IpcError, IpcResult, PhaseOneApi } from './phase-one-contract.js'
export { AppEventSchema } from './app-event.js'
export { IpcErrorCodeSchema, IpcErrorSchema } from './common.js'

export const JobIdRequestSchema = z.object({ jobId: IdSchema }).strict()

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
