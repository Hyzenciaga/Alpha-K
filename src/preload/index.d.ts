import type { AlphaKApi } from '../shared/contracts'

declare global {
  interface Window {
    alphaK: AlphaKApi
  }
}

export {}
