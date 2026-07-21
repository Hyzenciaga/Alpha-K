export function shouldHideWindowOnClose(isQuitting: boolean): boolean {
  return !isQuitting
}

export function nextWindowEvent(isVisible: boolean): 'window-restored' | 'window-hidden' {
  return isVisible ? 'window-restored' : 'window-hidden'
}
