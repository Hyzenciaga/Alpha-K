import { z } from 'zod'

export const IpcErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'VAULT_NOT_FOUND',
  'VAULT_INVALID_MANIFEST',
  'VAULT_UNSUPPORTED_SCHEMA',
  'VAULT_UNSAFE_PATH',
  'VAULT_IO_ERROR',
  'SOURCE_NOT_FOUND',
  'SOURCE_INVALID_CONFIG',
  'SOURCE_FETCH_FAILED',
  'SOURCE_UNSUPPORTED',
  'SYNC_CONFLICT',
  'CLOUD_NOT_CONFIGURED',
  'CLOUD_SECURE_STORAGE_UNAVAILABLE',
  'AUTH_FAILED',
  'SYNC_OFFLINE',
  'SYNC_FAILED',
  'INTERNAL_ERROR',
])

export const IpcErrorSchema = z
  .object({
    code: IpcErrorCodeSchema,
    message: z.string(),
  })
  .strict()

export type { IpcError, IpcErrorCode, IpcResult } from './common-contract.js'
