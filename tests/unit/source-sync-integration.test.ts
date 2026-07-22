import { mkdtempSync } from 'node:fs'
import { readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { JobQueueService } from '../../src/main/application/job-queue-service.js'
import { SourceIngestionService } from '../../src/main/application/source-ingestion-service.js'
import { SourceService } from '../../src/main/application/source-service.js'
import { SourceSyncWorker } from '../../src/main/application/source-sync-worker.js'
import { RssConnector } from '../../src/main/connectors/rss-connector.js'
import { openAlphaKDatabase } from '../../src/main/persistence/database.js'
import { ArtifactRepository } from '../../src/main/persistence/repositories/artifact-repository.js'
import { JobRepository } from '../../src/main/persistence/repositories/job-repository.js'
import { KnowledgeRepository } from '../../src/main/persistence/repositories/knowledge-repository.js'
import { SourceRepository } from '../../src/main/persistence/repositories/source-repository.js'
import { SyncRunRepository } from '../../src/main/persistence/repositories/sync-run-repository.js'
import { VaultRepository } from '../../src/main/persistence/repositories/vault-repository.js'
import { initializeVault } from '../../src/main/vault/vault-manager.js'
import type { Job } from '../../src/shared/domain/job.js'

const cleanupPaths: string[] = []
const VAULT_ID = '11111111-1111-4111-8111-111111111111'
const SOURCE_IDS = [
  '22222222-2222-4222-8222-222222222222',
  '23333333-3333-4333-8333-333333333333',
  '24444444-4444-4444-8444-444444444444',
]

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('Phase 2 manual RSS synchronization', () => {
  it('previews read-only, syncs Source to Inbox, and deduplicates by GUID, URL, and hash', async () => {
    let servedXml = await rssFixture()
    const fixture = await createFixture(async () => new Response(servedXml, { status: 200 }))
    const feedUrl = 'https://example.com/feed.xml'
    const source = await fixture.createSource(feedUrl)

    const beforePreview = tableCounts(fixture.database)
    const preview = await fixture.sourceService.previewSource(sourceInput(feedUrl, 'Preview'))
    expect(preview.items).toHaveLength(3)
    expect(tableCounts(fixture.database)).toEqual(beforePreview)
    expect(await readdir(join(fixture.vaultPath, 'inbox/rss'))).toEqual([])

    const first = fixture.sourceService.syncSource(source.id)
    expect(first).toMatchObject({ job: { status: 'queued' }, syncRun: { status: 'queued' } })
    expect(() => fixture.sourceService.syncSource(source.id)).toThrowError(
      expect.objectContaining({ code: 'SYNC_CONFLICT' }),
    )
    await expect(fixture.worker.processNext()).resolves.toBe(true)

    expect(fixture.jobs.getById(first.job.id)).toMatchObject({ status: 'succeeded', attempt: 1 })
    expect(fixture.syncRuns.getById(first.syncRun.id)).toMatchObject({
      status: 'succeeded',
      discoveredCount: 3,
      createdCount: 3,
      updatedCount: 0,
      skippedCount: 0,
      error: null,
    })
    expect(
      fixture.jobEvents.some(
        (job) => job.status === 'running' && job.heartbeatAt !== null && job.leaseExpiresAt !== null,
      ),
    ).toBe(true)

    const inbox = fixture.sourceService.listInboxItems({ vaultId: VAULT_ID, limit: 50, offset: 0 })
    expect(inbox).toHaveLength(3)
    expect(inbox[0]).toMatchObject({
      sourceName: 'Research',
      sourceType: 'rss',
      status: 'fetched',
      primaryArtifactId: expect.any(String),
      labels: ['Research'],
    })
    expect(inbox.find(({ title }) => title === 'First Article')?.excerpt).toBe(
      'Detailed research content.',
    )

    const guidItem = fixture.knowledge.findBySourceExternalId(source.id, 'article-1')
    const urlItem = fixture.knowledge.findBySourceCanonicalUrl(
      source.id,
      'https://example.com/articles/2',
    )
    const hashOnly = fixture.knowledge
      .list({ vaultId: VAULT_ID, limit: 50, offset: 0 })
      .find(({ externalId, canonicalUrl }) => externalId === null && canonicalUrl === null)
    expect(guidItem).toBeDefined()
    expect(urlItem).toBeDefined()
    expect(hashOnly?.contentHash).toBeTruthy()
    expect(
      fixture.knowledge.findBySourceContentHash(source.id, hashOnly!.contentHash!),
    ).toMatchObject({ id: hashOnly?.id })

    const second = fixture.sourceService.syncSource(source.id)
    await expect(fixture.worker.processNext()).resolves.toBe(true)
    expect(fixture.syncRuns.getById(second.syncRun.id)).toMatchObject({
      status: 'succeeded',
      discoveredCount: 3,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 3,
    })
    expect(tableCounts(fixture.database).knowledgeItems).toBe(3)

    servedXml = servedXml
      .replace('First Article', 'First Article Revised')
      .replace('Detailed <strong>research</strong> content.', 'Revised research content.')
    const third = fixture.sourceService.syncSource(source.id)
    await expect(fixture.worker.processNext()).resolves.toBe(true)
    expect(fixture.syncRuns.getById(third.syncRun.id)).toMatchObject({
      status: 'succeeded',
      discoveredCount: 3,
      createdCount: 0,
      updatedCount: 1,
      skippedCount: 2,
    })
    expect(fixture.knowledge.findBySourceExternalId(source.id, 'article-1')).toMatchObject({
      title: 'First Article Revised',
    })
    expect(
      fixture.sourceService.listInboxItems({
        vaultId: VAULT_ID,
        search: 'Revised',
        limit: 50,
        offset: 0,
      }),
    ).toEqual([expect.objectContaining({ title: 'First Article Revised' })])
    expect(() => fixture.sourceService.deleteSource(source.id)).toThrowError(
      expect.objectContaining({ code: 'CONFLICT' }),
    )
    fixture.close()
  })

  it('bounds retryable failures and does not let one bad Source stop the next Source', async () => {
    const xml = await rssFixture()
    const fixture = await createFixture(async (input) => {
      const url = String(input)
      if (url.includes('retry')) return new Response('temporary', { status: 503 })
      if (url.includes('bad')) return new Response('bad request', { status: 400 })
      return new Response(xml, { status: 200 })
    })
    const retrySource = await fixture.createSource('https://example.com/retry.xml', 'Retry')
    const retry = fixture.sourceService.syncSource(retrySource.id)
    await fixture.worker.processNext()
    expect(fixture.jobs.getById(retry.job.id)?.status).toBe('queued')
    expect(fixture.syncRuns.getById(retry.syncRun.id)).toMatchObject({ status: 'interrupted' })
    await fixture.worker.processNext()
    await fixture.worker.processNext()
    expect(fixture.jobs.getById(retry.job.id)).toMatchObject({ status: 'failed', attempt: 3 })
    expect(fixture.syncRuns.getById(retry.syncRun.id)).toMatchObject({
      status: 'failed',
      error: expect.stringContaining('SOURCE_FETCH_FAILED'),
    })

    const badSource = await fixture.createSource('https://example.com/bad.xml', 'Bad')
    const goodSource = await fixture.createSource('https://example.com/good.xml', 'Good')
    const bad = fixture.sourceService.syncSource(badSource.id)
    const good = fixture.sourceService.syncSource(goodSource.id)
    await fixture.worker.processNext()
    await fixture.worker.processNext()
    expect(fixture.syncRuns.getById(bad.syncRun.id)?.status).toBe('failed')
    expect(fixture.syncRuns.getById(good.syncRun.id)?.status).toBe('succeeded')
    fixture.close()
  })

  it('keeps a cancelled queued Job and SyncRun consistent and out of the worker', async () => {
    const fixture = await createFixture(async () => new Response(await rssFixture(), { status: 200 }))
    const source = await fixture.createSource('https://example.com/feed.xml')
    const queued = fixture.sourceService.syncSource(source.id)
    const queue = new JobQueueService(fixture.jobs, (job) => {
      if (job.type === 'source.sync' && job.status === 'cancelled') {
        fixture.syncRuns.cancelByJobId(job.id)
      }
    })
    expect(queue.cancel(queued.job.id)?.status).toBe('cancelled')
    expect(fixture.syncRuns.getById(queued.syncRun.id)?.status).toBe('cancelled')
    await expect(fixture.worker.processNext()).resolves.toBe(false)
    fixture.close()
  })
})

async function createFixture(fetchImplementation: typeof fetch): Promise<{
  database: Database.Database
  vaultPath: string
  sourceService: SourceService
  worker: SourceSyncWorker
  jobs: JobRepository
  syncRuns: SyncRunRepository
  knowledge: KnowledgeRepository
  jobEvents: Job[]
  createSource: (feedUrl: string, name?: string) => ReturnType<SourceService['createSource']>
  close: () => void
}> {
  const directory = mkdtempSync(join(tmpdir(), 'alpha-k-source-sync-'))
  cleanupPaths.push(directory)
  const vaultPath = join(directory, 'vault')
  const { mkdir } = await import('node:fs/promises')
  await mkdir(vaultPath)
  const connection = openAlphaKDatabase(join(directory, 'app.sqlite'))
  const currentTime = Date.parse('2026-07-22T00:00:00.000Z')
  const now = (): Date => new Date(currentTime)
  const initialized = await initializeVault(vaultPath, { now, createId: () => VAULT_ID })
  const vaults = new VaultRepository(connection.database, now)
  vaults.registerAndActivate(initialized)
  let sourceIdIndex = 0
  const sources = new SourceRepository(connection.database, {
    now,
    createId: () => SOURCE_IDS[sourceIdIndex++]!,
  })
  const jobs = new JobRepository(connection.database, { now })
  const syncRuns = new SyncRunRepository(connection.database, { now })
  const knowledge = new KnowledgeRepository(connection.database, { now })
  const artifacts = new ArtifactRepository(connection.database, { now })
  const rssConnector = new RssConnector({ now, fetch: fetchImplementation })
  const jobEvents: Job[] = []
  const sourceService = new SourceService({
    database: connection.database,
    sourceRepository: sources,
    syncRunRepository: syncRuns,
    jobRepository: jobs,
    knowledgeRepository: knowledge,
    rssConnector,
  })
  const ingestionService = new SourceIngestionService({
    database: connection.database,
    knowledgeRepository: knowledge,
    artifactRepository: artifacts,
    vaultRepository: vaults,
    rssConnector,
    now,
  })
  const worker = new SourceSyncWorker({
    database: connection.database,
    jobRepository: jobs,
    syncRunRepository: syncRuns,
    sourceRepository: sources,
    ingestionService,
    workerId: 'test-worker',
    retryBaseDelayMs: 0,
    now,
    onJobUpdated: (job) => jobEvents.push(job),
  })
  return {
    database: connection.database,
    vaultPath,
    sourceService,
    worker,
    jobs,
    syncRuns,
    knowledge,
    jobEvents,
    createSource: (feedUrl, name = 'Research') => sourceService.createSource(sourceInput(feedUrl, name)),
    close: connection.close,
  }
}

function sourceInput(feedUrl: string, name: string) {
  return {
    vaultId: VAULT_ID,
    type: 'rss' as const,
    name,
    schedule: { kind: 'interval' as const, minutes: 60 },
    config: { feedUrl },
    defaultLabels: ['Research'],
  }
}

function tableCounts(database: Database.Database): {
  jobs: number
  syncRuns: number
  knowledgeItems: number
} {
  const count = (table: string): number =>
    (database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count
  return {
    jobs: count('jobs'),
    syncRuns: count('source_sync_runs'),
    knowledgeItems: count('knowledge_items'),
  }
}

async function rssFixture(): Promise<string> {
  const { readFile } = await import('node:fs/promises')
  return readFile(new URL('../fixtures/rss/sample-rss.xml', import.meta.url), 'utf8')
}
