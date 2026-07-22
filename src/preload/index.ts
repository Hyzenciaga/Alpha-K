import { contextBridge, ipcRenderer } from 'electron'
import type { AlphaKApi, PhaseZeroStatus } from '../shared/contracts.js'
import { IPC_CHANNELS } from '../shared/contracts.js'
import type { AppEvent, PhaseOneApi } from '../shared/ipc/phase-one-contract.js'
import { PHASE_ONE_IPC_CHANNELS } from '../shared/ipc/phase-one-contract.js'
import type { PhaseTwoApi } from '../shared/ipc/phase-two-contract.js'
import { PHASE_TWO_IPC_CHANNELS } from '../shared/ipc/phase-two-contract.js'
import type { CloudApi } from '../shared/ipc/cloud-contract.js'
import { CLOUD_IPC_CHANNELS } from '../shared/ipc/cloud-contract.js'

const api: AlphaKApi & PhaseOneApi & PhaseTwoApi & CloudApi = {
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
  createJob: (input) => ipcRenderer.invoke(PHASE_ONE_IPC_CHANNELS.jobsCreate, input),
  listJobs: (filter = {}) => ipcRenderer.invoke(PHASE_ONE_IPC_CHANNELS.jobsList, filter),
  cancelJob: (jobId) => ipcRenderer.invoke(PHASE_ONE_IPC_CHANNELS.jobsCancel, { jobId }),
  retryJob: (jobId) => ipcRenderer.invoke(PHASE_ONE_IPC_CHANNELS.jobsRetry, { jobId }),
  listSources: (filter) => ipcRenderer.invoke(PHASE_TWO_IPC_CHANNELS.sourcesList, filter),
  createSource: (input) => ipcRenderer.invoke(PHASE_TWO_IPC_CHANNELS.sourcesCreate, input),
  updateSource: (sourceId, input) =>
    ipcRenderer.invoke(PHASE_TWO_IPC_CHANNELS.sourcesUpdate, { sourceId, input }),
  deleteSource: (sourceId) =>
    ipcRenderer.invoke(PHASE_TWO_IPC_CHANNELS.sourcesDelete, { sourceId }),
  previewSource: (input) => ipcRenderer.invoke(PHASE_TWO_IPC_CHANNELS.sourcesPreview, input),
  syncSource: (sourceId) =>
    ipcRenderer.invoke(PHASE_TWO_IPC_CHANNELS.sourcesSync, { sourceId }),
  listSyncRuns: (filter) => ipcRenderer.invoke(PHASE_TWO_IPC_CHANNELS.syncRunsList, filter),
  listInboxItems: (filter) => ipcRenderer.invoke(PHASE_TWO_IPC_CHANNELS.inboxList, filter),
  getCloudStatus: () => ipcRenderer.invoke(CLOUD_IPC_CHANNELS.statusGet),
  signInWithGitHub: () => ipcRenderer.invoke(CLOUD_IPC_CHANNELS.signInGithub),
  signOutCloud: () => ipcRenderer.invoke(CLOUD_IPC_CHANNELS.signOut),
  onAppEvent: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, appEvent: AppEvent): void => listener(appEvent)
    ipcRenderer.on(PHASE_ONE_IPC_CHANNELS.appEvent, handler)
    return () => ipcRenderer.removeListener(PHASE_ONE_IPC_CHANNELS.appEvent, handler)
  },
}

contextBridge.exposeInMainWorld('alphaK', api)
