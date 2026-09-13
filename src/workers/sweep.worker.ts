import type { SimulationConfig } from '../physics/simulate'
import { runSweep, type SweepDefinition, type SweepResult } from '../physics/sweep'

export interface SweepRequest {
  id: number
  config: SimulationConfig
  definition: SweepDefinition
  includeVacuum: boolean
}

export interface SweepResponse {
  id: number
  result: SweepResult
  vacuum: SweepResult | null
}

self.onmessage = (event: MessageEvent<SweepRequest>) => {
  const { id, config, definition, includeVacuum } = event.data
  const result = runSweep(config, definition)
  const vacuum = includeVacuum
    ? runSweep(
        { ...config, toggles: { drag: false, wind: false, magnus: false, coriolis: false } },
        definition,
      )
    : null
  ;(self as unknown as Worker).postMessage({ id, result, vacuum } satisfies SweepResponse)
}
