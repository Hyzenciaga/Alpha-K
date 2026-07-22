import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseAuthCallback } from '../../src/main/cloud/cloud-auth-service.js'
import {
  ALPHA_K_AUTH_CALLBACK_URL,
  ALPHA_K_SUPABASE_PROJECT_REF,
  readCloudConfig,
} from '../../src/main/cloud/cloud-config.js'
import {
  CloudStatusSchema,
  RemoteKnowledgeRefSchema,
} from '../../src/shared/domain/cloud-sync.js'
import { PHASE_ONE_IPC_CHANNELS } from '../../src/shared/ipc/phase-one-contract.js'
import { PHASE_TWO_IPC_CHANNELS } from '../../src/shared/ipc/phase-two-contract.js'
import { CLOUD_IPC_CHANNELS } from '../../src/shared/ipc/cloud-contract.js'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const REF_ID = '22222222-2222-4222-8222-222222222222'
const NOW = '2026-07-22T09:00:00.000Z'

describe('Phase 3 auth and sync contracts', () => {
  it('keeps the public project identity separate from the publishable key', () => {
    const missing = readCloudConfig({})
    expect(missing).toMatchObject({
      projectRef: ALPHA_K_SUPABASE_PROJECT_REF,
      supabaseUrl: `https://${ALPHA_K_SUPABASE_PROJECT_REF}.supabase.co`,
      publishableKey: null,
      authCallbackUrl: ALPHA_K_AUTH_CALLBACK_URL,
    })
    const configured = readCloudConfig({
      MAIN_VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    })
    expect(configured.publishableKey).toBe('sb_publishable_test')
  })

  it('accepts only the exact Alpha-K OAuth callback and extracts its one-time code', () => {
    expect(
      parseAuthCallback('alpha-k://auth/callback?code=one-time-code', ALPHA_K_AUTH_CALLBACK_URL),
    ).toEqual({ matched: true, code: 'one-time-code', error: null })
    expect(
      parseAuthCallback('alpha-k://attacker/callback?code=stolen', ALPHA_K_AUTH_CALLBACK_URL),
    ).toEqual({ matched: false, code: null, error: null })
    expect(
      parseAuthCallback(
        'alpha-k://auth/callback?error=access_denied&error_description=Denied',
        ALPHA_K_AUTH_CALLBACK_URL,
      ),
    ).toEqual({ matched: true, code: null, error: 'Denied' })
  })

  it('validates account status and metadata-only knowledge references', () => {
    expect(
      CloudStatusSchema.parse({
        projectRef: ALPHA_K_SUPABASE_PROJECT_REF,
        region: 'Singapore',
        configuration: 'ready',
        auth: 'signed_in',
        user: {
          id: USER_ID,
          provider: 'github',
          email: 'alpha@example.com',
          displayName: 'Alpha',
          avatarUrl: null,
        },
        sync: 'idle',
        pendingChanges: 0,
        lastSyncedAt: null,
        lastError: null,
      }).user?.id,
    ).toBe(USER_ID)

    expect(
      RemoteKnowledgeRefSchema.parse({
        id: REF_ID,
        refKey: 'rss:feed-1:guid-1',
        kind: 'rss',
        sourceKey: 'feed-1',
        externalId: 'guid-1',
        canonicalUrl: 'https://example.com/post',
        contentHash: null,
        title: 'Metadata only',
        authors: ['Alpha'],
        publishedAt: NOW,
        discoveredAt: NOW,
        updatedAt: NOW,
      }).refKey,
    ).toBe('rss:feed-1:guid-1')
    expect(() =>
      RemoteKnowledgeRefSchema.parse({
        id: REF_ID,
        refKey: 'file:hash',
        kind: 'file_hash',
        sourceKey: null,
        externalId: null,
        canonicalUrl: null,
        contentHash: 'abc',
        title: 'Local file',
        authors: [],
        publishedAt: null,
        discoveredAt: NOW,
        updatedAt: NOW,
        localPath: '/private/vault/secret.pdf',
      }),
    ).toThrow()
  })

  it('keeps IPC channel names globally unique', () => {
    const channels = [
      ...Object.values(PHASE_ONE_IPC_CHANNELS),
      ...Object.values(PHASE_TWO_IPC_CHANNELS),
      ...Object.values(CLOUD_IPC_CHANNELS),
    ]
    expect(new Set(channels).size).toBe(channels.length)
  })

  it('defines RLS for every exposed sync table and grants no anon access', async () => {
    const sql = await readFile(
      join(process.cwd(), 'supabase/migrations/20260722090000_auth_sync_foundation.sql'),
      'utf8',
    )
    for (const table of ['devices', 'knowledge_refs', 'user_knowledge_states', 'sync_changes']) {
      expect(sql).toContain(`alter table public.${table} enable row level security`)
      expect(sql).toContain(`revoke all on table public.${table} from anon`)
    }
    expect(sql).toContain('(select auth.uid()) = owner_id')
    expect(sql).not.toContain('service_role')
  })
})
