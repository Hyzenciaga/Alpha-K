import type { IpcMain } from 'electron'
import type { IpcError, IpcResult } from '../../shared/ipc/common-contract.js'
import { CLOUD_IPC_CHANNELS } from '../../shared/ipc/cloud-contract.js'
import { CloudServiceError, type CloudAuthService } from '../cloud/cloud-auth-service.js'
import { SecureSessionStorageError } from '../cloud/secure-session-storage.js'

type CloudHandlerDependencies = {
  ipcMain: Pick<IpcMain, 'handle' | 'removeHandler'>
  cloudAuthService: CloudAuthService
}

export function registerCloudIpcHandlers(dependencies: CloudHandlerDependencies): () => void {
  const { ipcMain, cloudAuthService } = dependencies
  ipcMain.handle(CLOUD_IPC_CHANNELS.statusGet, () =>
    asIpcResult(() => cloudAuthService.getStatus()),
  )
  ipcMain.handle(CLOUD_IPC_CHANNELS.signInGithub, () =>
    asIpcResult(() => cloudAuthService.signInWithGitHub()),
  )
  ipcMain.handle(CLOUD_IPC_CHANNELS.signOut, () =>
    asIpcResult(() => cloudAuthService.signOut()),
  )

  return () => {
    for (const channel of Object.values(CLOUD_IPC_CHANNELS)) ipcMain.removeHandler(channel)
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
  if (error instanceof CloudServiceError || error instanceof SecureSessionStorageError) {
    return { code: error.code, message: error.message }
  }
  return { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : String(error) }
}
