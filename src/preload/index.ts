import { contextBridge, ipcRenderer } from 'electron'
import type { AlphaKApi, PhaseZeroStatus } from '../shared/contracts.js'
import { IPC_CHANNELS } from '../shared/contracts.js'
import type { AppEvent, PhaseOneApi } from '../shared/ipc/phase-one.js'
import { PHASE_ONE_IPC_CHANNELS } from '../shared/ipc/phase-one.js'

const api: AlphaKApi & PhaseOneApi = {
  getPhaseZeroStatus: () => ipcRenderer.invoke(IPC_CHANNELS.getPhaseZeroStatus),
  refreshProviders: () => ipcRenderer.invoke(IPC_CHANNELS.refreshProviders),
  onPhaseZeroStatus: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, status: PhaseZeroStatus): void => listener(status)
    ipcRenderer.on(IPC_CHANNELS.phaseZeroStatus, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.phaseZeroStatus, handler)
  },
  getVault: () => ipcRenderer.invoke(PHASE_ONE_IPC_CHANNELS.vaultGet),
  selectVault: () => ipcRenderer.invoke(PHASE_ONE_IPC_CHANNELS.vaultSelect),
  rebuildVaultIndex: () => ipcRenderer.invoke(PHASE_ONE_IPC_CHANNELS.vaultRebuildIndex),
  listJobs: (filter = {}) => ipcRenderer.invoke(PHASE_ONE_IPC_CHANNELS.jobsList, filter),
  cancelJob: (jobId) => ipcRenderer.invoke(PHASE_ONE_IPC_CHANNELS.jobsCancel, { jobId }),
  retryJob: (jobId) => ipcRenderer.invoke(PHASE_ONE_IPC_CHANNELS.jobsRetry, { jobId }),
  onAppEvent: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, appEvent: AppEvent): void => listener(appEvent)
    ipcRenderer.on(PHASE_ONE_IPC_CHANNELS.appEvent, handler)
    return () => ipcRenderer.removeListener(PHASE_ONE_IPC_CHANNELS.appEvent, handler)
  },
}

contextBridge.exposeInMainWorld('alphaK', api)
