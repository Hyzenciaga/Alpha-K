import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CloudSyncWorker } from '../../src/main/application/cloud-sync-worker.js'
import type { RemoteSyncProvider } from '../../src/main/cloud/remote-sync-provider.js'
import { createStableKnowledgeRef } from '../../src/main/cloud/stable-knowledge-ref.js'
import { openAlphaKDatabase } from '../../src/main/persistence/database.js'
import { CloudSyncRepository } from '../../src/main/persistence/repositories/cloud-sync-repository.js'
import { KnowledgeRepository } from '../../src/main/persistence/repositories/knowledge-repository.js'
import { KnowledgeStateRepository } from '../../src/main/persistence/repositories/knowledge-state-repository.js'
import { SourceRepository } from '../../src/main/persistence/repositories/source-repository.js'
import { VaultRepository } from '../../src/main/persistence/repositories/vault-repository.js'
import type {
  CloudStatus,
  KnowledgeRefUpsert,
  RemoteKnowledgeRef,
  SyncChange,
  UserKnowledgeState,
  UserKnowledgeStateUpsert,
} from '../../src/shared/domain/cloud-sync.js'

const cleanupPaths: string[] = []
const NOW = new Date('2026-07-22T10:00:00.000Z')
const OWNER_ID = '11111111-1111-4111-8111-111111111111'
const VAULT_ID = '22222222-2222-4222-8222-222222222222'
const SOURCE_ID = '33333333-3333-4333-8333-333333333333'
const ITEM_ID = '44444444-4444-4444-8444-444444444444'
const DEVICE_ID = '55555555-5555-4555-8555-555555555555'
const REF_ID = '66666666-6666-4666-8666-666666666666'
const CHANGE_IDS = [
  '77777777-7777-4777-8777-777777777777',
  '88888888-8888-4888-8888-888888888888',
]

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('Phase 3 backend synchronization', () => {
  it('builds a deterministic metadata-only RSS reference', () => {
    const fixture = createFixture()
    const ref = createStableKnowledgeRef(fixture.source, fixture.item)
    expect(ref).toMatchObject({
      kind: 'rss',
      externalId: 'post-1',
      canonicalUrl: 'https://example.com/post?a=1&b=2',
      title: 'Metadata only',
    })
    expect(ref?.refKey).toMatch(/^rss:[a-f0-9]{64}:external:[a-f0-9]{64}$/)
    expect(JSON.stringify(ref)).not.toContain(fixture.vaultPath)
    expect(JSON.stringify(ref)).not.toContain('secret article body')
    fixture.close()
  })

  it('pushes refs before state, pulls the change cursor, and clears the outbox', async () => {
    const fixture = createFixture()
    const provider = new FakeRemoteSyncProvider()
    const statuses: CloudStatus[] = []
    const worker = fixture.createWorker(provider, statuses)
    fixture.states.upsert(ITEM_ID, { read: true, starred: true })
    expect(worker.enqueueKnowledgeItems([ITEM_ID])).toBe(1)
    expect(worker.enqueueUserState(ITEM_ID)).toBe(true)
    expect(fixture.cloud.pendingCount(OWNER_ID)).toBe(2)

    await expect(worker.processOnce()).resolves.toBe(true)

    expect(provider.calls.slice(0, 3)).toEqual(['register-device', 'upsert-ref', 'upsert-state'])
    expect(fixture.cloud.pendingCount(OWNER_ID)).toBe(0)
    expect(fixture.cloud.getCursor(OWNER_ID).pullSequence).toBe(2)
    expect(fixture.cloud.findRemoteRefId(OWNER_ID, provider.ref.refKey)).toBe(REF_ID)
    expect(fixture.states.get(ITEM_ID)).toMatchObject({ read: true, starred: true })
    expect(statuses.at(-1)).toMatchObject({ sync: 'idle', pendingChanges: 0, lastError: null })
    fixture.close()
  })

  it('keeps local outbox data when the network is offline', async () => {
    const fixture = createFixture()
    const statuses: CloudStatus[] = []
    const provider = new FakeRemoteSyncProvider()
    provider.offline = true
    const worker = fixture.createWorker(provider, statuses)
    worker.enqueueKnowledgeItems([ITEM_ID])

    await expect(worker.processOnce()).rejects.toThrow('fetch failed')

    expect(fixture.cloud.pendingCount(OWNER_ID)).toBe(1)
    expect(statuses.at(-1)).toMatchObject({ sync: 'offline', pendingChanges: 1 })
    fixture.close()
  })
})

function createFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'alpha-k-cloud-sync-'))
  cleanupPaths.push(directory)
  const vaultPath = join(directory, 'private-vault')
  const connection = openAlphaKDatabase(join(directory, 'app.sqlite'))
  const now = () => NOW
  new VaultRepository(connection.database, now).registerAndActivate({
    rootPath: vaultPath,
    created: true,
    manifest: {
      schemaVersion: 1,
      vaultId: VAULT_ID,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    },
  })
  const sources = new SourceRepository(connection.database, { now, createId: () => SOURCE_ID })
  const source = sources.create({
    vaultId: VAULT_ID,
    type: 'rss',
    name: 'Research',
    schedule: { kind: 'interval', minutes: 60 },
    config: { feedUrl: 'https://EXAMPLE.com/feed.xml#fragment' },
  })
  const knowledge = new KnowledgeRepository(connection.database, { now, createId: () => ITEM_ID })
  const item = knowledge.create({
    vaultId: VAULT_ID,
    sourceId: SOURCE_ID,
    externalId: ' post-1 ',
    canonicalUrl: 'https://EXAMPLE.com/post/?b=2&a=1#section',
    title: 'Metadata only',
    authors: ['Alpha'],
    fetchedAt: NOW.toISOString(),
    contentHash: 'content-hash',
  })
  const cloud = new CloudSyncRepository(connection.database, {
    now,
    createId: sequenceIds([DEVICE_ID, ...CHANGE_IDS]),
  })
  const states = new KnowledgeStateRepository(connection.database, { now })

  return {
    vaultPath,
    source,
    item,
    cloud,
    states,
    createWorker(provider: RemoteSyncProvider, statusEvents: CloudStatus[]) {
      let status = signedInStatus()
      return new CloudSyncWorker({
        authService: {
          getStatus: () => status,
          getAuthenticatedClient: () => {
            throw new Error('not used by the fake provider')
          },
          updateSyncStatus: (sync, detail = {}) => {
            status = { ...status, sync, ...detail }
            statusEvents.push(status)
          },
        },
        repository: cloud,
        knowledgeRepository: knowledge,
        knowledgeStateRepository: states,
        sourceRepository: sources,
        createProvider: () => provider,
        deviceName: 'Test Mac',
        platform: 'macos',
        appVersion: '0.0.1',
        now,
      })
    },
    close: connection.close,
  }
}

class FakeRemoteSyncProvider implements RemoteSyncProvider {
  calls: string[] = []
  offline = false
  ref: RemoteKnowledgeRef = {
    id: REF_ID,
    refKey: '',
    kind: 'rss',
    sourceKey: null,
    externalId: null,
    canonicalUrl: null,
    contentHash: null,
    title: '',
    authors: [],
    publishedAt: null,
    discoveredAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  }
  state: UserKnowledgeState = {
    knowledgeRefId: REF_ID,
    read: true,
    starred: true,
    disposition: null,
    updatedAt: NOW.toISOString(),
  }

  async registerDevice(): Promise<void> {
    this.calls.push('register-device')
    if (this.offline) throw new Error('fetch failed: offline')
  }

  async upsertKnowledgeRef(_ownerId: string, ref: KnowledgeRefUpsert): Promise<RemoteKnowledgeRef> {
    this.calls.push('upsert-ref')
    this.ref = { id: REF_ID, ...ref, updatedAt: NOW.toISOString() }
    return this.ref
  }

  async upsertUserState(
    _ownerId: string,
    knowledgeRefId: string,
    state: UserKnowledgeStateUpsert,
  ): Promise<UserKnowledgeState> {
    this.calls.push('upsert-state')
    this.state = {
      knowledgeRefId,
      read: state.read,
      starred: state.starred,
      disposition: state.disposition,
      updatedAt: NOW.toISOString(),
    }
    return this.state
  }

  async findKnowledgeRefByKey(): Promise<RemoteKnowledgeRef | null> {
    return this.ref
  }

  async pullChanges(): Promise<SyncChange[]> {
    return [
      {
        id: CHANGE_IDS[0]!,
        sequence: 1,
        entityType: 'knowledge_ref',
        entityId: REF_ID,
        operation: 'upsert',
        changedAt: NOW.toISOString(),
      },
      {
        id: CHANGE_IDS[1]!,
        sequence: 2,
        entityType: 'user_knowledge_state',
        entityId: REF_ID,
        operation: 'upsert',
        changedAt: NOW.toISOString(),
      },
    ]
  }

  async fetchKnowledgeRefs(): Promise<RemoteKnowledgeRef[]> {
    return [this.ref]
  }

  async fetchUserStates(): Promise<UserKnowledgeState[]> {
    return [this.state]
  }
}

function signedInStatus(): CloudStatus {
  return {
    projectRef: 'nuqdxhkwxlzutpdctmtb',
    region: 'Singapore',
    configuration: 'ready',
    auth: 'signed_in',
    user: {
      id: OWNER_ID,
      provider: 'github',
      email: 'alpha@example.com',
      displayName: 'Alpha',
      avatarUrl: null,
    },
    sync: 'idle',
    pendingChanges: 0,
    lastSyncedAt: null,
    lastError: null,
  }
}

function sequenceIds(ids: string[]): () => string {
  let index = 0
  return () => ids[index++] ?? CHANGE_IDS.at(-1)!
}
