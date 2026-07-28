import { randomUUID } from 'node:crypto'
import {
  CreateLearningCaptureInputSchema,
  LearningCaptureListFilterSchema,
  type CreateLearningCaptureInput,
  type LearningCapture,
  type LearningCaptureListFilter,
} from '../../shared/domain/capture.js'
import type { IpcErrorCode } from '../../shared/ipc/common-contract.js'
import type { CloudAuthService } from '../cloud/cloud-auth-service.js'
import type { SupabaseCaptureRepository } from '../cloud/supabase-capture-repository.js'

type CaptureRepository = Pick<SupabaseCaptureRepository, 'create' | 'list' | 'archive'>

export class CaptureServiceError extends Error {
  constructor(
    readonly code: Extract<IpcErrorCode, 'AUTH_REQUIRED' | 'CAPTURE_INVALID_URL' | 'CAPTURE_NOT_FOUND'>,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'CaptureServiceError'
  }
}

export class CaptureService {
  constructor(
    private readonly dependencies: {
      cloudAuthService: CloudAuthService
      createRepository: () => CaptureRepository
      createId?: () => string
      now?: () => Date
      onCaptureChanged?: (capture: LearningCapture) => void
    },
  ) {}

  async create(input: CreateLearningCaptureInput): Promise<LearningCapture> {
    const parsed = CreateLearningCaptureInputSchema.parse(input)
    const ownerId = this.requireOwnerId()
    const normalized = normalizeCapture(parsed)
    const capture = await this.dependencies.createRepository().create(ownerId, {
      id: this.dependencies.createId?.() ?? randomUUID(),
      ...normalized,
    })
    this.dependencies.onCaptureChanged?.(capture)
    return capture
  }

  async list(filter: LearningCaptureListFilter): Promise<LearningCapture[]> {
    const parsed = LearningCaptureListFilterSchema.parse(filter)
    return this.dependencies.createRepository().list(this.requireOwnerId(), parsed)
  }

  async archive(captureId: string): Promise<LearningCapture> {
    const capture = await this.dependencies
      .createRepository()
      .archive(this.requireOwnerId(), captureId, (this.dependencies.now?.() ?? new Date()).toISOString())
    if (!capture) throw new CaptureServiceError('CAPTURE_NOT_FOUND', '该待学习内容不存在或已被归档。')
    this.dependencies.onCaptureChanged?.(capture)
    return capture
  }

  private requireOwnerId(): string {
    const status = this.dependencies.cloudAuthService.getStatus()
    if (status.auth !== 'signed_in' || !status.user) {
      throw new CaptureServiceError('AUTH_REQUIRED', '请先登录 GitHub 账户后再使用待学习。')
    }
    return status.user.id
  }
}

function normalizeCapture(input: ReturnType<typeof CreateLearningCaptureInputSchema.parse>): {
  kind: LearningCapture['kind']
  title: string | null
  note: string | null
  content: string
  normalizedUrl: string | null
  sourceHost: string | null
} {
  const title = input.title?.trim() || null
  const note = input.note?.trim() || null
  if (input.kind === 'note') {
    return { kind: 'note', title, note: null, content: input.content, normalizedUrl: null, sourceHost: null }
  }

  let url: URL
  try {
    url = new URL(input.content)
  } catch (error) {
    throw new CaptureServiceError('CAPTURE_INVALID_URL', '请输入完整的 http 或 https 链接。', { cause: error })
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new CaptureServiceError('CAPTURE_INVALID_URL', '暂时只支持 http 或 https 链接。')
  }

  url.hash = ''
  url.hostname = url.hostname.toLowerCase()
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
    url.port = ''
  }
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '')
  url.searchParams.sort()

  return {
    kind: 'link',
    title: null,
    note,
    content: input.content,
    normalizedUrl: url.toString(),
    sourceHost: url.hostname.replace(/^www\./, ''),
  }
}
