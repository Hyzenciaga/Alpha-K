import type { IpcMain } from 'electron'
import { ZodError } from 'zod'
import type { IpcError, IpcResult } from '../../shared/ipc/common-contract.js'
import { CAPTURE_IPC_CHANNELS } from '../../shared/ipc/capture-contract.js'
import { CaptureIpcRequestSchemas } from '../../shared/ipc/capture.js'
import { CaptureServiceError, type CaptureService } from '../application/capture-service.js'

type CaptureHandlerDependencies = {
  ipcMain: Pick<IpcMain, 'handle' | 'removeHandler'>
  captureService: CaptureService
}

export function registerCaptureIpcHandlers(dependencies: CaptureHandlerDependencies): () => void {
  const { ipcMain, captureService } = dependencies
  ipcMain.handle(CAPTURE_IPC_CHANNELS.create, (_event, rawInput: unknown) =>
    asIpcResult(() => captureService.create(CaptureIpcRequestSchemas.create.parse(rawInput))),
  )
  ipcMain.handle(CAPTURE_IPC_CHANNELS.list, (_event, rawFilter: unknown) =>
    asIpcResult(() => captureService.list(CaptureIpcRequestSchemas.list.parse(rawFilter))),
  )
  ipcMain.handle(CAPTURE_IPC_CHANNELS.archive, (_event, rawRequest: unknown) =>
    asIpcResult(() => captureService.archive(CaptureIpcRequestSchemas.archive.parse(rawRequest).captureId)),
  )

  return () => {
    for (const channel of Object.values(CAPTURE_IPC_CHANNELS)) ipcMain.removeHandler(channel)
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
  if (error instanceof CaptureServiceError) return { code: error.code, message: error.message }
  return { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : String(error) }
}
