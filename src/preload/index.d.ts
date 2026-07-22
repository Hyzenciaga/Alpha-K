import type { AlphaKApi } from '../shared/contracts'
import type { PhaseOneApi } from '../shared/ipc/phase-one-contract'

declare global {
  interface Window {
    alphaK: AlphaKApi & PhaseOneApi
  }
}

export {}
