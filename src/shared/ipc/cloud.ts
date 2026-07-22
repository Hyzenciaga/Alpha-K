import { CloudStatusSchema } from '../domain/cloud-sync.js'

export { CLOUD_IPC_CHANNELS } from './cloud-contract.js'
export type { CloudApi } from './cloud-contract.js'

export const CloudIpcResponseSchemas = {
  statusGet: CloudStatusSchema,
  signInGithub: CloudStatusSchema,
  signOut: CloudStatusSchema,
} as const
