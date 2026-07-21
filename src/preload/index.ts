import { contextBridge, ipcRenderer } from 'electron'
import type { AlphaKApi, PhaseZeroStatus } from '../shared/contracts.js'
import { IPC_CHANNELS } from '../shared/contracts.js'

const api: AlphaKApi = {
  getPhaseZeroStatus: () => ipcRenderer.invoke(IPC_CHANNELS.getPhaseZeroStatus),
  refreshProviders: () => ipcRenderer.invoke(IPC_CHANNELS.refreshProviders),
  onPhaseZeroStatus: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, status: PhaseZeroStatus): void => listener(status)
    ipcRenderer.on(IPC_CHANNELS.phaseZeroStatus, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.phaseZeroStatus, handler)
  },
}

contextBridge.exposeInMainWorld('alphaK', api)
