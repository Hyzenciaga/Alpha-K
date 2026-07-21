import type { AlphaKApi } from '../shared/contracts'
import type { PhaseOneApi } from '../shared/ipc/phase-one'

declare global {
  interface Window {
    alphaK: AlphaKApi & PhaseOneApi
  }
}

export {}
