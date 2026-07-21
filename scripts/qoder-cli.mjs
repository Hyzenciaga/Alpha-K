import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export function resolveBundledQoderCli() {
  const require = createRequire(import.meta.url)
  const sdkEntry = require.resolve('@qoder-ai/qoder-agent-sdk')
  const executable = process.platform === 'win32' ? 'qodercli.exe' : 'qodercli'
  return join(dirname(sdkEntry), '_bundled', executable)
}

export function runQoderCli(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(resolveBundledQoderCli(), args, {
      cwd: options.cwd ?? process.cwd(),
      env: process.env,
      shell: false,
      stdio: options.stdio ?? 'inherit',
    })
    child.once('error', reject)
    child.once('close', (code, signal) => resolve({ code, signal }))
  })
}

const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isEntrypoint) {
  const result = await runQoderCli(process.argv.slice(2))
  if (result.signal) {
    console.error(`qodercli terminated by ${result.signal}`)
    process.exitCode = 1
  } else {
    process.exitCode = result.code ?? 1
  }
}
