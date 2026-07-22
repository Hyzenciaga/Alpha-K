import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { CloudStatus, CloudUser } from '../../shared/domain/cloud-sync.js'
import type { IpcErrorCode } from '../../shared/ipc/common-contract.js'
import type { CloudConfig } from './cloud-config.js'
import type { SecureSessionStorage } from './secure-session-storage.js'

export class CloudServiceError extends Error {
  constructor(
    readonly code: Extract<
      IpcErrorCode,
      'CLOUD_NOT_CONFIGURED' | 'CLOUD_SECURE_STORAGE_UNAVAILABLE' | 'AUTH_FAILED'
    >,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'CloudServiceError'
  }
}

type CloudAuthServiceDependencies = {
  config: CloudConfig
  storage: SecureSessionStorage
  openExternal: (url: string) => Promise<void>
  onStatusChanged?: (status: CloudStatus) => void
}

export class CloudAuthService {
  private readonly client: SupabaseClient | null
  private status: CloudStatus
  private unsubscribe: (() => void) | null = null

  constructor(private readonly dependencies: CloudAuthServiceDependencies) {
    const { config } = dependencies
    this.status = {
      projectRef: config.projectRef,
      region: config.region,
      configuration: config.publishableKey ? 'ready' : 'missing_publishable_key',
      auth: 'signed_out',
      user: null,
      sync: 'disabled',
      pendingChanges: 0,
      lastSyncedAt: null,
      lastError: null,
    }
    this.client = config.publishableKey
      ? createClient(config.supabaseUrl, config.publishableKey, {
          auth: {
            storage: dependencies.storage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
            flowType: 'pkce',
          },
        })
      : null
  }

  async initialize(): Promise<CloudStatus> {
    if (!this.client) return this.getStatus()
    const {
      data: { subscription },
    } = this.client.auth.onAuthStateChange((_event, session) => {
      this.applyUser(session?.user ?? null)
    })
    this.unsubscribe = () => subscription.unsubscribe()

    try {
      const { data, error } = await this.client.auth.getSession()
      if (error) throw error
      this.applyUser(data.session?.user ?? null)
    } catch (error) {
      this.applyError(error)
    }
    return this.getStatus()
  }

  getStatus(): CloudStatus {
    return { ...this.status, user: this.status.user ? { ...this.status.user } : null }
  }

  getAuthenticatedClient(): SupabaseClient {
    const client = this.requireClient()
    if (this.status.auth !== 'signed_in' || !this.status.user) {
      throw new CloudServiceError('AUTH_FAILED', 'Supabase 会话尚未登录。')
    }
    return client
  }

  updateSyncStatus(
    sync: CloudStatus['sync'],
    detail: Partial<Pick<CloudStatus, 'pendingChanges' | 'lastSyncedAt' | 'lastError'>> = {},
  ): void {
    if (this.status.auth !== 'signed_in') return
    this.updateStatus({ sync, ...detail })
  }

  async signInWithGitHub(): Promise<CloudStatus> {
    const client = this.requireClient()
    this.updateStatus({ auth: 'signing_in', lastError: null })
    try {
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: this.dependencies.config.authCallbackUrl,
          skipBrowserRedirect: true,
        },
      })
      if (error) throw error
      if (!data.url) throw new Error('Supabase 没有返回 GitHub OAuth 地址。')
      await this.dependencies.openExternal(data.url)
      return this.getStatus()
    } catch (error) {
      this.applyError(error)
      throw new CloudServiceError('AUTH_FAILED', messageOf(error), { cause: error })
    }
  }

  async handleAuthCallback(rawUrl: string): Promise<boolean> {
    const callback = parseAuthCallback(rawUrl, this.dependencies.config.authCallbackUrl)
    if (!callback.matched) return false
    const client = this.requireClient()

    if (callback.error) {
      const error = new CloudServiceError('AUTH_FAILED', callback.error)
      this.applyError(error)
      throw error
    }
    if (!callback.code) {
      const error = new CloudServiceError('AUTH_FAILED', '登录回调缺少一次性授权码。')
      this.applyError(error)
      throw error
    }

    try {
      const { data, error } = await client.auth.exchangeCodeForSession(callback.code)
      if (error) throw error
      this.applyUser(data.user)
      return true
    } catch (error) {
      this.applyError(error)
      throw new CloudServiceError('AUTH_FAILED', messageOf(error), { cause: error })
    }
  }

  async signOut(): Promise<CloudStatus> {
    const client = this.requireClient()
    // Alpha-K is explicitly multi-device: signing out here must not revoke the
    // user's sessions on their other Macs or future clients.
    const { error } = await client.auth.signOut({ scope: 'local' })
    if (error) {
      this.applyError(error)
      throw new CloudServiceError('AUTH_FAILED', error.message, { cause: error })
    }
    this.applyUser(null)
    return this.getStatus()
  }

  dispose(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
    this.client?.auth.stopAutoRefresh()
  }

  private requireClient(): SupabaseClient {
    if (!this.client) {
      throw new CloudServiceError(
        'CLOUD_NOT_CONFIGURED',
        '缺少 Supabase publishable key；请先填写项目根目录的 .env.local。',
      )
    }
    return this.client
  }

  private applyUser(user: User | null): void {
    const ownerChanged = this.status.user?.id !== user?.id
    this.updateStatus({
      auth: user ? 'signed_in' : 'signed_out',
      user: user ? toCloudUser(user) : null,
      sync: user ? 'idle' : 'disabled',
      pendingChanges: ownerChanged ? 0 : this.status.pendingChanges,
      lastSyncedAt: ownerChanged ? null : this.status.lastSyncedAt,
      lastError: null,
    })
  }

  private applyError(error: unknown): void {
    this.updateStatus({ auth: 'error', sync: 'error', lastError: messageOf(error) })
  }

  private updateStatus(changes: Partial<CloudStatus>): void {
    this.status = { ...this.status, ...changes }
    this.dependencies.onStatusChanged?.(this.getStatus())
  }
}

export type ParsedAuthCallback = {
  matched: boolean
  code: string | null
  error: string | null
}

export function parseAuthCallback(rawUrl: string, expectedCallbackUrl: string): ParsedAuthCallback {
  let url: URL
  let expected: URL
  try {
    url = new URL(rawUrl)
    expected = new URL(expectedCallbackUrl)
  } catch {
    return { matched: false, code: null, error: null }
  }
  if (
    url.protocol !== expected.protocol ||
    url.hostname !== expected.hostname ||
    url.pathname !== expected.pathname
  ) {
    return { matched: false, code: null, error: null }
  }
  return {
    matched: true,
    code: url.searchParams.get('code'),
    error: url.searchParams.get('error_description') ?? url.searchParams.get('error'),
  }
}

function toCloudUser(user: User): CloudUser {
  const displayName = firstString(
    user.user_metadata.user_name,
    user.user_metadata.preferred_username,
    user.user_metadata.full_name,
    user.user_metadata.name,
  )
  const avatarUrl = firstString(user.user_metadata.avatar_url)
  return {
    id: user.id,
    provider: 'github',
    email: user.email ?? null,
    displayName,
    avatarUrl: avatarUrl && isHttpUrl(avatarUrl) ? avatarUrl : null,
  }
}

function firstString(...values: unknown[]): string | null {
  return values.find((value): value is string => typeof value === 'string' && value.length > 0) ?? null
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
