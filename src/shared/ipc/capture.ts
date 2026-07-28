import {
  ArchiveLearningCaptureRequestSchema,
  CreateLearningCaptureInputSchema,
  LearningCaptureListFilterSchema,
  LearningCaptureSchema,
} from '../domain/capture.js'

export { CAPTURE_IPC_CHANNELS } from './capture-contract.js'
export type { CaptureApi } from './capture-contract.js'

export const CaptureIpcRequestSchemas = {
  create: CreateLearningCaptureInputSchema,
  list: LearningCaptureListFilterSchema,
  archive: ArchiveLearningCaptureRequestSchema,
} as const

export const CaptureIpcResponseSchemas = {
  create: LearningCaptureSchema,
  list: LearningCaptureSchema.array(),
  archive: LearningCaptureSchema,
} as const
