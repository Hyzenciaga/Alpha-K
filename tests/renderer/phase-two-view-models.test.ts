import { describe, expect, it } from 'vitest'
import type { CreateSourceInput } from '../../src/shared/domain/source.js'
import type { IpcError } from '../../src/shared/ipc/phase-one-contract.js'
import type { PhaseTwoApi } from '../../src/shared/ipc/phase-two-contract.js'
const fixtureModulePath = '../../src/renderer/src/fixtures/phase-two-client.js'
const viewModelModulePath = '../../src/renderer/src/phase-two-view-models.js'
const {
  failedInboxItem,
  failedSyncRun,
  fetchedInboxItem,
  FIXTURE_SOURCE_ID,
  FIXTURE_VAULT_ID,
  InMemoryPhaseTwoClient,
  queuedSyncResult,
  rssSource,
  sourcePreview,
  succeededSyncRun,
} = await import(fixtureModulePath)
const {
  buildInboxFilter,
  InboxViewModel,
  INBOX_PHASE_FOUR_ACTIONS,
  latestSyncRunsBySource,
  SourcesViewModel,
} = await import(viewModelModulePath)

const createInput = {
  vaultId: FIXTURE_VAULT_ID,
  type: 'rss',
  name: 'New RSS',
  enabled: true,
  schedule: { kind: 'interval', minutes: 60 },
  defaultLabels: ['Research'],
  workflowId: null,
  config: {
    feedUrl: 'https://new.example.com/feed.xml',
    includeKeywords: [],
    excludeKeywords: [],
    historyWindowDays: 30,
    maxItemsPerSync: 100,
  },
} satisfies CreateSourceInput

const ipcError = {
  code: 'SOURCE_FETCH_FAILED',
  message: 'The feed could not be fetched.',
} satisfies IpcError

describe('SourcesViewModel', () => {
  it('exposes loading before resolving to the empty state', async () => {
    const client = new InMemoryPhaseTwoClient()
    let resolveSources: ((value: Awaited<ReturnType<PhaseTwoApi['listSources']>>) => void) | undefined
    client.listSources = () => new Promise((resolve) => {
      resolveSources = resolve
    })
    const viewModel = new SourcesViewModel(client, FIXTURE_VAULT_ID)

    const refresh = viewModel.refresh()
    expect(viewModel.state.status).toBe('loading')
    resolveSources?.({ ok: true, data: [] })
    await refresh

    expect(viewModel.state).toMatchObject({ status: 'empty', sources: [], syncRuns: [] })
  })

  it('previews, creates, updates, syncs, and deletes through the typed client', async () => {
    const client = new InMemoryPhaseTwoClient({ preview: sourcePreview, syncResult: queuedSyncResult })
    const viewModel = new SourcesViewModel(client, FIXTURE_VAULT_ID)

    expect(await viewModel.preview(createInput)).toEqual(sourcePreview)
    const created = await viewModel.create(createInput)
    expect(created.name).toBe('New RSS')

    const updated = await viewModel.update(created.id, { type: 'rss', name: 'Renamed RSS' })
    expect(updated.name).toBe('Renamed RSS')

    const sync = await viewModel.sync(created.id)
    expect(sync).toEqual(queuedSyncResult)
    expect(viewModel.state.lastSyncRequest).toEqual(queuedSyncResult)

    await expect(viewModel.delete(created.id)).resolves.toBe(created.id)
    expect(client.sources).toEqual([])
    expect(client.calls).toMatchObject({
      previewSource: 1,
      createSource: 1,
      updateSource: 1,
      syncSource: 1,
      deleteSource: 1,
    })
  })

  it.each([
    'previewSource',
    'createSource',
    'updateSource',
    'deleteSource',
    'syncSource',
  ] satisfies Array<keyof PhaseTwoApi>)('surfaces %s failures instead of substituting fixture data', async (method: keyof PhaseTwoApi) => {
    const client = new InMemoryPhaseTwoClient({ sources: [rssSource] })
    client.fail(method, ipcError)
    const viewModel = new SourcesViewModel(client, FIXTURE_VAULT_ID)
    let action: Promise<unknown>
    if (method === 'previewSource') action = viewModel.preview(createInput)
    else if (method === 'createSource') action = viewModel.create(createInput)
    else if (method === 'updateSource') action = viewModel.update(FIXTURE_SOURCE_ID, { type: 'rss', name: 'Nope' })
    else if (method === 'deleteSource') action = viewModel.delete(FIXTURE_SOURCE_ID)
    else action = viewModel.sync(FIXTURE_SOURCE_ID)

    await expect(action).rejects.toThrow(ipcError.message)
    expect(viewModel.state.actionError).toBe(ipcError.message)
  })

  it('renders a Source list IPC failure as an error state', async () => {
    const client = new InMemoryPhaseTwoClient({ sources: [rssSource] })
    client.fail('listSources', { code: 'INTERNAL_ERROR', message: 'Source query failed.' })
    const viewModel = new SourcesViewModel(client, FIXTURE_VAULT_ID)

    await viewModel.refresh()

    expect(viewModel.state).toMatchObject({ status: 'error', sources: [], syncRuns: [], error: 'Source query failed.' })
  })

  it('keeps failed SyncRun counters and failure details in the latest run projection', () => {
    const latest = latestSyncRunsBySource([succeededSyncRun, failedSyncRun])

    expect(latest.get(FIXTURE_SOURCE_ID)).toMatchObject({
      status: 'failed',
      discoveredCount: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      error: 'Feed returned HTTP 503.',
    })
  })
})

describe('InboxViewModel', () => {
  it('renders empty, populated, source/status-filtered, and failed item states from server results', async () => {
    const client = new InMemoryPhaseTwoClient({
      sources: [rssSource],
      inboxItems: [fetchedInboxItem, failedInboxItem],
    })
    const viewModel = new InboxViewModel(client, FIXTURE_VAULT_ID)

    await viewModel.refresh(buildInboxFilter(FIXTURE_VAULT_ID, { search: 'missing' }))
    expect(viewModel.state.status).toBe('empty')

    await viewModel.refresh(buildInboxFilter(FIXTURE_VAULT_ID))
    expect(viewModel.state.status).toBe('ready')
    expect(viewModel.state.items).toEqual([fetchedInboxItem, failedInboxItem])

    await viewModel.refresh(buildInboxFilter(FIXTURE_VAULT_ID, {
      sourceId: FIXTURE_SOURCE_ID,
      status: 'failed',
      search: 'could not',
    }))
    expect(viewModel.state.items).toEqual([failedInboxItem])
    expect(client.calls.listInboxItems.at(-1)).toMatchObject({
      sourceIds: [FIXTURE_SOURCE_ID],
      statuses: ['failed'],
      search: 'could not',
    })
  })

  it('renders an IPC error state when the server-backed query fails', async () => {
    const client = new InMemoryPhaseTwoClient({ sources: [rssSource] })
    client.fail('listInboxItems', { code: 'INTERNAL_ERROR', message: 'Inbox query failed.' })
    const viewModel = new InboxViewModel(client, FIXTURE_VAULT_ID)

    await viewModel.refresh()

    expect(viewModel.state).toMatchObject({ status: 'error', items: [], error: 'Inbox query failed.' })
  })

  it('re-fetches affected lists when app events arrive', async () => {
    const sourceClient = new InMemoryPhaseTwoClient({ sources: [rssSource] })
    const sourceViewModel = new SourcesViewModel(sourceClient, FIXTURE_VAULT_ID)
    const stopSources = sourceViewModel.subscribe(() => undefined)
    await sourceViewModel.refresh()
    const sourceCalls = sourceClient.calls.listSources

    sourceClient.emit({ type: 'source.sync.updated', syncRun: failedSyncRun })
    await waitFor(() => sourceClient.calls.listSources > sourceCalls)
    stopSources()

    const inboxClient = new InMemoryPhaseTwoClient({ sources: [rssSource], inboxItems: [] })
    const inboxViewModel = new InboxViewModel(inboxClient, FIXTURE_VAULT_ID)
    const stopInbox = inboxViewModel.subscribe(() => undefined)
    await inboxViewModel.refresh()
    inboxClient.inboxItems = [fetchedInboxItem]
    const inboxCalls = inboxClient.calls.listInboxItems.length

    inboxClient.emit({ type: 'inbox.changed', itemIds: [fetchedInboxItem.id] })
    await waitFor(() => inboxClient.calls.listInboxItems.length > inboxCalls && inboxViewModel.state.status === 'ready')
    expect(inboxViewModel.state.items).toEqual([fetchedInboxItem])
    stopInbox()
  })

  it('keeps Phase 4 actions disabled and does not invent Agent fields', () => {
    expect(INBOX_PHASE_FOUR_ACTIONS.every((action: { disabled: boolean }) => action.disabled)).toBe(true)
    expect(Object.keys(fetchedInboxItem)).not.toContain('confidence')
    expect(Object.keys(fetchedInboxItem)).not.toContain('importance')
    expect(Object.keys(fetchedInboxItem)).not.toContain('suggestedLabels')
  })
})

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  throw new Error('Timed out waiting for renderer refresh.')
}
