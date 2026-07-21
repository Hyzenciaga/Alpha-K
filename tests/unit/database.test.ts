import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { openAlphaKDatabase } from '../../src/main/persistence/database.js'

const cleanupPaths: string[] = []

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('database bootstrap', () => {
  it('runs versioned migrations and supports Chinese trigram search', () => {
    const directory = mkdtempSync(join(tmpdir(), 'alpha-k-db-'))
    cleanupPaths.push(directory)
    const path = join(directory, 'app.sqlite')

    const first = openAlphaKDatabase(path)
    expect(first.health).toMatchObject({ migrationVersion: 2, fts5: true, trigramChinese: true })
    first.close()

    const reopened = openAlphaKDatabase(path)
    expect(reopened.health.migrationVersion).toBe(2)
    reopened.close()
  })
})
