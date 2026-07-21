import { qodercliAuth, query } from '@qoder-ai/qoder-agent-sdk'
import { resolveBundledQoderCli } from './qoder-cli.mjs'

const abortController = new AbortController()
const startedAt = Date.now()
const hardTimeout = setTimeout(() => {
  console.error('Qoder cancellation smoke test exceeded 10 seconds.')
  process.exit(1)
}, 10_000)

let observedError
try {
  const session = query({
    prompt: 'Produce a detailed 100-section report. This request will be cancelled by the host immediately.',
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

  setTimeout(() => abortController.abort(), 100)
  try {
    for await (const message of session) {
      // The session should end before producing a successful result.
      void message
    }
  } catch (error) {
    observedError = error
  }

  const elapsedMs = Date.now() - startedAt
  if (!abortController.signal.aborted || elapsedMs >= 10_000) {
    throw new Error(`Qoder session did not cancel in time (${elapsedMs}ms).`)
  }

  console.log(
    JSON.stringify({
      provider: 'qoder',
      cancelled: true,
      elapsedMs,
      observedError:
        observedError && typeof observedError === 'object'
          ? { name: observedError.name, code: observedError.code }
          : undefined,
    }),
  )
} finally {
  clearTimeout(hardTimeout)
}
