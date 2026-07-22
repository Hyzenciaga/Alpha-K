import type { DiscoveredItem, SourcePreview } from '../../shared/domain/source-ingestion.js'
import type { SourceType } from '../../shared/domain/source.js'
import type { IpcErrorCode } from '../../shared/ipc/common-contract.js'

export type SourceValidationResult =
  | { valid: true; warnings: string[] }
  | { valid: false; errors: string[]; warnings: string[] }

export type SourceSyncContext<TConfig> = {
  config: TConfig
}

export interface SourceConnector<TConfig> {
  readonly type: SourceType
  validate(config: TConfig): Promise<SourceValidationResult>
  preview(config: TConfig): Promise<SourcePreview>
  sync(context: SourceSyncContext<TConfig>): AsyncIterable<DiscoveredItem>
}

export class SourceConnectorError extends Error {
  constructor(
    readonly code: Extract<
      IpcErrorCode,
      'SOURCE_INVALID_CONFIG' | 'SOURCE_FETCH_FAILED' | 'SOURCE_UNSUPPORTED'
    >,
    message: string,
    readonly retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'SourceConnectorError'
  }
}
