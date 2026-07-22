export type IpcErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VAULT_NOT_FOUND'
  | 'VAULT_INVALID_MANIFEST'
  | 'VAULT_UNSUPPORTED_SCHEMA'
  | 'VAULT_UNSAFE_PATH'
  | 'VAULT_IO_ERROR'
  | 'SOURCE_NOT_FOUND'
  | 'SOURCE_INVALID_CONFIG'
  | 'SOURCE_FETCH_FAILED'
  | 'SOURCE_UNSUPPORTED'
  | 'SYNC_CONFLICT'
  | 'INTERNAL_ERROR'

export type IpcError = {
  code: IpcErrorCode
  message: string
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: IpcError }
