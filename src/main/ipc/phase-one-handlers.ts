import type { IpcMain } from 'electron'
import { ZodError } from 'zod'
import { JobListFilterSchema } from '../../shared/domain/job.js'
import {
  JobIdRequestSchema,
  PHASE_ONE_IPC_CHANNELS,
  type IpcError,
  type IpcResult,
} from '../../shared/ipc/phase-one.js'
import { VaultError } from '../vault/vault-errors.js'
import type { JobQueueService } from '../application/job-queue-service.js'
import type { VaultService } from '../application/vault-service.js'

type PhaseOneHandlerDependencies = {
  ipcMain: Pick<IpcMain, 'handle' | 'removeHandler'>
  vaultService: VaultService
  jobQueueService: JobQueueService
  selectVaultDirectory: () => Promise<string | undefined>
}

export function registerPhaseOneIpcHandlers(dependencies: PhaseOneHandlerDependencies): () => void {
  const { ipcMain, vaultService, jobQueueService } = dependencies

  ipcMain.handle(PHASE_ONE_IPC_CHANNELS.vaultGet, () => asIpcResult(() => vaultService.getConnection()))
  ipcMain.handle(PHASE_ONE_IPC_CHANNELS.vaultSelect, () =>
    asIpcResult(async () => {
      const path = await dependencies.selectVaultDirectory()
      return path ? vaultService.initializeAndActivate(path) : vaultService.getConnection()
    }),
  )
  ipcMain.handle(PHASE_ONE_IPC_CHANNELS.vaultRebuildIndex, () =>
    asIpcResult(() => vaultService.rebuildActiveSearchIndex()),
  )
  ipcMain.handle(PHASE_ONE_IPC_CHANNELS.jobsList, (_event, rawFilter: unknown) =>
    asIpcResult(() => jobQueueService.list(JobListFilterSchema.parse(rawFilter ?? {}))),
  )
  ipcMain.handle(PHASE_ONE_IPC_CHANNELS.jobsCancel, (_event, rawRequest: unknown) =>
    asIpcResult(() => {
      const request = JobIdRequestSchema.parse(rawRequest)
      const job = jobQueueService.cancel(request.jobId)
      if (!job) throw new IpcNotFoundError(`Job ${request.jobId} cannot be cancelled.`)
      return job
    }),
  )
  ipcMain.handle(PHASE_ONE_IPC_CHANNELS.jobsRetry, (_event, rawRequest: unknown) =>
    asIpcResult(() => {
      const request = JobIdRequestSchema.parse(rawRequest)
      const job = jobQueueService.retry(request.jobId)
      if (!job) throw new IpcNotFoundError(`Job ${request.jobId} cannot be retried.`)
      return job
    }),
  )

  return () => {
    for (const channel of Object.values(PHASE_ONE_IPC_CHANNELS)) {
      if (channel !== PHASE_ONE_IPC_CHANNELS.appEvent) ipcMain.removeHandler(channel)
    }
  }
}

async function asIpcResult<T>(operation: () => T | Promise<T>): Promise<IpcResult<T>> {
  try {
    return { ok: true, data: await operation() }
  } catch (error) {
    return { ok: false, error: mapError(error) }
  }
}

function mapError(error: unknown): IpcError {
  if (error instanceof ZodError) return { code: 'VALIDATION_ERROR', message: error.message }
  if (error instanceof VaultError) return { code: error.code, message: error.message }
  if (error instanceof IpcNotFoundError) return { code: 'NOT_FOUND', message: error.message }
  return { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : String(error) }
}

class IpcNotFoundError extends Error {}
