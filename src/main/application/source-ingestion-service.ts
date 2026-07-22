import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { DiscoveredItemSchema, type DiscoveredItem } from '../../shared/domain/source-ingestion.js'
import type { Source } from '../../shared/domain/source.js'
import { createExcerpt, type RssConnector } from '../connectors/rss-connector.js'
import type { ArtifactRepository } from '../persistence/repositories/artifact-repository.js'
import type { KnowledgeRepository } from '../persistence/repositories/knowledge-repository.js'
import type { SyncRunCounts } from '../persistence/repositories/sync-run-repository.js'
import type { VaultRepository } from '../persistence/repositories/vault-repository.js'
import { writeAtomicFile, writeAtomicJson } from '../vault/atomic-writer.js'

export type SourceIngestionResult = SyncRunCounts & { changedItemIds: string[] }

export class SourceIngestionService {
  constructor(
    private readonly dependencies: {
      database: Database.Database
      knowledgeRepository: KnowledgeRepository
      artifactRepository: ArtifactRepository
      vaultRepository: VaultRepository
      rssConnector: RssConnector
      now?: () => Date
      createId?: () => string
    },
  ) {}

  async sync(
    source: Source,
    onProgress: (counts: SyncRunCounts) => void = () => undefined,
  ): Promise<SourceIngestionResult> {
    if (source.type !== 'rss') throw new Error(`Unsupported ingestion source type: ${source.type}`)
    const vault = this.dependencies.vaultRepository.getById(source.vaultId)
    if (!vault) throw new Error(`Vault ${source.vaultId} does not exist.`)

    const counts: SyncRunCounts = {
      discoveredCount: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
    }
    const changedItemIds: string[] = []

    for await (const rawItem of this.dependencies.rssConnector.sync({ config: source.config })) {
      const item = DiscoveredItemSchema.parse(rawItem)
      counts.discoveredCount += 1
      const existing = this.findExisting(source.id, item)
      if (existing?.contentHash === item.contentHash) {
        counts.skippedCount += 1
        onProgress({ ...counts })
        continue
      }

      const itemId = existing?.id ?? this.dependencies.createId?.() ?? randomUUID()
      const fetchedAt = this.now()
      const excerpt = createExcerpt(item.content)
      const artifactInput = await this.writeVaultFiles({
        vaultPath: vault.path,
        source,
        item,
        itemId,
        fetchedAt,
        excerpt,
      })

      this.dependencies.database.transaction(() => {
        const knowledgeItem = existing
          ? this.dependencies.knowledgeRepository.updateFromDiscovery(existing.id, {
              externalId: item.externalId,
              canonicalUrl: item.canonicalUrl,
              title: item.title,
              authors: item.authors,
              publishedAt: item.publishedAt,
              fetchedAt,
              status: 'fetched',
              contentHash: item.contentHash,
            })
          : this.dependencies.knowledgeRepository.create(
              {
                vaultId: source.vaultId,
                sourceId: source.id,
                externalId: item.externalId,
                canonicalUrl: item.canonicalUrl,
                title: item.title,
                authors: item.authors,
                publishedAt: item.publishedAt,
                fetchedAt,
                status: 'fetched',
                contentHash: item.contentHash,
              },
              { id: itemId },
            )
        if (!knowledgeItem) throw new Error(`KnowledgeItem ${itemId} disappeared during ingestion.`)

        const primaryArtifact = knowledgeItem.primaryArtifactId
          ? this.dependencies.artifactRepository.updateForIngestion(
              knowledgeItem.primaryArtifactId,
              artifactInput,
            )
          : this.dependencies.artifactRepository.create({
              vaultId: source.vaultId,
              knowledgeItemId: knowledgeItem.id,
              ...artifactInput,
            })
        if (!primaryArtifact) throw new Error(`Artifact for ${itemId} could not be persisted.`)
        if (!knowledgeItem.primaryArtifactId) {
          this.dependencies.knowledgeRepository.setPrimaryArtifact(knowledgeItem.id, primaryArtifact.id)
        }
        this.dependencies.knowledgeRepository.upsertSearchDocument({
          knowledgeItemId: knowledgeItem.id,
          title: item.title,
          summary: excerpt ?? '',
          authors: item.authors,
          labels: source.defaultLabels,
        })
      })()

      if (existing) counts.updatedCount += 1
      else counts.createdCount += 1
      changedItemIds.push(itemId)
      onProgress({ ...counts })
    }

    return { ...counts, changedItemIds }
  }

  private findExisting(sourceId: string, item: DiscoveredItem) {
    if (item.externalId) {
      const match = this.dependencies.knowledgeRepository.findBySourceExternalId(
        sourceId,
        item.externalId,
      )
      if (match) return match
    }
    if (item.canonicalUrl) {
      const match = this.dependencies.knowledgeRepository.findBySourceCanonicalUrl(
        sourceId,
        item.canonicalUrl,
      )
      if (match) return match
    }
    if (!item.externalId && !item.canonicalUrl && item.contentHash) {
      return this.dependencies.knowledgeRepository.findBySourceContentHash(sourceId, item.contentHash)
    }
    return undefined
  }

  private async writeVaultFiles(input: {
    vaultPath: string
    source: Extract<Source, { type: 'rss' }>
    item: ReturnType<typeof DiscoveredItemSchema.parse>
    itemId: string
    fetchedAt: string
    excerpt: string | null
  }) {
    const directory = `inbox/rss/${input.itemId}`
    const content = input.item.content
    const isHtml = content !== null && /<\/?[a-z][\s\S]*>/i.test(content)
    const contentPath = content ? `${directory}/content.${isHtml ? 'html' : 'txt'}` : null
    if (contentPath && content) await writeAtomicFile(input.vaultPath, contentPath, content)
    await writeAtomicJson(input.vaultPath, `${directory}/metadata.json`, {
      schemaVersion: 1,
      id: input.itemId,
      title: input.item.title,
      summary: input.excerpt ?? '',
      authors: input.item.authors,
      labels: input.source.defaultLabels,
      sourceId: input.source.id,
      sourceType: input.source.type,
      externalId: input.item.externalId,
      canonicalUrl: input.item.canonicalUrl,
      publishedAt: input.item.publishedAt,
      fetchedAt: input.fetchedAt,
      rawMetadata: input.item.rawMetadata,
    })
    const reference = input.item.canonicalUrl ?? input.source.config.feedUrl
    return {
      kind: content ? (isHtml ? ('html' as const) : ('text' as const)) : ('external_reference' as const),
      storageMode: content ? ('managed' as const) : ('reference' as const),
      path: contentPath ?? reference,
      mimeType: content ? (isHtml ? 'text/html' : 'text/plain') : null,
      size: content ? Buffer.byteLength(content) : null,
      contentHash: input.item.contentHash,
      lastSeenAt: input.fetchedAt,
    }
  }

  private now(): string {
    return (this.dependencies.now?.() ?? new Date()).toISOString()
  }
}
