import type { KnowledgeRefUpsert, UserKnowledgeStateUpsert } from '../../shared/domain/cloud-sync.js'
import type { CloudAuthService } from '../cloud/cloud-auth-service.js'
import type { RemoteSyncProvider } from '../cloud/remote-sync-provider.js'
import { createStableKnowledgeRef } from '../cloud/stable-knowledge-ref.js'
import type { CloudSyncRepository } from '../persistence/repositories/cloud-sync-repository.js'
import type { KnowledgeRepository } from '../persistence/repositories/knowledge-repository.js'
import type { KnowledgeStateRepository } from '../persistence/repositories/knowledge-state-repository.js'
import type { SourceRepository } from '../persistence/repositories/source-repository.js'

export class CloudSyncWorker {
  private timer: NodeJS.Timeout | undefined
  private processing = false
  private stopped = true
  private inFlight: Promise<void> | null = null

  constructor(
    private readonly dependencies: {
      authService: Pick<
        CloudAuthService,
        'getStatus' | 'getAuthenticatedClient' | 'updateSyncStatus'
      >
      repository: CloudSyncRepository
      knowledgeRepository: KnowledgeRepository
      knowledgeStateRepository: KnowledgeStateRepository
      sourceRepository: SourceRepository
      createProvider: () => RemoteSyncProvider
      deviceName: string
      platform: 'macos' | 'windows' | 'linux'
      appVersion: string
      pollIntervalMs?: number
      retryBaseDelayMs?: number
      now?: () => Date
      onError?: (error: unknown) => void
    },
  ) {}

  start(): void {
    if (!this.stopped) return
    this.stopped = false
    this.timer = setInterval(() => this.trigger(), this.dependencies.pollIntervalMs ?? 15_000)
    this.timer.unref()
    this.wake()
  }

  stop(): void {
    this.stopped = true
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
  }

  async shutdown(): Promise<void> {
    this.stop()
    await this.inFlight
  }

  wake(): void {
    if (this.stopped) return
    queueMicrotask(() => this.trigger())
  }

  enqueueKnowledgeItems(knowledgeItemIds: string[]): number {
    const user = this.dependencies.authService.getStatus().user
    if (!user) return 0
    let queued = 0
    for (const id of new Set(knowledgeItemIds)) {
      const item = this.dependencies.knowledgeRepository.getById(id)
      if (!item) continue
      const source = this.dependencies.sourceRepository.getById(item.sourceId)
      if (!source) continue
      const stable = createStableKnowledgeRef(source, item)
      if (!stable) continue
      const payload: KnowledgeRefUpsert = stable
      this.dependencies.repository.enqueueKnowledgeRef(user.id, item.id, payload)
      queued += 1
    }
    this.updatePending(user.id)
    if (queued > 0) this.wake()
    return queued
  }

  enqueueUserState(knowledgeItemId: string): boolean {
    const user = this.dependencies.authService.getStatus().user
    if (!user) return false
    const item = this.dependencies.knowledgeRepository.getById(knowledgeItemId)
    const state = this.dependencies.knowledgeStateRepository.get(knowledgeItemId)
    if (!item || !state) return false
    const source = this.dependencies.sourceRepository.getById(item.sourceId)
    if (!source) return false
    const stable = createStableKnowledgeRef(source, item)
    if (!stable) return false
    this.dependencies.repository.enqueueKnowledgeRef(user.id, item.id, stable)
    const payload: UserKnowledgeStateUpsert = {
      refKey: stable.refKey,
      read: state.read,
      starred: state.starred,
      disposition: state.disposition,
    }
    this.dependencies.repository.enqueueUserState(user.id, item.id, payload)
    this.updatePending(user.id)
    this.wake()
    return true
  }

  async processOnce(): Promise<boolean> {
    if (this.processing) return false
    const status = this.dependencies.authService.getStatus()
    if (status.auth !== 'signed_in' || !status.user) return false
    this.processing = true
    const ownerId = status.user.id
    try {
      this.dependencies.repository.bindAccount(ownerId, status.user.email)
      const pending = this.dependencies.repository.pendingCount(ownerId)
      this.dependencies.authService.updateSyncStatus('syncing', {
        pendingChanges: pending,
        lastError: null,
      })
      const provider = this.dependencies.createProvider()
      await provider.registerDevice(ownerId, {
        id: this.dependencies.repository.getOrCreateDeviceId(),
        name: this.dependencies.deviceName,
        platform: this.dependencies.platform,
        appVersion: this.dependencies.appVersion,
      })
      await this.push(ownerId, provider)
      await this.pull(ownerId, provider)
      const remaining = this.dependencies.repository.pendingCount(ownerId)
      const syncedAt = this.now().toISOString()
      this.dependencies.authService.updateSyncStatus('idle', {
        pendingChanges: remaining,
        lastSyncedAt: syncedAt,
        lastError: null,
      })
      return true
    } catch (error) {
      const message = messageOf(error)
      this.dependencies.repository.recordError(ownerId, message)
      this.dependencies.authService.updateSyncStatus(isOfflineError(error) ? 'offline' : 'error', {
        pendingChanges: this.dependencies.repository.pendingCount(ownerId),
        lastError: message,
      })
      throw error
    } finally {
      this.processing = false
    }
  }

  private async processSafely(): Promise<void> {
    try {
      await this.processOnce()
    } catch (error) {
      this.dependencies.onError?.(error)
    }
  }

  private trigger(): void {
    if (this.stopped || this.inFlight) return
    this.inFlight = this.processSafely().finally(() => {
      this.inFlight = null
    })
  }

  private async push(ownerId: string, provider: RemoteSyncProvider): Promise<void> {
    const entries = this.dependencies.repository
      .listDue(ownerId, 100)
      .sort((left, right) => Number(left.entityType !== 'knowledge_ref') - Number(right.entityType !== 'knowledge_ref'))
    for (const entry of entries) {
      try {
        if (entry.entityType === 'knowledge_ref') {
          const remote = await provider.upsertKnowledgeRef(ownerId, entry.payload as KnowledgeRefUpsert)
          if (entry.localKnowledgeItemId) {
            this.dependencies.repository.bindKnowledge(ownerId, entry.localKnowledgeItemId, remote)
          }
          this.dependencies.repository.cacheKnowledgeRef(ownerId, remote)
        } else {
          const payload = entry.payload as UserKnowledgeStateUpsert
          let remoteRefId = this.dependencies.repository.findRemoteRefId(ownerId, payload.refKey)
          if (!remoteRefId) {
            const remoteRef = await provider.findKnowledgeRefByKey(ownerId, payload.refKey)
            if (!remoteRef) throw new Error(`Remote knowledge ref is missing for ${payload.refKey}.`)
            remoteRefId = remoteRef.id
            if (entry.localKnowledgeItemId) {
              this.dependencies.repository.bindKnowledge(ownerId, entry.localKnowledgeItemId, remoteRef)
            }
            this.dependencies.repository.cacheKnowledgeRef(ownerId, remoteRef)
          }
          const remoteState = await provider.upsertUserState(ownerId, remoteRefId, payload)
          this.dependencies.repository.cacheUserState(ownerId, remoteState)
        }
        this.dependencies.repository.acknowledge(entry.id)
      } catch (error) {
        const retryAt = new Date(
          this.now().getTime() + Math.min(this.retryBaseDelayMs * 2 ** entry.attemptCount, 300_000),
        ).toISOString()
        this.dependencies.repository.retry(entry.id, messageOf(error), retryAt)
        throw error
      }
    }
    if (entries.length > 0) this.dependencies.repository.recordPush(ownerId)
  }

  private async pull(ownerId: string, provider: RemoteSyncProvider): Promise<void> {
    let cursor = this.dependencies.repository.getCursor(ownerId).pullSequence
    for (let page = 0; page < 5; page += 1) {
      const changes = await provider.pullChanges(ownerId, cursor, 200)
      if (changes.length === 0) break
      const upsertRefIds = new Set<string>()
      const upsertStateIds = new Set<string>()
      for (const change of changes) {
        if (change.operation === 'delete') {
          this.dependencies.repository.removeCachedEntity(ownerId, change.entityType, change.entityId)
        } else if (change.entityType === 'knowledge_ref') {
          upsertRefIds.add(change.entityId)
        } else {
          upsertStateIds.add(change.entityId)
          upsertRefIds.add(change.entityId)
        }
      }
      const refs = await provider.fetchKnowledgeRefs(ownerId, [...upsertRefIds])
      for (const ref of refs) this.dependencies.repository.cacheKnowledgeRef(ownerId, ref)
      const states = await provider.fetchUserStates(ownerId, [...upsertStateIds])
      for (const state of states) {
        this.dependencies.repository.cacheUserState(ownerId, state)
        const localId = this.dependencies.repository.findMaterializedKnowledgeItemId(
          ownerId,
          state.knowledgeRefId,
        )
        if (localId) {
          this.dependencies.knowledgeStateRepository.applyRemote(localId, {
            read: state.read,
            starred: state.starred,
            disposition: state.disposition,
            updatedAt: state.updatedAt,
          })
        }
      }
      cursor = changes.at(-1)!.sequence
      this.dependencies.repository.recordPull(ownerId, cursor)
      if (changes.length < 200) break
    }
  }

  private updatePending(ownerId: string): void {
    this.dependencies.authService.updateSyncStatus('idle', {
      pendingChanges: this.dependencies.repository.pendingCount(ownerId),
    })
  }

  private get retryBaseDelayMs(): number {
    return this.dependencies.retryBaseDelayMs ?? 1_000
  }

  private now(): Date {
    return this.dependencies.now?.() ?? new Date()
  }
}

function isOfflineError(error: unknown): boolean {
  const message = messageOf(error).toLowerCase()
  return ['fetch failed', 'network', 'offline', 'enotfound', 'econnrefused', 'timeout'].some((token) =>
    message.includes(token),
  )
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
