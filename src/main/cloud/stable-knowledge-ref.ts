import { createHash } from 'node:crypto'
import type { KnowledgeItem } from '../../shared/domain/knowledge.js'
import type { Source } from '../../shared/domain/source.js'
import type { KnowledgeRefKind } from '../../shared/domain/cloud-sync.js'

export type StableKnowledgeRef = {
  refKey: string
  kind: KnowledgeRefKind
  sourceKey: string | null
  externalId: string | null
  canonicalUrl: string | null
  contentHash: string | null
  title: string
  authors: string[]
  publishedAt: string | null
  discoveredAt: string
}

export function createStableKnowledgeRef(
  source: Source,
  item: KnowledgeItem,
): StableKnowledgeRef | null {
  const canonicalUrl = normalizeHttpUrl(item.canonicalUrl)
  const contentHash = normalizeToken(item.contentHash)
  const externalId = normalizeToken(item.externalId)

  if (source.type === 'rss') {
    const feedUrl = normalizeHttpUrl(source.config.feedUrl)
    if (!feedUrl) return null
    const sourceKey = `rss:${sha256(feedUrl)}`
    const identity = externalId
      ? `external:${sha256(externalId)}`
      : canonicalUrl
        ? `url:${sha256(canonicalUrl)}`
        : contentHash
          ? `content:${contentHash}`
          : null
    if (!identity) return null
    return metadata(item, {
      refKey: `${sourceKey}:${identity}`,
      kind: 'rss',
      sourceKey,
      externalId,
      canonicalUrl,
      contentHash,
    })
  }

  if (source.type === 'arxiv') {
    if (!externalId) return null
    const normalizedId = externalId.toLowerCase().replace(/^arxiv:/, '')
    return metadata(item, {
      refKey: `arxiv:${sha256(normalizedId)}`,
      kind: 'arxiv',
      sourceKey: `arxiv:${sha256(source.config.query.trim().toLowerCase())}`,
      externalId: normalizedId,
      canonicalUrl,
      contentHash,
    })
  }

  if (!contentHash) return null
  return metadata(item, {
    refKey: `file:${contentHash}`,
    kind: 'file_hash',
    sourceKey: null,
    externalId: null,
    canonicalUrl: null,
    contentHash,
  })
}

function metadata(
  item: KnowledgeItem,
  identity: Pick<
    StableKnowledgeRef,
    'refKey' | 'kind' | 'sourceKey' | 'externalId' | 'canonicalUrl' | 'contentHash'
  >,
): StableKnowledgeRef {
  return {
    ...identity,
    title: item.title,
    authors: [...item.authors],
    publishedAt: item.publishedAt,
    discoveredAt: item.fetchedAt,
  }
}

function normalizeHttpUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    url.hash = ''
    url.hostname = url.hostname.toLowerCase()
    if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
      url.port = ''
    }
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '')
    url.searchParams.sort()
    return url.toString()
  } catch {
    return null
  }
}

function normalizeToken(value: string | null): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
