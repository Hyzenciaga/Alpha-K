import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { InboxItemListFilter, InboxItemSummary } from '../../shared/domain/inbox.js'
import type { Job } from '../../shared/domain/job.js'
import type { SourcePreview } from '../../shared/domain/source-ingestion.js'
import {
  CreateSourceInputSchema,
  RssSourceConfigSchema,
  type CreateSourceInput,
  type Source,
  type SourceListFilter,
  type UpdateSourceInput,
} from '../../shared/domain/source.js'
import type { SyncRun, SyncRunListFilter } from '../../shared/domain/sync-run.js'
import type { IpcErrorCode } from '../../shared/ipc/common-contract.js'
import type { SyncSourceResult } from '../../shared/ipc/phase-two-contract.js'
import type { RssConnector } from '../connectors/rss-connector.js'
import { SourceConnectorError } from '../connectors/source-connector.js'
import type { JobRepository } from '../persistence/repositories/job-repository.js'
import type { KnowledgeRepository } from '../persistence/repositories/knowledge-repository.js'
import type { SourceRepository } from '../persistence/repositories/source-repository.js'
import type { SyncRunRepository } from '../persistence/repositories/sync-run-repository.js'

export class SourceServiceError extends Error {
  constructor(
    readonly code: Extract<
      IpcErrorCode,
      | 'CONFLICT'
      | 'SOURCE_NOT_FOUND'
      | 'SOURCE_INVALID_CONFIG'
      | 'SOURCE_FETCH_FAILED'
      | 'SOURCE_UNSUPPORTED'
      | 'SYNC_CONFLICT'
    >,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'SourceServiceError'
  }
}

export class SourceService {
  constructor(
    private readonly dependencies: {
      database: Database.Database
      sourceRepository: SourceRepository
      syncRunRepository: SyncRunRepository
      jobRepository: JobRepository
      knowledgeRepository: KnowledgeRepository
      rssConnector: RssConnector
      createId?: () => string
      onSourceUpdated?: (source: Source) => void
      onSourceDeleted?: (sourceId: string) => void
      onSyncRunUpdated?: (syncRun: SyncRun) => void
      onJobUpdated?: (job: Job) => void
    },
  ) {}

  listSources(filter: SourceListFilter): Source[] {
    return this.dependencies.sourceRepository.list(filter)
  }

  async createSource(input: CreateSourceInput): Promise<Source> {
    const parsed = CreateSourceInputSchema.parse(input)
    if (parsed.type === 'rss') await this.assertValidRssConfig(parsed.config)
    const source = this.dependencies.sourceRepository.create(parsed)
    this.dependencies.onSourceUpdated?.(source)
    return source
  }

  async updateSource(sourceId: string, input: UpdateSourceInput): Promise<Source> {
    const existing = this.requireSource(sourceId)
    if (input.type !== existing.type) {
      throw new SourceServiceError(
        'SOURCE_INVALID_CONFIG',
        `Source type cannot change from ${existing.type} to ${input.type}.`,
      )
    }
    if (existing.type === 'rss' && input.type === 'rss') {
      await this.assertValidRssConfig(input.config ?? existing.config)
    }
    const source = this.dependencies.sourceRepository.update(sourceId, input)
    if (!source) throw new SourceServiceError('SOURCE_NOT_FOUND', `Source ${sourceId} was not found.`)
    this.dependencies.onSourceUpdated?.(source)
    return source
  }

  deleteSource(sourceId: string): { sourceId: string } {
    this.requireSource(sourceId)
    if (this.dependencies.sourceRepository.hasRetainedData(sourceId)) {
      throw new SourceServiceError(
        'CONFLICT',
        'A Source with KnowledgeItems or retained SyncRuns cannot be deleted; disable it instead.',
      )
    }
    if (!this.dependencies.sourceRepository.delete(sourceId)) {
      throw new SourceServiceError('SOURCE_NOT_FOUND', `Source ${sourceId} was not found.`)
    }
    this.dependencies.onSourceDeleted?.(sourceId)
    return { sourceId }
  }

  async previewSource(input: CreateSourceInput): Promise<SourcePreview> {
    const parsed = CreateSourceInputSchema.parse(input)
    if (parsed.type !== 'rss') {
      throw new SourceServiceError('SOURCE_UNSUPPORTED', `${parsed.type} preview is not available in Batch 1.`)
    }
    try {
      return await this.dependencies.rssConnector.preview(parsed.config)
    } catch (error) {
      throw mapConnectorError(error)
    }
  }

  syncSource(sourceId: string): SyncSourceResult {
    const source = this.requireSource(sourceId)
    if (source.type !== 'rss') {
      throw new SourceServiceError('SOURCE_UNSUPPORTED', `${source.type} sync is not available in Batch 1.`)
    }
    if (this.dependencies.syncRunRepository.findActiveBySource(sourceId)) {
      throw new SourceServiceError('SYNC_CONFLICT', `Source ${sourceId} already has an active SyncRun.`)
    }

    try {
      const result = this.dependencies.database.transaction(() => {
        const syncRunId = this.dependencies.createId?.() ?? randomUUID()
        const job = this.dependencies.jobRepository.enqueue({
          vaultId: source.vaultId,
          type: 'source.sync',
          priority: 'normal',
          payload: { sourceId: source.id, syncRunId, trigger: 'manual' },
          maxAttempts: 3,
        })
        const syncRun = this.dependencies.syncRunRepository.create({
          id: syncRunId,
          vaultId: source.vaultId,
          sourceId: source.id,
          jobId: job.id,
          trigger: 'manual',
        })
        return { job, syncRun }
      }).immediate()
      this.dependencies.onJobUpdated?.(result.job)
      this.dependencies.onSyncRunUpdated?.(result.syncRun)
      return result
    } catch (error) {
      if (isConstraintError(error)) {
        throw new SourceServiceError(
          'SYNC_CONFLICT',
          `Source ${sourceId} already has an active SyncRun.`,
          { cause: error },
        )
      }
      throw error
    }
  }

  listSyncRuns(filter: SyncRunListFilter): SyncRun[] {
    return this.dependencies.syncRunRepository.list(filter)
  }

  listInboxItems(filter: InboxItemListFilter): InboxItemSummary[] {
    return this.dependencies.knowledgeRepository.listInboxItems(filter)
  }

  private requireSource(sourceId: string): Source {
    const source = this.dependencies.sourceRepository.getById(sourceId)
    if (!source) throw new SourceServiceError('SOURCE_NOT_FOUND', `Source ${sourceId} was not found.`)
    return source
  }

  private async assertValidRssConfig(config: unknown): Promise<void> {
    const parsed = RssSourceConfigSchema.safeParse(config)
    if (!parsed.success) {
      throw new SourceServiceError('SOURCE_INVALID_CONFIG', parsed.error.message)
    }
    const validation = await this.dependencies.rssConnector.validate(parsed.data)
    if (!validation.valid) {
      throw new SourceServiceError('SOURCE_INVALID_CONFIG', validation.errors.join(' '))
    }
  }
}

function mapConnectorError(error: unknown): SourceServiceError {
  if (error instanceof SourceConnectorError) {
    return new SourceServiceError(error.code, error.message, { cause: error })
  }
  return new SourceServiceError(
    'SOURCE_FETCH_FAILED',
    error instanceof Error ? error.message : String(error),
    { cause: error },
  )
}

function isConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code.startsWith('SQLITE_CONSTRAINT')
  )
}
