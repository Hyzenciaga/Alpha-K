import type { EnqueueJobInput, Job, JobListFilter } from '../../shared/domain/job.js'
import type { JobRepository } from '../persistence/repositories/job-repository.js'

export type JobRecoveryReport = {
  promotedScheduled: number
  interruptedExpired: number
  requeuedInterrupted: number
  failedInterrupted: number
}

export class JobQueueService {
  constructor(
    private readonly repository: JobRepository,
    private readonly onJobUpdated: (job: Job) => void = () => undefined,
  ) {}

  recoverOnStartup(): JobRecoveryReport {
    const promotedScheduled = this.repository.promoteDueScheduled()
    const interruptedExpired = this.repository.interruptExpired()
    const recovered = this.repository.recoverInterrupted()
    return {
      promotedScheduled,
      interruptedExpired,
      requeuedInterrupted: recovered.requeued,
      failedInterrupted: recovered.failed,
    }
  }

  enqueue(input: EnqueueJobInput): Job {
    return this.publish(this.repository.enqueue(input))
  }

  list(filter: JobListFilter = {}): Job[] {
    return this.repository.list(filter)
  }

  claimNext(workerId: string, leaseDurationMs: number): Job | undefined {
    this.repository.promoteDueScheduled()
    return this.publishOptional(this.repository.claimNext(workerId, leaseDurationMs))
  }

  heartbeat(jobId: string, workerId: string, leaseDurationMs: number): Job | undefined {
    return this.publishOptional(this.repository.heartbeat(jobId, workerId, leaseDurationMs))
  }

  complete(jobId: string, workerId: string): Job | undefined {
    return this.publishOptional(this.repository.complete(jobId, workerId))
  }

  fail(
    jobId: string,
    workerId: string,
    error: string,
    options: { retryable: boolean; retryAt?: string },
  ): Job | undefined {
    return this.publishOptional(this.repository.fail(jobId, workerId, error, options))
  }

  cancel(jobId: string): Job | undefined {
    return this.publishOptional(this.repository.cancel(jobId))
  }

  retry(jobId: string): Job | undefined {
    return this.publishOptional(this.repository.retry(jobId))
  }

  interruptForShutdown(): number {
    return this.repository.interruptAllRunning()
  }

  private publish(job: Job): Job {
    this.onJobUpdated(job)
    return job
  }

  private publishOptional(job: Job | undefined): Job | undefined {
    if (job) this.onJobUpdated(job)
    return job
  }
}
