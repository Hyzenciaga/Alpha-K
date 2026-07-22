import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openAlphaKDatabase } from '../../src/main/persistence/database.js'
import { ArtifactRepository } from '../../src/main/persistence/repositories/artifact-repository.js'
import { KnowledgeRepository } from '../../src/main/persistence/repositories/knowledge-repository.js'
import { SourceRepository } from '../../src/main/persistence/repositories/source-repository.js'
import { VaultRepository } from '../../src/main/persistence/repositories/vault-repository.js'

const cleanupPaths: string[] = []
const NOW = new Date('2026-07-22T00:00:00.000Z')
const VAULT_ID = '11111111-1111-4111-8111-111111111111'
const SOURCE_ID = '22222222-2222-4222-8222-222222222222'
const ITEM_ID = '33333333-3333-4333-8333-333333333333'
const ARTIFACT_ID = '44444444-4444-4444-8444-444444444444'

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('Phase 1 domain repositories', () => {
  it('round-trips Source, KnowledgeItem, Artifact, and search documents', () => {
    const directory = mkdtempSync(join(tmpdir(), 'alpha-k-domain-'))
    cleanupPaths.push(directory)
    const connection = openAlphaKDatabase(join(directory, 'app.sqlite'))
    const now = () => NOW
    new VaultRepository(connection.database, now).registerAndActivate({
      rootPath: join(directory, 'vault'),
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
      name: '研究动态',
      schedule: { kind: 'interval', minutes: 60 },
      config: { url: 'https://example.com/feed.xml' },
      defaultLabels: ['AI'],
    })
    expect(source).toMatchObject({ id: SOURCE_ID, enabled: true, lastSyncAt: null })

    const knowledge = new KnowledgeRepository(connection.database, { now, createId: () => ITEM_ID })
    const item = knowledge.create({
      vaultId: VAULT_ID,
      sourceId: SOURCE_ID,
      externalId: 'post-1',
      canonicalUrl: 'https://example.com/post-1',
      title: '本地知识管理',
      authors: ['Alpha'],
      fetchedAt: NOW.toISOString(),
    })
    expect(knowledge.findBySourceExternalId(SOURCE_ID, 'post-1')?.id).toBe(item.id)
    expect(knowledge.updateStatus(item.id, 'accepted')?.status).toBe('accepted')

    const artifacts = new ArtifactRepository(connection.database, { now, createId: () => ARTIFACT_ID })
    const artifact = artifacts.create({
      vaultId: VAULT_ID,
      knowledgeItemId: item.id,
      kind: 'markdown',
      storageMode: 'managed',
      path: `library/2026/${ITEM_ID}/content.md`,
    })
    expect(artifacts.markSeen(artifact.id, { size: 42, contentHash: 'abc' })).toMatchObject({
      size: 42,
      contentHash: 'abc',
      missingSince: null,
    })
    expect(knowledge.setPrimaryArtifact(item.id, artifact.id)?.primaryArtifactId).toBe(artifact.id)

    knowledge.upsertSearchDocument({
      knowledgeItemId: item.id,
      title: item.title,
      summary: '一篇关于本地优先知识库的文章',
      authors: item.authors,
      labels: ['知识管理'],
    })
    expect(knowledge.search('知识管理')).toEqual([
      expect.objectContaining({ knowledgeItemId: item.id, title: item.title, labels: ['知识管理'] }),
    ])
    connection.close()
  })
})
