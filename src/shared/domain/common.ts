import { z } from 'zod'

export const IdSchema = z.string().uuid()
export const IsoDateTimeSchema = z.string().datetime({ offset: true })

export type EntityId = z.infer<typeof IdSchema>

