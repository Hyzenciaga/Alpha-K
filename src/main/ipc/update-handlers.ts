import type { IpcMain } from 'electron'
import { UPDATE_IPC_CHANNELS } from '../../shared/ipc/update-contract.js'
import type { AppUpdateService } from '../update/app-update-service.js'

type UpdateHandlerDependencies = {
  ipcMain: Pick<IpcMain, 'handle' | 'removeHandler'>
  updateService: AppUpdateService
}

export function registerUpdateIpcHandlers(dependencies: UpdateHandlerDependencies): () => void {
  const { ipcMain, updateService } = dependencies
  ipcMain.handle(UPDATE_IPC_CHANNELS.statusGet, () => updateService.getStatus())
  ipcMain.handle(UPDATE_IPC_CHANNELS.check, () => updateService.checkForUpdates())
  ipcMain.handle(UPDATE_IPC_CHANNELS.download, () => updateService.downloadUpdate())
  ipcMain.handle(UPDATE_IPC_CHANNELS.restartAndInstall, () => updateService.restartAndInstall())

  return () => {
    ipcMain.removeHandler(UPDATE_IPC_CHANNELS.statusGet)
    ipcMain.removeHandler(UPDATE_IPC_CHANNELS.check)
    ipcMain.removeHandler(UPDATE_IPC_CHANNELS.download)
    ipcMain.removeHandler(UPDATE_IPC_CHANNELS.restartAndInstall)
  }
}
