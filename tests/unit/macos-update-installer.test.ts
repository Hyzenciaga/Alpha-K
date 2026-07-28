import { describe, expect, it } from 'vitest'
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { MacUpdateInstaller, updateHealthPathFromArgs } from '../../src/main/update/macos-update-installer.js'
import type { PreparedUpdate } from '../../src/main/update/app-update-service.js'
import type { VerifiedUpdateRelease } from '../../src/main/update/update-manifest.js'

const execFileAsync = promisify(execFile)

describe('updateHealthPathFromArgs', () => {
  const appPath = '/Users/example/Applications/Alpha-K.app'

  it('accepts only a health marker inside the app sibling update workspace', () => {
    const healthPath = '/Users/example/Applications/.alpha-k-update-123/healthy'
    expect(updateHealthPathFromArgs([`--alpha-k-update-health=${healthPath}`], appPath)).toBe(healthPath)
  })

  it('rejects an arbitrary path supplied through command-line arguments', () => {
    expect(updateHealthPathFromArgs(['--alpha-k-update-health=/tmp/healthy'], appPath)).toBeNull()
  })

  it('normalizes the health path before checking its workspace boundary', () => {
    expect(
      updateHealthPathFromArgs(
        ['--alpha-k-update-health=/Users/example/Applications/.alpha-k-update-123/nested/../healthy'],
        appPath,
      ),
    ).toBe('/Users/example/Applications/.alpha-k-update-123/healthy')
  })

  it('stages a verified ZIP beside the installed app before shutdown', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'alpha-k-installer-'))
    try {
      const installedApp = join(parent, 'Alpha-K.app')
      const archiveSource = join(parent, 'archive-source')
      const archiveApp = join(archiveSource, 'Alpha-K.app')
      const executable = join(archiveApp, 'Contents', 'MacOS', 'Alpha-K')
      await mkdir(join(installedApp, 'Contents', 'MacOS'), { recursive: true })
      await mkdir(join(archiveApp, 'Contents', 'MacOS'), { recursive: true })
      await writeFile(join(installedApp, 'Contents', 'MacOS', 'Alpha-K'), '#!/bin/sh\n')
      await writeFile(executable, '#!/bin/sh\n')
      await chmod(executable, 0o755)
      const archivePath = join(parent, 'Alpha-K-0.2.0-arm64.zip')
      await execFileAsync('/usr/bin/ditto', ['-c', '-k', '--keepParent', 'Alpha-K.app', archivePath], { cwd: archiveSource })
      const installation = await new MacUpdateInstaller({
        appBundlePath: installedApp,
        appName: 'Alpha-K',
        currentVersion: '0.1.0',
        processId: process.pid,
      }).stageInstallation(preparedUpdate(archivePath))

      await expect(readFile(installation.helperPath, 'utf8')).resolves.toContain('alpha-k-update-health')
      await expect(readFile(join(installation.stagedAppPath, 'Contents', 'MacOS', 'Alpha-K'), 'utf8')).resolves.toBe('#!/bin/sh\n')
    } finally {
      await rm(parent, { recursive: true, force: true })
    }
  })
})

function preparedUpdate(archivePath: string): PreparedUpdate {
  const release: VerifiedUpdateRelease = {
    schemaVersion: 1,
    version: '0.2.0',
    publishedAt: '2026-07-28T00:00:00.000Z',
    releaseNotes: null,
    asset: {
      name: 'Alpha-K-0.2.0-arm64.zip',
      url: 'https://github.com/Hyzenciaga/Alpha-K/releases/download/v0.2.0/Alpha-K-0.2.0-arm64.zip',
      sha256: 'a'.repeat(64),
      size: 1,
    },
  }
  return { release, archivePath }
}
