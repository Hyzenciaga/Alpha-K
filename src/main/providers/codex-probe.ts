import type { ProviderProbe, ProviderProbeAttempt } from '../../shared/contracts.js'
import { discoverExecutableCandidates } from './executable-discovery.js'
import { runProcess } from './process-runner.js'

const REQUIRED_EXEC_FLAGS = ['--ephemeral', '--json', '--output-schema', '--output-last-message', '--sandbox']

export async function probeCodex(configuredPath?: string): Promise<ProviderProbe> {
  const candidates = await discoverExecutableCandidates({
    command: 'codex',
    configuredPath,
    appBundlePaths:
      process.platform === 'darwin' ? ['/Applications/ChatGPT.app/Contents/Resources/codex'] : [],
  })

  if (candidates.length === 0) {
    return {
      provider: 'codex',
      status: 'not_installed',
      detail: 'No executable Codex candidate was found.',
      attempts: [],
    }
  }

  const attempts: ProviderProbeAttempt[] = []
  for (const candidate of candidates) {
    const attempt = await probeCandidate(candidate.path, candidate.source)
    attempts.push(attempt)
    if (attempt.status === 'available') {
      return {
        provider: 'codex',
        status: 'available',
        selectedExecutable: candidate.path,
        version: attempt.version,
        detail:
          candidate.source === 'app_bundle'
            ? 'Available through an app-bundled candidate; use for Phase 0 only until a supported standalone CLI is repaired.'
            : 'Codex CLI is executable, authenticated, and exposes the required non-interactive flags.',
        attempts,
      }
    }
  }

  const best = attempts.find((attempt) => attempt.status === 'unauthenticated') ?? attempts.at(-1)!
  return {
    provider: 'codex',
    status: best.status,
    selectedExecutable: best.executable,
    version: best.version,
    detail: best.detail ?? 'Codex capability probe failed.',
    attempts,
  }
}

async function probeCandidate(
  executable: string,
  source: ProviderProbeAttempt['source'],
): Promise<ProviderProbeAttempt> {
  const versionResult = await runProcess(executable, ['--version'])
  const version = firstMeaningfulLine(versionResult.stdout) ?? firstMeaningfulLine(versionResult.stderr)
  if (versionResult.exitCode !== 0) {
    return {
      executable,
      source,
      status: 'broken_installation',
      version,
      detail: summarizeFailure(versionResult),
    }
  }

  const helpResult = await runProcess(executable, ['exec', '--help'])
  const help = `${helpResult.stdout}\n${helpResult.stderr}`
  const missingFlags = REQUIRED_EXEC_FLAGS.filter((flag) => !help.includes(flag))
  if (helpResult.exitCode !== 0 || missingFlags.length > 0) {
    return {
      executable,
      source,
      status: 'unsupported_version',
      version,
      detail:
        missingFlags.length > 0
          ? `Missing required flags: ${missingFlags.join(', ')}`
          : summarizeFailure(helpResult),
    }
  }

  const loginResult = await runProcess(executable, ['login', 'status'])
  const loginOutput = `${loginResult.stdout}\n${loginResult.stderr}`
  if (loginResult.exitCode !== 0 || !/logged in/i.test(loginOutput)) {
    return {
      executable,
      source,
      status: 'unauthenticated',
      version,
      detail: summarizeFailure(loginResult),
    }
  }

  return { executable, source, status: 'available', version }
}

function firstMeaningfulLine(value: string): string | undefined {
  return value
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
}

function summarizeFailure(result: Awaited<ReturnType<typeof runProcess>>): string {
  if (result.timedOut) return 'Process timed out.'
  return result.error ?? firstMeaningfulLine(result.stderr) ?? firstMeaningfulLine(result.stdout) ?? 'Process failed.'
}
