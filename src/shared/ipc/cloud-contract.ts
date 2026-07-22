import type { CloudStatus } from '../domain/cloud-sync.js'
import type { IpcResult } from './common-contract.js'

export const CLOUD_IPC_CHANNELS = {
  statusGet: 'cloud:status:get',
  signInGithub: 'cloud:auth:sign-in-github',
  signOut: 'cloud:auth:sign-out',
} as const

export type CloudApi = {
  getCloudStatus: () => Promise<IpcResult<CloudStatus>>
  signInWithGitHub: () => Promise<IpcResult<CloudStatus>>
  signOutCloud: () => Promise<IpcResult<CloudStatus>>
}
