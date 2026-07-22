import type { PhaseOneApi } from '../../shared/ipc/phase-one-contract.js'
import type { PhaseTwoApi } from '../../shared/ipc/phase-two-contract.js'

export type PhaseTwoRendererClient = PhaseTwoApi & Pick<PhaseOneApi, 'onAppEvent'>

export function getProductionPhaseTwoClient(): PhaseTwoRendererClient {
  return window.alphaK
}
