import type { AlphaKApi } from '../shared/contracts'
import type { PhaseOneApi } from '../shared/ipc/phase-one-contract'
import type { PhaseTwoApi } from '../shared/ipc/phase-two-contract'

declare global {
  interface Window {
    alphaK: AlphaKApi & PhaseOneApi & PhaseTwoApi
  }
}

export {}
