import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  RssConnector,
  createExcerpt,
  parseRssFeed,
} from '../../src/main/connectors/rss-connector.js'
import type { SourceConnectorError } from '../../src/main/connectors/source-connector.js'

const NOW = new Date('2026-07-22T00:00:00.000Z')

describe('RssConnector', () => {
  it('normalizes RSS GUIDs, URLs, authors, dates, metadata, content, and attachments', async () => {
    const xml = await fixture('sample-rss.xml')
    const feed = parseRssFeed(xml, 'https://example.com/feed.xml')

    expect(feed).toMatchObject({ title: 'Alpha Research', description: 'Research updates' })
    expect(feed.items).toHaveLength(3)
    expect(feed.items[0]).toMatchObject({
      externalId: 'article-1',
      canonicalUrl: 'https://example.com/articles/1?a=1&b=2',
      authors: ['Alice'],
      publishedAt: '2026-07-21T08:30:00.000Z',
      content: '<p>Detailed <strong>research</strong> content.</p>',
      attachments: [
        {
          url: 'https://example.com/files/one.pdf',
          mimeType: 'application/pdf',
          title: 'Paper',
        },
      ],
    })
    expect(feed.items[0]?.rawMetadata).toMatchObject({ title: 'First Article' })
    expect(feed.items[2]).toMatchObject({
      externalId: null,
      canonicalUrl: null,
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
    expect(createExcerpt(feed.items[0]?.content ?? null)).toBe('Detailed research content.')
  })

  it('normalizes Atom alternate links, authors, dates, and summaries', async () => {
    const feed = parseRssFeed(await fixture('sample-atom.xml'), 'https://example.com/atom.xml')
    expect(feed.items).toEqual([
      expect.objectContaining({
        externalId: 'urn:uuid:1225c695-cfb8-4ebb-aaaa-80da344efa6a',
        canonicalUrl: 'https://example.com/atom/article',
        authors: ['Carol'],
        publishedAt: '2026-07-20T10:30:02.000Z',
        content: 'Atom research summary.',
      }),
    ])
  })

  it('previews without persistence and applies keywords, history, and item limits', async () => {
    const xml = await fixture('sample-rss.xml')
    const connector = new RssConnector({
      now: () => NOW,
      fetch: async () => new Response(xml, { status: 200 }),
    })
    const preview = await connector.preview({
      feedUrl: 'https://example.com/feed.xml',
      includeKeywords: ['detailed'],
      excludeKeywords: [],
      historyWindowDays: 30,
      maxItemsPerSync: 100,
    })
    expect(preview.items).toEqual([
      expect.objectContaining({ title: 'First Article', excerpt: 'Detailed research content.' }),
    ])
  })

  it('rejects invalid protocols and malformed feeds with stable non-retryable errors', async () => {
    const connector = new RssConnector({ fetch: async () => new Response('<rss>', { status: 200 }) })
    await expect(
      connector.validate({
        feedUrl: 'ftp://example.com/feed.xml',
        includeKeywords: [],
        excludeKeywords: [],
        historyWindowDays: 30,
        maxItemsPerSync: 100,
      }),
    ).resolves.toMatchObject({ valid: false })
    await expect(
      connector.preview({
        feedUrl: 'https://example.com/feed.xml',
        includeKeywords: [],
        excludeKeywords: [],
        historyWindowDays: 30,
        maxItemsPerSync: 100,
      }),
    ).rejects.toMatchObject({
      code: 'SOURCE_FETCH_FAILED',
      retryable: false,
    } satisfies Partial<SourceConnectorError>)
  })
})

async function fixture(name: string): Promise<string> {
  return readFile(new URL(`../fixtures/rss/${name}`, import.meta.url), 'utf8')
}
