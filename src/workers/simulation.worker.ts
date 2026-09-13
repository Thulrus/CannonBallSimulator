import { simulateShot, type ShotResult, type SimulationConfig } from '../physics/simulate'

export interface SimulationRequest {
  id: number
  config: SimulationConfig
}

export type SimulationResponse =
  | { type: 'progress'; id: number; progress: number }
  | { type: 'done'; id: number; shot: ShotResult }

const post = (message: SimulationResponse) => (self as unknown as Worker).postMessage(message)

self.onmessage = (event: MessageEvent<SimulationRequest>) => {
  const { id, config } = event.data
  let lastPosted = -1
  const shot = simulateShot(config, (progress) => {
    // Throttle to 1% steps so a long flight doesn't flood the main thread with messages.
    if (progress - lastPosted >= 0.01) {
      lastPosted = progress
      post({ type: 'progress', id, progress })
    }
  })
  // The UI only reads the aim run's impact and summary, so don't pay to copy its
  // full time series across the thread boundary — keep just the final sample.
  const aim = shot.aim && { ...shot.aim, samples: shot.aim.samples.slice(-1) }
  post({ type: 'done', id, shot: { result: shot.result, aim } })
}
