import type { IpcMain } from 'electron'
import { ZodError } from 'zod'
import type { IpcError, IpcResult } from '../../shared/ipc/common-contract.js'
import { PHASE_TWO_IPC_CHANNELS } from '../../shared/ipc/phase-two-contract.js'
import { PhaseTwoIpcRequestSchemas } from '../../shared/ipc/phase-two.js'
import { SourceServiceError, type SourceService } from '../application/source-service.js'

type PhaseTwoHandlerDependencies = {
  ipcMain: Pick<IpcMain, 'handle' | 'removeHandler'>
  sourceService: SourceService
}

export function registerPhaseTwoIpcHandlers(
  dependencies: PhaseTwoHandlerDependencies,
): () => void {
  const { ipcMain, sourceService } = dependencies

  ipcMain.handle(PHASE_TWO_IPC_CHANNELS.sourcesList, (_event, rawFilter: unknown) =>
    asIpcResult(() =>
      sourceService.listSources(PhaseTwoIpcRequestSchemas.sourcesList.parse(rawFilter)),
    ),
  )
  ipcMain.handle(PHASE_TWO_IPC_CHANNELS.sourcesCreate, (_event, rawInput: unknown) =>
    asIpcResult(() =>
      sourceService.createSource(PhaseTwoIpcRequestSchemas.sourcesCreate.parse(rawInput)),
    ),
  )
  ipcMain.handle(PHASE_TWO_IPC_CHANNELS.sourcesUpdate, (_event, rawRequest: unknown) =>
    asIpcResult(() => {
      const request = PhaseTwoIpcRequestSchemas.sourcesUpdate.parse(rawRequest)
      return sourceService.updateSource(request.sourceId, request.input)
    }),
  )
  ipcMain.handle(PHASE_TWO_IPC_CHANNELS.sourcesDelete, (_event, rawRequest: unknown) =>
    asIpcResult(() => {
      const request = PhaseTwoIpcRequestSchemas.sourcesDelete.parse(rawRequest)
      return sourceService.deleteSource(request.sourceId)
    }),
  )
  ipcMain.handle(PHASE_TWO_IPC_CHANNELS.sourcesPreview, (_event, rawInput: unknown) =>
    asIpcResult(() =>
      sourceService.previewSource(PhaseTwoIpcRequestSchemas.sourcesPreview.parse(rawInput)),
    ),
  )
  ipcMain.handle(PHASE_TWO_IPC_CHANNELS.sourcesSync, (_event, rawRequest: unknown) =>
    asIpcResult(() => {
      const request = PhaseTwoIpcRequestSchemas.sourcesSync.parse(rawRequest)
      return sourceService.syncSource(request.sourceId)
    }),
  )
  ipcMain.handle(PHASE_TWO_IPC_CHANNELS.syncRunsList, (_event, rawFilter: unknown) =>
    asIpcResult(() =>
      sourceService.listSyncRuns(PhaseTwoIpcRequestSchemas.syncRunsList.parse(rawFilter)),
    ),
  )
  ipcMain.handle(PHASE_TWO_IPC_CHANNELS.inboxList, (_event, rawFilter: unknown) =>
    asIpcResult(() =>
      sourceService.listInboxItems(PhaseTwoIpcRequestSchemas.inboxList.parse(rawFilter)),
    ),
  )

  return () => {
    for (const channel of Object.values(PHASE_TWO_IPC_CHANNELS)) ipcMain.removeHandler(channel)
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
  if (error instanceof SourceServiceError) return { code: error.code, message: error.message }
  return { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : String(error) }
}
