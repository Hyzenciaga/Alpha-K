import type Database from 'better-sqlite3'
import { IdSchema } from '../../../shared/domain/common.js'
import {
  KnowledgeDispositionSchema,
  type KnowledgeDisposition,
} from '../../../shared/domain/cloud-sync.js'

export type LocalKnowledgeState = {
  knowledgeItemId: string
  read: boolean
  starred: boolean
  disposition: KnowledgeDisposition | null
  updatedAt: string
}

type StateRow = {
  knowledge_item_id: string
  is_read: number
  is_starred: number
  disposition: string | null
  updated_at: string
}

export class KnowledgeStateRepository {
  constructor(
    private readonly database: Database.Database,
    private readonly dependencies: { now?: () => Date } = {},
  ) {}

  get(knowledgeItemId: string): LocalKnowledgeState | undefined {
    const row = this.database
      .prepare('SELECT * FROM knowledge_item_user_states WHERE knowledge_item_id = ?')
      .get(IdSchema.parse(knowledgeItemId)) as StateRow | undefined
    return row ? mapState(row) : undefined
  }

  upsert(
    knowledgeItemId: string,
    patch: Partial<Pick<LocalKnowledgeState, 'read' | 'starred' | 'disposition'>>,
    options: { updatedAt?: string } = {},
  ): LocalKnowledgeState {
    const id = IdSchema.parse(knowledgeItemId)
    const existing = this.get(id)
    const next = {
      read: patch.read ?? existing?.read ?? false,
      starred: patch.starred ?? existing?.starred ?? false,
      disposition:
        patch.disposition === undefined
          ? (existing?.disposition ?? null)
          : patch.disposition === null
            ? null
            : KnowledgeDispositionSchema.parse(patch.disposition),
      updatedAt: options.updatedAt ?? this.now(),
    }
    this.database
      .prepare(
        `INSERT INTO knowledge_item_user_states
          (knowledge_item_id, is_read, is_starred, disposition, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (knowledge_item_id) DO UPDATE SET
          is_read = excluded.is_read,
          is_starred = excluded.is_starred,
          disposition = excluded.disposition,
          updated_at = excluded.updated_at`,
      )
      .run(id, next.read ? 1 : 0, next.starred ? 1 : 0, next.disposition, next.updatedAt)
    return this.get(id)!
  }

  applyRemote(
    knowledgeItemId: string,
    state: Omit<LocalKnowledgeState, 'knowledgeItemId'>,
  ): LocalKnowledgeState {
    const existing = this.get(knowledgeItemId)
    if (existing && existing.updatedAt > state.updatedAt) return existing
    return this.upsert(
      knowledgeItemId,
      { read: state.read, starred: state.starred, disposition: state.disposition },
      { updatedAt: state.updatedAt },
    )
  }

  private now(): string {
    return (this.dependencies.now?.() ?? new Date()).toISOString()
  }
}

function mapState(row: StateRow): LocalKnowledgeState {
  return {
    knowledgeItemId: IdSchema.parse(row.knowledge_item_id),
    read: row.is_read === 1,
    starred: row.is_starred === 1,
    disposition: row.disposition ? KnowledgeDispositionSchema.parse(row.disposition) : null,
    updatedAt: row.updated_at,
  }
}
