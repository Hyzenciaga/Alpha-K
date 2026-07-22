import { describe, expect, it } from 'vitest'
import { InboxItemSummarySchema } from '../../src/shared/domain/inbox.js'
import { SourcePreviewSchema } from '../../src/shared/domain/source-ingestion.js'
import { CreateSourceInputSchema } from '../../src/shared/domain/source.js'
import { SourceSyncJobPayloadSchema, SyncRunSchema } from '../../src/shared/domain/sync-run.js'
import { AppEventSchema } from '../../src/shared/ipc/app-event.js'
import { PHASE_ONE_IPC_CHANNELS } from '../../src/shared/ipc/phase-one-contract.js'
import {
  PhaseTwoIpcRequestSchemas,
  PhaseTwoIpcResponseSchemas,
} from '../../src/shared/ipc/phase-two.js'
import { PHASE_TWO_IPC_CHANNELS } from '../../src/shared/ipc/phase-two-contract.js'

const VAULT_ID = '11111111-1111-4111-8111-111111111111'
const SOURCE_ID = '22222222-2222-4222-8222-222222222222'
const JOB_ID = '33333333-3333-4333-8333-333333333333'
const RUN_ID = '44444444-4444-4444-8444-444444444444'
const ITEM_ID = '55555555-5555-4555-8555-555555555555'
const NOW = '2026-07-22T00:00:00.000Z'

describe('Phase 2 shared contracts', () => {
  it('normalizes RSS defaults and rejects a config for the wrong source type', () => {
    const rss = CreateSourceInputSchema.parse({
      vaultId: VAULT_ID,
      type: 'rss',
      name: 'Example RSS',
      schedule: { kind: 'interval', minutes: 60 },
      config: { feedUrl: 'https://example.com/feed.xml' },
    })
    expect(rss).toMatchObject({
      type: 'rss',
      enabled: true,
      config: { historyWindowDays: 30, maxItemsPerSync: 100 },
    })
    expect(() =>
      CreateSourceInputSchema.parse({
        vaultId: VAULT_ID,
        type: 'rss',
        name: 'Wrong config',
        schedule: { kind: 'interval', minutes: 60 },
        config: { query: 'cat:cs.AI' },
      }),
    ).toThrow()
  })

  it('validates preview, SyncRun, Inbox summary, and push events', () => {
    const preview = SourcePreviewSchema.parse({
      sourceType: 'rss',
      title: 'Example Feed',
      description: null,
      warnings: [],
      items: [
        {
          externalId: 'post-1',
          canonicalUrl: 'https://example.com/post-1',
          title: 'A post',
          authors: ['Alpha'],
          publishedAt: NOW,
          excerpt: 'Preview text',
        },
      ],
    })
    expect(PhaseTwoIpcResponseSchemas.sourcesPreview.parse(preview).items).toHaveLength(1)

    const syncRun = SyncRunSchema.parse({
      id: RUN_ID,
      vaultId: VAULT_ID,
      sourceId: SOURCE_ID,
      jobId: JOB_ID,
      trigger: 'manual',
      status: 'queued',
      discoveredCount: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      error: null,
      startedAt: null,
      finishedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    })
    expect(
      SourceSyncJobPayloadSchema.parse({ sourceId: SOURCE_ID, syncRunId: RUN_ID, trigger: 'manual' }),
    ).toEqual({ sourceId: SOURCE_ID, syncRunId: RUN_ID, trigger: 'manual' })
    expect(AppEventSchema.parse({ type: 'source.sync.updated', syncRun })).toEqual({
      type: 'source.sync.updated',
      syncRun,
    })

    const inboxItem = InboxItemSummarySchema.parse({
      id: ITEM_ID,
      vaultId: VAULT_ID,
      sourceId: SOURCE_ID,
      sourceName: 'Example RSS',
      sourceType: 'rss',
      externalId: 'post-1',
      canonicalUrl: 'https://example.com/post-1',
      title: 'A post',
      authors: ['Alpha'],
      publishedAt: NOW,
      fetchedAt: NOW,
      status: 'fetched',
      primaryArtifactId: null,
      excerpt: 'Preview text',
      labels: ['Research'],
    })
    expect(PhaseTwoIpcResponseSchemas.inboxList.parse([inboxItem])).toEqual([inboxItem])
  })

  it('keeps request schemas strict and channel names globally unique', () => {
    expect(() =>
      PhaseTwoIpcRequestSchemas.sourcesSync.parse({ sourceId: SOURCE_ID, unexpected: true }),
    ).toThrow()
    const channels = [
      ...Object.values(PHASE_ONE_IPC_CHANNELS),
      ...Object.values(PHASE_TWO_IPC_CHANNELS),
    ]
    expect(new Set(channels).size).toBe(channels.length)
  })
})
