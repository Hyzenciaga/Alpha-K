import { describe, expect, it } from 'vitest'
import { nextWindowEvent, shouldHideWindowOnClose } from '../../src/main/lifecycle/window-lifecycle.js'

describe('window lifecycle', () => {
  it('hides the window when the user closes it without quitting', () => {
    expect(shouldHideWindowOnClose(false)).toBe(true)
  })

  it('allows the window to close during a real quit', () => {
    expect(shouldHideWindowOnClose(true)).toBe(false)
  })

  it('reports stable lifecycle event names', () => {
    expect(nextWindowEvent(true)).toBe('window-restored')
    expect(nextWindowEvent(false)).toBe('window-hidden')
  })
})
