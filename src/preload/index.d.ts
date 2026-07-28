import type { AlphaKApi } from '../shared/contracts'
import type { PhaseOneApi } from '../shared/ipc/phase-one-contract'
import type { PhaseTwoApi } from '../shared/ipc/phase-two-contract'
import type { CloudApi } from '../shared/ipc/cloud-contract'
import type { CaptureApi } from '../shared/ipc/capture-contract'
import type { UpdateApi } from '../shared/ipc/update-contract'

declare global {
  interface Window {
    alphaK: AlphaKApi & PhaseOneApi & PhaseTwoApi & CloudApi & CaptureApi & UpdateApi
  }
}

export {}
