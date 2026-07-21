import { spawn } from 'node:child_process'
import { constants, existsSync } from 'node:fs'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { delimiter, dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const requiredFlags = ['--ephemeral', '--json', '--output-schema', '--output-last-message', '--sandbox']
const schemaPath = fileURLToPath(new URL('../tests/fixtures/provider-smoke-output.schema.json', import.meta.url))
const workspace = await mkdtemp(join(tmpdir(), 'alpha-k-codex-smoke-'))
const outputPath = join(workspace, 'result.json')

try {
  const executable = await findWorkingCodex()
  const help = await run(executable, ['exec', '--help'], { timeoutMs: 10_000 })
  const helpOutput = `${help.stdout}\n${help.stderr}`
  const missingFlags = requiredFlags.filter((flag) => !helpOutput.includes(flag))
  if (missingFlags.length > 0) throw new Error(`Codex is missing required flags: ${missingFlags.join(', ')}`)

  const optionalIsolationFlags = [
    helpOutput.includes('--ignore-user-config') ? '--ignore-user-config' : undefined,
    helpOutput.includes('--ignore-rules') ? '--ignore-rules' : undefined,
  ].filter(Boolean)

  const result = await run(
    executable,
    [
      'exec',
      '--ephemeral',
      '--json',
      '--skip-git-repo-check',
      ...optionalIsolationFlags,
      '--sandbox',
      'read-only',
      '--output-schema',
      schemaPath,
      '-o',
      outputPath,
      '-C',
      workspace,
      'Return a JSON object with provider set to codex, ok set to true, and a short message. Do not inspect files or use tools.',
    ],
    { timeoutMs: 180_000 },
  )
  if (result.exitCode !== 0) throw new Error(lastMeaningfulLine(result.stderr) ?? 'Codex smoke test failed.')

  const events = result.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
  if (!events.some((event) => event.type === 'turn.completed')) {
    throw new Error('Codex JSONL stream did not contain turn.completed.')
  }

  const output = JSON.parse(await readFile(outputPath, 'utf8'))
  if (output.provider !== 'codex' || output.ok !== true || typeof output.message !== 'string') {
    throw new Error('Codex output did not match the Phase 0 schema contract.')
  }

  console.log(JSON.stringify({ executable, ok: true, output }))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
} finally {
  await rm(workspace, { recursive: true, force: true })
}

async function findWorkingCodex() {
  const candidates = [
    process.env.CODEX_PATH,
    ...((process.env.PATH ?? '').split(delimiter).filter(Boolean).map((directory) => join(directory, 'codex'))),
    process.platform === 'darwin' ? '/Applications/ChatGPT.app/Contents/Resources/codex' : undefined,
  ].filter(Boolean)

  for (const candidate of [...new Set(candidates)]) {
    if (!existsSync(candidate)) continue
    try {
      await access(candidate, constants.X_OK)
      const result = await run(candidate, ['--version'], { timeoutMs: 10_000 })
      if (result.exitCode === 0) return candidate
    } catch {
      // Keep looking after a broken wrapper or unsupported candidate.
    }
  }
  throw new Error('No working Codex executable was found.')
}

function run(executable, args, { timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: dirname(executable),
      env: process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      finish(new Error(`Process timed out after ${timeoutMs}ms.`))
    }, timeoutMs)

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8')
    })
    child.once('error', finish)
    child.once('close', (exitCode, signal) => finish(undefined, { exitCode, signal, stdout, stderr }))

    function finish(error, result) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error) reject(error)
      else resolve(result)
    }
  })
}

function lastMeaningfulLine(value) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1)
}
