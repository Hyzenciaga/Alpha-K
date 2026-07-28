import { describe, expect, it } from 'vitest'
import { CaptureService, CaptureServiceError } from '../../src/main/application/capture-service.js'
import type { CloudAuthService } from '../../src/main/cloud/cloud-auth-service.js'
import type { LearningCapture } from '../../src/shared/domain/capture.js'
import type { CloudStatus } from '../../src/shared/domain/cloud-sync.js'

const OWNER_ID = '11111111-1111-4111-8111-111111111111'
const CAPTURE_ID = '22222222-2222-4222-8222-222222222222'
const NOW = new Date('2026-07-28T10:00:00.000Z')

describe('CaptureService', () => {
  it('requires a signed-in owner before reading or writing captures', async () => {
    const fixture = createFixture(signedOutStatus())
    await expect(fixture.service.create({ kind: 'note', content: '稍后研究这个问题' }))
      .rejects.toMatchObject({ code: 'AUTH_REQUIRED' })
    expect(fixture.repository.calls).toEqual([])
  })

  it('normalizes links without fetching their content and broadcasts the saved capture', async () => {
    const fixture = createFixture(signedInStatus())

    const capture = await fixture.service.create({
      kind: 'link',
      note: '读一下',
      content: 'https://WWW.Example.com:443/articles/future/?b=2&a=1#section',
    })

    expect(fixture.repository.calls[0]).toMatchObject({
      ownerId: OWNER_ID,
      input: {
        id: CAPTURE_ID,
        kind: 'link',
        title: null,
        note: '读一下',
        normalizedUrl: 'https://www.example.com/articles/future?a=1&b=2',
        sourceHost: 'example.com',
      },
    })
    expect(capture.kind).toBe('link')
    expect(fixture.changed).toEqual([CAPTURE_ID])
  })

  it('rejects non-http links without writing a record', async () => {
    const fixture = createFixture(signedInStatus())
    await expect(fixture.service.create({ kind: 'link', content: 'file:///private/secret.md' }))
      .rejects.toBeInstanceOf(CaptureServiceError)
    await expect(fixture.service.create({ kind: 'link', content: 'file:///private/secret.md' }))
      .rejects.toMatchObject({ code: 'CAPTURE_INVALID_URL' })
    expect(fixture.repository.calls).toEqual([])
  })
})

function createFixture(status: CloudStatus) {
  const calls: Array<{ ownerId: string; input: Record<string, unknown> }> = []
  const changed: string[] = []
  const repository = {
    calls,
    async create(ownerId: string, input: Record<string, unknown>): Promise<LearningCapture> {
      calls.push({ ownerId, input })
      return captureFrom(input)
    },
    async list(): Promise<LearningCapture[]> {
      return []
    },
    async archive(): Promise<LearningCapture | null> {
      return null
    },
  }
  const cloudAuthService = { getStatus: () => status } as CloudAuthService
  const service = new CaptureService({
    cloudAuthService,
    createRepository: () => repository,
    createId: () => CAPTURE_ID,
    now: () => NOW,
    onCaptureChanged: (capture) => changed.push(capture.id),
  })
  return { service, repository, changed }
}

function captureFrom(input: Record<string, unknown>): LearningCapture {
  return {
    id: input.id as string,
    kind: input.kind as LearningCapture['kind'],
    title: input.title as string | null,
    note: input.note as string | null,
    content: input.content as string,
    normalizedUrl: input.normalizedUrl as string | null,
    sourceHost: input.sourceHost as string | null,
    archivedAt: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  }
}

function signedInStatus(): CloudStatus {
  return {
    projectRef: 'test',
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

function signedOutStatus(): CloudStatus {
  return { ...signedInStatus(), auth: 'signed_out', user: null, sync: 'disabled' }
}
