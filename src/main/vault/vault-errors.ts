export class VaultError extends Error {
  constructor(
    readonly code:
      | 'VAULT_NOT_FOUND'
      | 'VAULT_INVALID_MANIFEST'
      | 'VAULT_UNSUPPORTED_SCHEMA'
      | 'VAULT_UNSAFE_PATH'
      | 'VAULT_IO_ERROR',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'VaultError'
  }
}
