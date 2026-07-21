import { qodercliAuth, query } from '@qoder-ai/qoder-agent-sdk'
import { resolveBundledQoderCli } from './qoder-cli.mjs'

const abortController = new AbortController()
const timeout = setTimeout(() => abortController.abort(), 120_000)

try {
  const session = query({
    prompt: 'Reply with exactly: Qoder SDK smoke test passed',
    options: {
      auth: qodercliAuth(),
      pathToQoderCLIExecutable: resolveBundledQoderCli(),
      cwd: process.cwd(),
      abortController,
      permissionMode: 'dontAsk',
      tools: [],
      settingSources: [],
      maxTurns: 1,
    },
  })

  let result
  for await (const message of session) {
    if (message.type === 'result') result = message
  }

  if (!result || result.subtype !== 'success') {
    const errors = result && 'errors' in result ? result.errors.join('; ') : 'No success result received.'
    throw new Error(errors)
  }

  console.log(
    JSON.stringify({
      provider: 'qoder',
      ok: true,
      result: result.result,
      turns: result.num_turns,
    }),
  )
} catch (error) {
  if (error && typeof error === 'object' && error.code === 'QODER_CLI_PROCESS_ERROR' && error.exitCode === 41) {
    console.error('Qoder CLI is not authenticated. Run: pnpm qoder:login')
  } else {
    console.error(error instanceof Error ? error.message : String(error))
  }
  process.exitCode = 1
} finally {
  clearTimeout(timeout)
}
