import type Database from 'better-sqlite3'
import { ZodError } from 'zod'
import type { Job } from '../../shared/domain/job.js'
import { SourceSyncJobPayloadSchema } from '../../shared/domain/sync-run.js'
import type { Source } from '../../shared/domain/source.js'
import type { SyncRun } from '../../shared/domain/sync-run.js'
import { SourceConnectorError } from '../connectors/source-connector.js'
import type { JobRepository } from '../persistence/repositories/job-repository.js'
import type { SourceRepository } from '../persistence/repositories/source-repository.js'
import type {
  SyncRunCounts,
  SyncRunRepository,
} from '../persistence/repositories/sync-run-repository.js'
import type { SourceIngestionService } from './source-ingestion-service.js'

const EMPTY_COUNTS: SyncRunCounts = {
  discoveredCount: 0,
  createdCount: 0,
  updatedCount: 0,
  skippedCount: 0,
}

export class SourceSyncWorker {
  private timer: NodeJS.Timeout | undefined
  private processing = false
  private stopped = true
  private inFlight: Promise<void> | null = null

  constructor(
    private readonly dependencies: {
      database: Database.Database
      jobRepository: JobRepository
      syncRunRepository: SyncRunRepository
      sourceRepository: SourceRepository
      ingestionService: SourceIngestionService
      workerId: string
      pollIntervalMs?: number
      leaseDurationMs?: number
      heartbeatIntervalMs?: number
      retryBaseDelayMs?: number
      now?: () => Date
      onJobUpdated?: (job: Job) => void
      onSyncRunUpdated?: (syncRun: SyncRun) => void
      onSourceUpdated?: (source: Source) => void
      onInboxChanged?: (itemIds: string[]) => void
      onError?: (error: unknown) => void
    },
  ) {}

  start(): void {
    if (!this.stopped) return
    this.stopped = false
    const interval = this.dependencies.pollIntervalMs ?? 500
    this.timer = setInterval(() => this.trigger(), interval)
    this.timer.unref()
    this.trigger()
  }

  stop(): void {
    this.stopped = true
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
  }

  async shutdown(): Promise<void> {
    this.stop()
    await this.inFlight
  }

  async processNext(): Promise<boolean> {
    if (this.processing) return false
    this.processing = true
    try {
      const job = this.dependencies.jobRepository.claimNext(
        this.dependencies.workerId,
        this.leaseDurationMs,
        ['source.sync'],
      )
      if (!job) return false
      this.dependencies.onJobUpdated?.(job)
      await this.processClaimedJob(job)
      return true
    } finally {
      this.processing = false
    }
  }

  private async processNextSafely(): Promise<void> {
    if (this.stopped) return
    try {
      await this.processNext()
    } catch (error) {
      this.dependencies.onError?.(error)
    }
  }

  private trigger(): void {
    if (this.stopped || this.inFlight) return
    this.inFlight = this.processNextSafely().finally(() => {
      this.inFlight = null
    })
  }

  private async processClaimedJob(job: Job): Promise<void> {
    let counts = { ...EMPTY_COUNTS }
    let syncRun: SyncRun | undefined
    let source: Source | undefined
    const heartbeat = (): void => {
      const updated = this.dependencies.jobRepository.heartbeat(
        job.id,
        this.dependencies.workerId,
        this.leaseDurationMs,
      )
      if (updated) this.dependencies.onJobUpdated?.(updated)
    }
    heartbeat()
    const heartbeatTimer = setInterval(heartbeat, this.heartbeatIntervalMs)
    heartbeatTimer.unref()

    try {
      const payload = SourceSyncJobPayloadSchema.parse(job.payload)
      syncRun = this.dependencies.syncRunRepository.getById(payload.syncRunId)
      if (!syncRun || syncRun.jobId !== job.id || syncRun.sourceId !== payload.sourceId) {
        throw new Error('source.sync payload does not match its SyncRun.')
      }
      source = this.dependencies.sourceRepository.getById(payload.sourceId)
      if (!source) throw new WorkerSourceError('SOURCE_NOT_FOUND', `Source ${payload.sourceId} was not found.`, false)
      if (source.type !== 'rss') {
        throw new WorkerSourceError(
          'SOURCE_UNSUPPORTED',
          `${source.type} sync is not available in Batch 1.`,
          false,
        )
      }
      const running = this.dependencies.syncRunRepository.markRunning(syncRun.id)
      if (!running) throw new Error(`SyncRun ${syncRun.id} could not enter running state.`)
      syncRun = running
      this.dependencies.onSyncRunUpdated?.(running)

      const result = await this.dependencies.ingestionService.sync(source, (progress) => {
        counts = progress
        heartbeat()
        const updated = this.dependencies.syncRunRepository.recordProgress(syncRun!.id, counts)
        if (updated) this.dependencies.onSyncRunUpdated?.(updated)
      })
      counts = {
        discoveredCount: result.discoveredCount,
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        skippedCount: result.skippedCount,
      }
      const completed = this.dependencies.database.transaction(() => {
        const completedRun = this.dependencies.syncRunRepository.succeed(syncRun!.id, counts)
        const completedJob = this.dependencies.jobRepository.complete(job.id, this.dependencies.workerId)
        const updatedSource = this.dependencies.sourceRepository.recordSyncResult(source!.id, {})
        if (!completedRun || !completedJob || !updatedSource) {
          throw new Error('Unable to complete source.sync records consistently.')
        }
        return { completedRun, completedJob, updatedSource }
      })()
      this.dependencies.onSyncRunUpdated?.(completed.completedRun)
      this.dependencies.onJobUpdated?.(completed.completedJob)
      this.dependencies.onSourceUpdated?.(completed.updatedSource)
      if (result.changedItemIds.length) this.dependencies.onInboxChanged?.(result.changedItemIds)
    } catch (error) {
      await this.failClaimedJob(job, syncRun, source, counts, error)
    } finally {
      clearInterval(heartbeatTimer)
    }
  }

  private async failClaimedJob(
    job: Job,
    syncRun: SyncRun | undefined,
    source: Source | undefined,
    counts: SyncRunCounts,
    error: unknown,
  ): Promise<void> {
    const failure = classifyFailure(error)
    const message = `${failure.code}: ${failure.message}`
    const retryAt = new Date(
      this.now().getTime() +
        Math.min(this.retryBaseDelayMs * 2 ** Math.max(0, job.attempt - 1), 30_000),
    ).toISOString()
    const updated = this.dependencies.database.transaction(() => {
      const failedJob = this.dependencies.jobRepository.fail(job.id, this.dependencies.workerId, message, {
        retryable: failure.retryable,
        retryAt,
      })
      if (!failedJob) throw new Error(`Job ${job.id} could not be failed.`)
      const updatedRun = syncRun
        ? failedJob.status === 'queued'
          ? this.dependencies.syncRunRepository.interrupt(syncRun.id, message, counts)
          : this.dependencies.syncRunRepository.fail(syncRun.id, message, counts)
        : undefined
      if (syncRun && !updatedRun) throw new Error(`SyncRun ${syncRun.id} could not be failed.`)
      const updatedSource = source
        ? this.dependencies.sourceRepository.recordSyncResult(source.id, { error: message })
        : undefined
      return { failedJob, updatedRun, updatedSource }
    })()
    if (updated.updatedRun) this.dependencies.onSyncRunUpdated?.(updated.updatedRun)
    this.dependencies.onJobUpdated?.(updated.failedJob)
    if (updated.updatedSource) this.dependencies.onSourceUpdated?.(updated.updatedSource)
  }

  private get leaseDurationMs(): number {
    return this.dependencies.leaseDurationMs ?? 30_000
  }

  private get heartbeatIntervalMs(): number {
    return this.dependencies.heartbeatIntervalMs ?? Math.max(250, Math.floor(this.leaseDurationMs / 3))
  }

  private get retryBaseDelayMs(): number {
    return this.dependencies.retryBaseDelayMs ?? 1_000
  }

  private now(): Date {
    return this.dependencies.now?.() ?? new Date()
  }
}

class WorkerSourceError extends Error {
  constructor(
    readonly code: 'SOURCE_NOT_FOUND' | 'SOURCE_UNSUPPORTED',
    message: string,
    readonly retryable: boolean,
  ) {
    super(message)
  }
}

function classifyFailure(error: unknown): {
  code: string
  message: string
  retryable: boolean
} {
  if (error instanceof SourceConnectorError || error instanceof WorkerSourceError) {
    return { code: error.code, message: error.message, retryable: error.retryable }
  }
  if (error instanceof ZodError) {
    return { code: 'SOURCE_INVALID_CONFIG', message: error.message, retryable: false }
  }
  return {
    code: 'SOURCE_FETCH_FAILED',
    message: error instanceof Error ? error.message : String(error),
    retryable: false,
  }
}
