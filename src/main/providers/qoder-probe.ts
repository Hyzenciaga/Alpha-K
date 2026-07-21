import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import type { ProviderProbe } from '../../shared/contracts.js'
import { discoverExecutableCandidates } from './executable-discovery.js'
import { runProcess } from './process-runner.js'

export async function probeQoder(configuredPath?: string): Promise<ProviderProbe> {
  const candidates = await discoverExecutableCandidates({
    command: 'qodercli',
    configuredPath,
    sdkBundlePaths: resolveSdkBundledCandidates(),
  })

  if (candidates.length === 0) {
    return {
      provider: 'qoder',
      status: 'not_installed',
      detail:
        'qodercli was not found on PATH. Phase 0 must additionally test the Qoder Agent SDK bundled executable.',
      attempts: [],
    }
  }

  const attempts = []
  for (const candidate of candidates) {
    const versionResult = await runProcess(candidate.path, ['--version'], { timeoutMs: 15_000 })
    const versionOutput = `${versionResult.stdout}\n${versionResult.stderr}`.trim()
    const authResult =
      versionResult.exitCode === 0
        ? await runProcess(candidate.path, ['--list-models'], { timeoutMs: 30_000 })
        : undefined
    const authOutput = authResult ? `${authResult.stdout}\n${authResult.stderr}`.trim() : ''
    const authenticated =
      authResult?.exitCode === 0 &&
      authOutput.length > 0 &&
      !/not logged in|please run \/login|unauthenticated/i.test(authOutput)
    const status =
      versionResult.exitCode !== 0
        ? ('broken_installation' as const)
        : authenticated
          ? ('available' as const)
          : ('unauthenticated' as const)
    const attempt = {
      executable: candidate.path,
      source: candidate.source,
      status,
      version: versionOutput.split('\n').find(Boolean),
      detail:
        versionResult.exitCode !== 0
          ? versionResult.error ?? versionOutput
          : authenticated
            ? 'SDK bundled CLI is executable and has an authenticated local session.'
            : authOutput || 'Qoder CLI is executable but no authenticated local session was found.',
    }
    attempts.push(attempt)
    if (attempt.status === 'available') {
      return {
        provider: 'qoder',
        status: 'available',
        selectedExecutable: candidate.path,
        version: attempt.version,
        detail: attempt.detail,
        attempts,
      }
    }
  }

  return {
    provider: 'qoder',
    status: attempts.some((attempt) => attempt.status === 'unauthenticated')
      ? 'unauthenticated'
      : 'broken_installation',
    selectedExecutable: attempts[0]?.executable,
    detail: attempts[0]?.detail ?? 'Qoder CLI capability probe failed.',
    attempts,
  }
}

function resolveSdkBundledCandidates(): string[] {
  try {
    const require = createRequire(import.meta.url)
    const sdkEntry = require.resolve('@qoder-ai/qoder-agent-sdk')
    const executable = process.platform === 'win32' ? 'qodercli.exe' : 'qodercli'
    const bundledPath = join(dirname(sdkEntry), '_bundled', executable)
    return [preferUnpackedAsarPath(bundledPath)]
  } catch {
    return []
  }
}

export function preferUnpackedAsarPath(path: string): string {
  const marker = `${sep}app.asar${sep}`
  if (!path.includes(marker)) return path
  const unpackedPath = path.replace(marker, `${sep}app.asar.unpacked${sep}`)
  return existsSync(unpackedPath) ? unpackedPath : path
}
