import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { IdSchema } from '../../../shared/domain/common.js'
import {
  CreateKnowledgeItemInputSchema,
  KnowledgeItemListFilterSchema,
  KnowledgeItemSchema,
  KnowledgeItemStatusSchema,
  SearchDocumentSchema,
  SearchResultSchema,
  type CreateKnowledgeItemInput,
  type KnowledgeItem,
  type KnowledgeItemListFilter,
  type SearchDocument,
  type SearchResult,
} from '../../../shared/domain/knowledge.js'

type KnowledgeItemRow = {
  id: string
  vault_id: string
  source_id: string
  external_id: string | null
  canonical_url: string | null
  title: string
  authors_json: string
  published_at: string | null
  fetched_at: string
  status: string
  primary_artifact_id: string | null
  content_hash: string | null
  created_at: string
  updated_at: string
}

type SearchRow = {
  knowledge_item_id: string
  title: string
  summary: string
  authors: string
  labels: string
  rank: number
  snippet: string
}

export class KnowledgeRepository {
  constructor(
    private readonly database: Database.Database,
    private readonly dependencies: {
      now?: () => Date
      createId?: () => string
    } = {},
  ) {}

  create(input: CreateKnowledgeItemInput): KnowledgeItem {
    const parsed = CreateKnowledgeItemInputSchema.parse(input)
    const id = this.dependencies.createId?.() ?? randomUUID()
    const now = this.now()
    this.database
      .prepare(
        `INSERT INTO knowledge_items (
          id, vault_id, source_id, external_id, canonical_url, title, authors_json,
          published_at, fetched_at, status, primary_artifact_id, content_hash,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        parsed.vaultId,
        parsed.sourceId,
        parsed.externalId,
        parsed.canonicalUrl,
        parsed.title,
        JSON.stringify(parsed.authors),
        parsed.publishedAt,
        parsed.fetchedAt,
        parsed.status,
        parsed.primaryArtifactId,
        parsed.contentHash,
        now,
        now,
      )
    return this.getById(id)!
  }

  getById(id: string): KnowledgeItem | undefined {
    const row = this.database
      .prepare('SELECT * FROM knowledge_items WHERE id = ?')
      .get(IdSchema.parse(id)) as KnowledgeItemRow | undefined
    return row ? mapKnowledgeItem(row) : undefined
  }

  findBySourceExternalId(sourceId: string, externalId: string): KnowledgeItem | undefined {
    const row = this.database
      .prepare('SELECT * FROM knowledge_items WHERE source_id = ? AND external_id = ?')
      .get(IdSchema.parse(sourceId), externalId) as KnowledgeItemRow | undefined
    return row ? mapKnowledgeItem(row) : undefined
  }

  list(filter: KnowledgeItemListFilter): KnowledgeItem[] {
    const parsed = KnowledgeItemListFilterSchema.parse(filter)
    const conditions = ['vault_id = ?']
    const parameters: unknown[] = [parsed.vaultId]
    if (parsed.statuses?.length) {
      conditions.push(`status IN (${parsed.statuses.map(() => '?').join(', ')})`)
      parameters.push(...parsed.statuses)
    }
    parameters.push(parsed.limit, parsed.offset)
    const rows = this.database
      .prepare(
        `SELECT * FROM knowledge_items
         WHERE ${conditions.join(' AND ')}
         ORDER BY fetched_at DESC, created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...parameters) as KnowledgeItemRow[]
    return rows.map(mapKnowledgeItem)
  }

  updateStatus(id: string, status: KnowledgeItem['status']): KnowledgeItem | undefined {
    const parsedId = IdSchema.parse(id)
    const parsedStatus = KnowledgeItemStatusSchema.parse(status)
    const now = this.now()
    const result = this.database
      .prepare('UPDATE knowledge_items SET status = ?, updated_at = ? WHERE id = ?')
      .run(parsedStatus, now, parsedId)
    return result.changes === 1 ? this.getById(parsedId) : undefined
  }

  setPrimaryArtifact(id: string, artifactId: string): KnowledgeItem | undefined {
    const parsedId = IdSchema.parse(id)
    const parsedArtifactId = IdSchema.parse(artifactId)
    const now = this.now()
    const result = this.database
      .prepare('UPDATE knowledge_items SET primary_artifact_id = ?, updated_at = ? WHERE id = ?')
      .run(parsedArtifactId, now, parsedId)
    return result.changes === 1 ? this.getById(parsedId) : undefined
  }

  upsertSearchDocument(document: SearchDocument): void {
    const parsed = SearchDocumentSchema.parse(document)
    this.database.transaction(() => {
      this.deleteSearchDocument(parsed.knowledgeItemId)
      this.insertSearchDocument(parsed)
    })()
  }

  replaceSearchIndex(documents: SearchDocument[]): number {
    const parsed = documents.map((document) => SearchDocumentSchema.parse(document))
    this.database.transaction(() => {
      this.database.exec('DELETE FROM knowledge_items_fts')
      for (const document of parsed) this.insertSearchDocument(document)
    })()
    return parsed.length
  }

  deleteSearchDocument(knowledgeItemId: string): boolean {
    return (
      this.database
        .prepare('DELETE FROM knowledge_items_fts WHERE knowledge_item_id = ?')
        .run(IdSchema.parse(knowledgeItemId)).changes > 0
    )
  }

  search(query: string, limit = 50): SearchResult[] {
    const normalizedQuery = query.trim()
    if (!normalizedQuery) return []
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('Search limit must be 1 to 200.')
    const phrase = `"${normalizedQuery.replaceAll('"', '""')}"`
    const rows = this.database
      .prepare(
        `SELECT
          knowledge_item_id, title, summary, authors, labels,
          bm25(knowledge_items_fts) AS rank,
          snippet(knowledge_items_fts, 2, '<mark>', '</mark>', '…', 24) AS snippet
         FROM knowledge_items_fts
         WHERE knowledge_items_fts MATCH ?
         ORDER BY rank LIMIT ?`,
      )
      .all(phrase, limit) as SearchRow[]
    return rows.map((row) =>
      SearchResultSchema.parse({
        knowledgeItemId: row.knowledge_item_id,
        title: row.title,
        summary: row.summary,
        authors: splitSearchList(row.authors),
        labels: splitSearchList(row.labels),
        rank: row.rank,
        snippet: row.snippet,
      }),
    )
  }

  private insertSearchDocument(document: ReturnType<typeof SearchDocumentSchema.parse>): void {
    this.database
      .prepare(
        `INSERT INTO knowledge_items_fts
          (knowledge_item_id, title, summary, authors, labels)
          VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        document.knowledgeItemId,
        document.title,
        document.summary,
        document.authors.join('\n'),
        document.labels.join('\n'),
      )
  }

  private now(): string {
    return (this.dependencies.now?.() ?? new Date()).toISOString()
  }
}

function mapKnowledgeItem(row: KnowledgeItemRow): KnowledgeItem {
  return KnowledgeItemSchema.parse({
    id: row.id,
    vaultId: row.vault_id,
    sourceId: row.source_id,
    externalId: row.external_id,
    canonicalUrl: row.canonical_url,
    title: row.title,
    authors: JSON.parse(row.authors_json) as unknown,
    publishedAt: row.published_at,
    fetchedAt: row.fetched_at,
    status: row.status,
    primaryArtifactId: row.primary_artifact_id,
    contentHash: row.content_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}

function splitSearchList(value: string): string[] {
  return value ? value.split('\n').filter(Boolean) : []
}
