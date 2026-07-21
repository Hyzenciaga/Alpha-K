import { z } from 'zod'
import { IdSchema, IsoDateTimeSchema } from './common.js'

export const VAULT_MANIFEST_FILENAME = '.knowledge-vault.json'
export const VAULT_SCHEMA_VERSION = 1 as const

export const VaultManifestSchema = z
  .object({
    schemaVersion: z.literal(VAULT_SCHEMA_VERSION),
    vaultId: IdSchema,
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict()

export const VaultSchema = z
  .object({
    id: IdSchema,
    path: z.string().min(1),
    manifestSchemaVersion: z.number().int().positive(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
    lastOpenedAt: IsoDateTimeSchema,
  })
  .strict()

export const VaultConnectionSchema = z
  .object({
    state: z.enum(['unconfigured', 'ready', 'missing', 'invalid']),
    vault: VaultSchema.nullable(),
    error: z.string().nullable(),
  })
  .strict()

export type VaultManifest = z.infer<typeof VaultManifestSchema>
export type Vault = z.infer<typeof VaultSchema>
export type VaultConnection = z.infer<typeof VaultConnectionSchema>
