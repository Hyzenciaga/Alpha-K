import { createHash } from 'node:crypto'
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import {
  DiscoveredItemSchema,
  SourcePreviewSchema,
  type DiscoveredItem,
  type SourcePreview,
} from '../../shared/domain/source-ingestion.js'
import { RssSourceConfigSchema, type RssSourceConfig } from '../../shared/domain/source.js'
import {
  SourceConnectorError,
  type SourceConnector,
  type SourceSyncContext,
  type SourceValidationResult,
} from './source-connector.js'

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024
const EXCERPT_LENGTH = 280

type XmlRecord = Record<string, unknown>
type NormalizedDiscoveredItem = ReturnType<typeof DiscoveredItemSchema.parse>

type ParsedFeed = {
  title: string | null
  description: string | null
  items: NormalizedDiscoveredItem[]
  warnings: string[]
}

export class RssConnector implements SourceConnector<RssSourceConfig> {
  readonly type = 'rss' as const

  constructor(
    private readonly dependencies: {
      fetch?: typeof fetch
      now?: () => Date
      timeoutMs?: number
      maxResponseBytes?: number
    } = {},
  ) {}

  async validate(config: RssSourceConfig): Promise<SourceValidationResult> {
    try {
      parseConfig(config)
      return { valid: true, warnings: [] }
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
      }
    }
  }

  async preview(config: RssSourceConfig): Promise<SourcePreview> {
    const parsedConfig = parseConfig(config)
    const feed = await this.load(parsedConfig, 50)
    return SourcePreviewSchema.parse({
      sourceType: 'rss',
      title: feed.title,
      description: feed.description,
      items: feed.items.map((item) => ({
        externalId: item.externalId,
        canonicalUrl: item.canonicalUrl,
        title: item.title,
        authors: item.authors,
        publishedAt: item.publishedAt,
        contentHash: item.contentHash,
        excerpt: createExcerpt(item.content),
      })),
      warnings: feed.warnings,
    })
  }

  async *sync(context: SourceSyncContext<RssSourceConfig>): AsyncIterable<DiscoveredItem> {
    const config = parseConfig(context.config)
    const feed = await this.load(config, config.maxItemsPerSync)
    yield* feed.items
  }

  private async load(config: RssSourceConfig, limit: number): Promise<ParsedFeed> {
    const xml = await this.fetchFeed(config.feedUrl)
    const parsed = parseFeed(xml, config.feedUrl)
    const cutoff = Date.parse(this.now().toISOString()) - config.historyWindowDays * 86_400_000
    const filtered = parsed.items.filter((item) => {
      const searchable = `${item.title}\n${item.content ?? ''}`.toLocaleLowerCase()
      const includes =
        config.includeKeywords.length === 0 ||
        config.includeKeywords.some((keyword) => searchable.includes(keyword.toLocaleLowerCase()))
      const excludes = config.excludeKeywords.some((keyword) =>
        searchable.includes(keyword.toLocaleLowerCase()),
      )
      const recent = item.publishedAt === null || Date.parse(item.publishedAt) >= cutoff
      return includes && !excludes && recent
    })
    return { ...parsed, items: filtered.slice(0, limit) }
  }

  private async fetchFeed(url: string): Promise<string> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    timeout.unref()
    try {
      const response = await (this.dependencies.fetch ?? fetch)(url, {
        signal: controller.signal,
        headers: {
          accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9',
          'user-agent': 'Alpha-K/0.0.1 RSS Connector',
        },
      })
      if (!response.ok) {
        throw new SourceConnectorError(
          'SOURCE_FETCH_FAILED',
          `RSS request failed with HTTP ${response.status}.`,
          response.status === 408 || response.status === 429 || response.status >= 500,
        )
      }
      const declaredLength = Number(response.headers.get('content-length'))
      const maxBytes = this.dependencies.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES
      if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        throw new SourceConnectorError(
          'SOURCE_FETCH_FAILED',
          `RSS response exceeds the ${maxBytes} byte limit.`,
          false,
        )
      }
      const body = new Uint8Array(await response.arrayBuffer())
      if (body.byteLength > maxBytes) {
        throw new SourceConnectorError(
          'SOURCE_FETCH_FAILED',
          `RSS response exceeds the ${maxBytes} byte limit.`,
          false,
        )
      }
      return new TextDecoder().decode(body)
    } catch (error) {
      if (error instanceof SourceConnectorError) throw error
      const timedOut = controller.signal.aborted
      throw new SourceConnectorError(
        'SOURCE_FETCH_FAILED',
        timedOut ? 'RSS request timed out.' : `RSS request failed: ${errorMessage(error)}`,
        true,
        { cause: error },
      )
    } finally {
      clearTimeout(timeout)
    }
  }

  private now(): Date {
    return this.dependencies.now?.() ?? new Date()
  }
}

export function parseRssFeed(xml: string, feedUrl: string): ParsedFeed {
  return parseFeed(xml, normalizeUrl(feedUrl) ?? feedUrl)
}

export function createExcerpt(content: string | null, maxLength = EXCERPT_LENGTH): string | null {
  if (!content) return null
  const plain = decodeHtmlEntities(content.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
  if (!plain) return null
  const characters = Array.from(plain)
  return characters.length <= maxLength ? plain : `${characters.slice(0, maxLength - 1).join('')}…`
}

function parseConfig(config: RssSourceConfig): RssSourceConfig {
  const parsed = RssSourceConfigSchema.safeParse(config)
  if (!parsed.success) {
    throw new SourceConnectorError('SOURCE_INVALID_CONFIG', parsed.error.message, false)
  }
  const protocol = new URL(parsed.data.feedUrl).protocol
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new SourceConnectorError(
      'SOURCE_INVALID_CONFIG',
      'RSS feedUrl must use http or https.',
      false,
    )
  }
  return parsed.data
}

function parseFeed(xml: string, feedUrl: string): ParsedFeed {
  const validation = XMLValidator.validate(xml)
  if (validation !== true) {
    throw new SourceConnectorError(
      'SOURCE_FETCH_FAILED',
      `RSS response is not valid XML: ${validation.err.msg}`,
      false,
    )
  }

  let document: unknown
  try {
    document = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      trimValues: false,
      parseTagValue: false,
      parseAttributeValue: false,
      processEntities: true,
      maxNestedTags: 100,
    }).parse(xml)
  } catch (error) {
    throw new SourceConnectorError(
      'SOURCE_FETCH_FAILED',
      `RSS response could not be parsed: ${errorMessage(error)}`,
      false,
      { cause: error },
    )
  }

  const root = asRecord(document)
  if (!root) {
    throw new SourceConnectorError('SOURCE_FETCH_FAILED', 'XML feed has no document root.', false)
  }
  const rssRoot = getRecord(root, 'rss')
  const rdfRoot = getRecord(root, 'rdf:RDF', 'RDF')
  const atomRoot = getRecord(root, 'feed')
  if (atomRoot) return parseAtom(atomRoot, feedUrl)
  if (rssRoot) {
    const channel = getRecord(rssRoot, 'channel')
    if (channel) return parseRss(channel, feedUrl)
  }
  if (rdfRoot) return parseRss(rdfRoot, feedUrl)
  throw new SourceConnectorError('SOURCE_FETCH_FAILED', 'XML is not an RSS or Atom feed.', false)
}

function parseRss(channel: XmlRecord, feedUrl: string): ParsedFeed {
  const warnings: string[] = []
  const items = asArray(getField(channel, 'item')).flatMap((value, index) => {
    const entry = asRecord(value)
    if (!entry) {
      warnings.push(`Skipped RSS item ${index + 1}: invalid item shape.`)
      return []
    }
    return [normalizeEntry(entry, feedUrl, 'rss', index, warnings)]
  })
  return {
    title: normalizedText(getField(channel, 'title')),
    description: normalizedText(getField(channel, 'description', 'subtitle')),
    items,
    warnings,
  }
}

function parseAtom(feed: XmlRecord, feedUrl: string): ParsedFeed {
  const warnings: string[] = []
  const items = asArray(getField(feed, 'entry')).flatMap((value, index) => {
    const entry = asRecord(value)
    if (!entry) {
      warnings.push(`Skipped Atom entry ${index + 1}: invalid entry shape.`)
      return []
    }
    return [normalizeEntry(entry, feedUrl, 'atom', index, warnings)]
  })
  return {
    title: normalizedText(getField(feed, 'title')),
    description: normalizedText(getField(feed, 'subtitle', 'description')),
    items,
    warnings,
  }
}

function normalizeEntry(
  entry: XmlRecord,
  feedUrl: string,
  format: 'rss' | 'atom',
  index: number,
  warnings: string[],
): NormalizedDiscoveredItem {
  const rawGuid = normalizedText(getField(entry, format === 'atom' ? 'id' : 'guid', 'id'))
  const externalId = rawGuid ? normalizeGuid(rawGuid) : null
  const canonicalUrl = normalizeUrl(extractLink(entry, format), feedUrl)
  const rawTitle = normalizedText(getField(entry, 'title'))
  const title = rawTitle ?? `Untitled feed item ${index + 1}`
  if (!rawTitle) warnings.push(`Feed item ${index + 1} has no title; a deterministic fallback was used.`)
  const authors = extractAuthors(entry)
  const rawDate = normalizedText(getField(entry, 'pubDate', 'published', 'updated', 'dc:date', 'date'))
  const publishedAt = normalizeDate(rawDate)
  if (rawDate && !publishedAt) warnings.push(`Feed item ${index + 1} has an invalid publication date.`)
  const content = normalizedContent(
    getField(entry, 'content:encoded', 'encoded', 'content', 'summary', 'description'),
  )
  const rawMetadata = toJsonRecord(entry)
  const contentHash = createHash('sha256')
    .update(
      stableStringify({
        externalId,
        canonicalUrl,
        title,
        authors,
        publishedAt,
        content,
        rawMetadata: externalId || canonicalUrl ? null : rawMetadata,
      }),
    )
    .digest('hex')

  return DiscoveredItemSchema.parse({
    externalId,
    canonicalUrl,
    title,
    authors,
    publishedAt,
    rawMetadata,
    content,
    contentHash,
    attachments: extractAttachments(entry, feedUrl),
  })
}

function extractLink(entry: XmlRecord, format: 'rss' | 'atom'): string | null {
  const links = asArray(getField(entry, 'link'))
  if (format === 'rss') return normalizedText(links[0])
  const candidates = links
    .map(asRecord)
    .filter((link): link is XmlRecord => link !== null)
  const alternate = candidates.find((link) => {
    const rel = normalizedText(link['@_rel'])
    return !rel || rel === 'alternate'
  })
  return normalizedText(alternate?.['@_href'] ?? candidates[0]?.['@_href'] ?? links[0])
}

function extractAuthors(entry: XmlRecord): string[] {
  const values = [
    ...asArray(getField(entry, 'author')),
    ...asArray(getField(entry, 'dc:creator')),
    ...asArray(getField(entry, 'creator')),
  ]
  const names = values.flatMap((value) => {
    const record = asRecord(value)
    const text = normalizedText(record ? getField(record, 'name') ?? value : value)
    if (!text) return []
    const parenthesized = text.match(/\(([^)]+)\)\s*$/)?.[1]
    return (parenthesized ?? text)
      .split(/\s*;\s*/)
      .map((name) => name.trim())
      .filter(Boolean)
  })
  return [...new Set(names)]
}

function extractAttachments(entry: XmlRecord, feedUrl: string): DiscoveredItem['attachments'] {
  return asArray(getField(entry, 'enclosure'))
    .map(asRecord)
    .filter((value): value is XmlRecord => value !== null)
    .flatMap((enclosure) => {
      const url = normalizeUrl(normalizedText(enclosure['@_url']), feedUrl)
      if (!url) return []
      return [
        {
          url,
          title: normalizedText(enclosure['@_title']),
          mimeType: normalizedText(enclosure['@_type']),
        },
      ]
    })
    .slice(0, 50)
}

function normalizeDate(value: string | null): string | null {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
}

function normalizeGuid(value: string): string {
  const normalized = value.normalize('NFC').replace(/\s+/g, ' ').trim()
  return normalizeUrl(normalized) ?? normalized
}

function normalizeUrl(value: string | null, base?: string): string | null {
  if (!value) return null
  try {
    const url = base ? new URL(value.trim(), base) : new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    url.hash = ''
    url.hostname = url.hostname.toLocaleLowerCase()
    url.searchParams.sort()
    return url.toString()
  } catch {
    return null
  }
}

function normalizedContent(value: unknown): string | null {
  const text = textValue(value).replace(/\r\n?/g, '\n').trim()
  return text || null
}

function normalizedText(value: unknown): string | null {
  const text = textValue(value).replace(/\s+/g, ' ').trim()
  return text || null
}

function textValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join(' ')
  const record = asRecord(value)
  if (!record) return ''
  if ('#text' in record) return textValue(record['#text'])
  return Object.entries(record)
    .filter(([key]) => !key.startsWith('@_'))
    .map(([, nested]) => textValue(nested))
    .filter(Boolean)
    .join(' ')
}

function getRecord(record: XmlRecord, ...names: string[]): XmlRecord | null {
  return asRecord(getField(record, ...names))
}

function getField(record: XmlRecord, ...names: string[]): unknown {
  const exact = names.find((name) => name in record)
  if (exact) return record[exact]
  const lowerNames = new Set(names.map((name) => name.toLocaleLowerCase()))
  const localNames = new Set(names.map((name) => name.split(':').at(-1)!.toLocaleLowerCase()))
  const entry = Object.entries(record).find(([key]) => {
    const lower = key.toLocaleLowerCase()
    return lowerNames.has(lower) || localNames.has(lower.split(':').at(-1)!)
  })
  return entry?.[1]
}

function asRecord(value: unknown): XmlRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as XmlRecord)
    : null
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function toJsonRecord(value: XmlRecord): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const record = asRecord(value)
  if (record) {
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

function decodeHtmlEntities(value: string): string {
  return value
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
