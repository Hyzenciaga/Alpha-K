import type {
  KnowledgeRefUpsert,
  RemoteKnowledgeRef,
  SyncChange,
  UserKnowledgeState,
  UserKnowledgeStateUpsert,
} from '../../shared/domain/cloud-sync.js'

export type RemoteDevice = {
  id: string
  name: string
  platform: 'macos' | 'windows' | 'linux'
  appVersion: string
}

export interface RemoteSyncProvider {
  registerDevice(ownerId: string, device: RemoteDevice): Promise<void>
  upsertKnowledgeRef(ownerId: string, ref: KnowledgeRefUpsert): Promise<RemoteKnowledgeRef>
  upsertUserState(
    ownerId: string,
    knowledgeRefId: string,
    state: UserKnowledgeStateUpsert,
  ): Promise<UserKnowledgeState>
  findKnowledgeRefByKey(ownerId: string, refKey: string): Promise<RemoteKnowledgeRef | null>
  pullChanges(ownerId: string, afterSequence: number, limit: number): Promise<SyncChange[]>
  fetchKnowledgeRefs(ownerId: string, ids: string[]): Promise<RemoteKnowledgeRef[]>
  fetchUserStates(ownerId: string, knowledgeRefIds: string[]): Promise<UserKnowledgeState[]>
}
