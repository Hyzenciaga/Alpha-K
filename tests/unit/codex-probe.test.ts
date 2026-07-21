import { describe, expect, it } from 'vitest'
import { discoverExecutableCandidates } from '../../src/main/providers/executable-discovery.js'
import { preferUnpackedAsarPath } from '../../src/main/providers/qoder-probe.js'

describe('provider executable discovery', () => {
  it('does not treat a missing configured executable as installed', async () => {
    const candidates = await discoverExecutableCandidates({
      command: 'definitely-not-an-alpha-k-command',
      configuredPath: '/tmp/alpha-k-missing-provider',
    })
    expect(candidates).toEqual([])
  })

  it('leaves ordinary executable paths unchanged', () => {
    expect(preferUnpackedAsarPath('/opt/qoder/qodercli')).toBe('/opt/qoder/qodercli')
  })
})
