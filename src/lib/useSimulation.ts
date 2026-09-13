import { useEffect, useRef, useState } from 'react'
import { simulateShot, type ShotResult, type SimulationConfig } from '../physics/simulate'
import type { SimulationRequest, SimulationResponse } from '../workers/simulation.worker'

export interface SimulationState extends ShotResult {
  /** A newer configuration is being calculated; `result` still shows the previous one. */
  busy: boolean
  /** Completion estimate for the running calculation, 0–1. */
  progress: number
}

/**
 * Runs simulations in a Web Worker so long flights never freeze the page.
 *
 * A worker can only do one job at a time, and a slider drag fires dozens of changes a
 * second, so requests are coalesced: while one calculation runs, only the newest
 * configuration is kept and sent as soon as the worker is free. Intermediate results
 * are still shown as they arrive, so dragging feels live rather than stalled.
 */
export function useSimulation(config: SimulationConfig): SimulationState {
  // The very first shot is computed synchronously so the page never renders empty.
  const [shot, setShot] = useState<ShotResult>(() => simulateShot(config))
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)

  const latest = useRef(config)
  const settled = useRef(shot.result.config)
  const inFlight = useRef<number | null>(null)
  const queued = useRef<SimulationConfig | null>(null)
  const nextId = useRef(0)
  const sendRef = useRef<(config: SimulationConfig) => void>(() => {})

  useEffect(() => {
    const worker = new Worker(new URL('../workers/simulation.worker.ts', import.meta.url), {
      type: 'module',
    })

    const send = (c: SimulationConfig) => {
      const id = ++nextId.current
      inFlight.current = id
      setBusy(true)
      setProgress(0)
      worker.postMessage({ id, config: c } satisfies SimulationRequest)
    }
    sendRef.current = send

    worker.onmessage = (event: MessageEvent<SimulationResponse>) => {
      const message = event.data
      if (message.id !== inFlight.current) return
      if (message.type === 'progress') {
        setProgress(message.progress)
        return
      }
      inFlight.current = null
      settled.current = message.shot.result.config
      setShot(message.shot)
      const next = queued.current
      queued.current = null
      if (next && next !== settled.current) send(next)
      else setBusy(false)
    }

    // If workers are unavailable or the script fails, fall back to the main thread:
    // a brief freeze beats a simulator that never updates.
    worker.onerror = (event) => {
      console.error('Simulation worker failed; computing on the main thread instead.', event)
      inFlight.current = null
      queued.current = null
      sendRef.current = (c) => {
        settled.current = c
        setShot(simulateShot(c))
      }
      sendRef.current(latest.current)
      setBusy(false)
    }

    // Recreated (e.g. StrictMode remount) while a newer config was pending: resend it.
    inFlight.current = null
    queued.current = null
    if (latest.current !== settled.current) send(latest.current)

    return () => worker.terminate()
  }, [])

  useEffect(() => {
    latest.current = config
    if (config === settled.current) return
    if (inFlight.current !== null) queued.current = config
    else sendRef.current(config)
  }, [config])

  return { ...shot, busy, progress }
}
