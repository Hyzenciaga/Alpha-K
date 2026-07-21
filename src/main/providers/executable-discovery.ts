import { constants } from 'node:fs'
import { access } from 'node:fs/promises'
import { delimiter, join } from 'node:path'

export type ExecutableCandidate = {
  path: string
  source: 'configured' | 'path' | 'app_bundle' | 'sdk_bundle'
}

export async function discoverExecutableCandidates(options: {
  command: string
  configuredPath?: string
  appBundlePaths?: string[]
  sdkBundlePaths?: string[]
}): Promise<ExecutableCandidate[]> {
  const raw: ExecutableCandidate[] = []
  if (options.configuredPath) raw.push({ path: options.configuredPath, source: 'configured' })

  for (const directory of (process.env.PATH ?? '').split(delimiter).filter(Boolean)) {
    raw.push({ path: join(directory, options.command), source: 'path' })
  }
  for (const path of options.appBundlePaths ?? []) raw.push({ path, source: 'app_bundle' })
  for (const path of options.sdkBundlePaths ?? []) raw.push({ path, source: 'sdk_bundle' })

  const seen = new Set<string>()
  const candidates: ExecutableCandidate[] = []
  for (const candidate of raw) {
    if (seen.has(candidate.path)) continue
    seen.add(candidate.path)
    try {
      await access(candidate.path, constants.X_OK)
      candidates.push(candidate)
    } catch {
      // Missing candidates are expected during capability discovery.
    }
  }
  return candidates
}
