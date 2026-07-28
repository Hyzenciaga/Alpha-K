import type {
  CreateLearningCaptureInput,
  LearningCapture,
  LearningCaptureListFilter,
} from '../domain/capture.js'
import type { IpcResult } from './common-contract.js'

export const CAPTURE_IPC_CHANNELS = {
  create: 'captures:create',
  list: 'captures:list',
  archive: 'captures:archive',
} as const

export type CaptureApi = {
  createLearningCapture: (input: CreateLearningCaptureInput) => Promise<IpcResult<LearningCapture>>
  listLearningCaptures: (filter: LearningCaptureListFilter) => Promise<IpcResult<LearningCapture[]>>
  archiveLearningCapture: (captureId: string) => Promise<IpcResult<LearningCapture>>
}
