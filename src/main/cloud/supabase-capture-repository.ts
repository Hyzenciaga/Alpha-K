import type { SupabaseClient } from '@supabase/supabase-js'
import {
  LearningCaptureSchema,
  type LearningCapture,
  type LearningCaptureListFilter,
} from '../../shared/domain/capture.js'

type LearningCaptureRow = {
  id: string
  kind: string
  title: string | null
  note: string | null
  content: string
  normalized_url: string | null
  source_host: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export class SupabaseCaptureRepository {
  constructor(private readonly client: SupabaseClient) {}

  async create(
    ownerId: string,
    input: {
      id: string
      kind: LearningCapture['kind']
      title: string | null
      note: string | null
      content: string
      normalizedUrl: string | null
      sourceHost: string | null
    },
  ): Promise<LearningCapture> {
    const { data, error } = await this.client
      .from('learning_captures')
      .insert({
        id: input.id,
        owner_id: ownerId,
        kind: input.kind,
        title: input.title,
        note: input.note,
        content: input.content,
        normalized_url: input.normalizedUrl,
        source_host: input.sourceHost,
      })
      .select(CAPTURE_COLUMNS)
      .single()
    if (error) throw error
    return mapCapture(data as LearningCaptureRow)
  }

  async list(ownerId: string, filter: Required<LearningCaptureListFilter>): Promise<LearningCapture[]> {
    let query = this.client
      .from('learning_captures')
      .select(CAPTURE_COLUMNS)
      .eq('owner_id', ownerId)
      .eq('kind', filter.kind)
      .order('created_at', { ascending: false })
      .range(filter.offset, filter.offset + filter.limit - 1)

    if (!filter.includeArchived) query = query.is('archived_at', null)

    const { data, error } = await query
    if (error) throw error
    return (data as LearningCaptureRow[]).map(mapCapture)
  }

  async archive(ownerId: string, captureId: string, archivedAt: string): Promise<LearningCapture | null> {
    const { data, error } = await this.client
      .from('learning_captures')
      .update({ archived_at: archivedAt })
      .eq('owner_id', ownerId)
      .eq('id', captureId)
      .is('archived_at', null)
      .select(CAPTURE_COLUMNS)
      .maybeSingle()
    if (error) throw error
    return data ? mapCapture(data as LearningCaptureRow) : null
  }
}

const CAPTURE_COLUMNS =
  'id, kind, title, note, content, normalized_url, source_host, archived_at, created_at, updated_at'

function mapCapture(row: LearningCaptureRow): LearningCapture {
  return LearningCaptureSchema.parse({
    id: row.id,
    kind: row.kind,
    title: row.title,
    note: row.note,
    content: row.content,
    normalizedUrl: row.normalized_url,
    sourceHost: row.source_host,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}
