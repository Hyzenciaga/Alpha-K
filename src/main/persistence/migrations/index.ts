import { phaseZeroCoreMigration } from './001-phase-zero-core.js'
import { phaseZeroFtsMigration } from './002-phase-zero-fts.js'
import { phaseOneFoundationMigration } from './003-phase-one-foundation.js'
import type { Migration } from './types.js'

export const migrations: Migration[] = [
  phaseZeroCoreMigration,
  phaseZeroFtsMigration,
  phaseOneFoundationMigration,
]
