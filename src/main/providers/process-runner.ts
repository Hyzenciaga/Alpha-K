import { spawn } from 'node:child_process'

export type ProcessResult = {
  exitCode: number | null
  stdout: string
  stderr: string
  timedOut: boolean
  error?: string
}

export async function runProcess(
  executable: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number } = {},
): Promise<ProcessResult> {
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(executable, args, {
        cwd: options.cwd,
        shell: false,
        env: sanitizedEnvironment(),
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (error) {
      resolve({
        exitCode: null,
        stdout: '',
        stderr: '',
        timedOut: false,
        error: error instanceof Error ? error.message : String(error),
      })
      return
    }
    let stdout = ''
    let stderr = ''
    let settled = false
    const timeout = setTimeout(() => {
      if (settled) return
      child.kill('SIGTERM')
      finish({ exitCode: null, stdout, stderr, timedOut: true })
    }, options.timeoutMs ?? 5_000)

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.once('error', (error) => {
      finish({ exitCode: null, stdout, stderr, timedOut: false, error: error.message })
    })
    child.once('close', (exitCode) => {
      finish({ exitCode, stdout, stderr, timedOut: false })
    })

    function finish(result: ProcessResult): void {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolve(result)
    }
  })
}

function sanitizedEnvironment(): NodeJS.ProcessEnv {
  const allowedKeys = [
    'HOME',
    'PATH',
    'SHELL',
    'TMPDIR',
    'USER',
    'LANG',
    'LC_ALL',
    'TERM',
    'COLORTERM',
    'CODEX_HOME',
    'QODER_CONFIG_DIR',
  ]
  return Object.fromEntries(
    allowedKeys.flatMap((key) => (process.env[key] === undefined ? [] : [[key, process.env[key]]])),
  )
}
