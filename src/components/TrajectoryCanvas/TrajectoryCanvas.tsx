import { useEffect, useRef } from 'react'
import { playback } from '../../lib/playback'
import type { SimulationResult } from '../../physics/simulate'
import { drawScene, type ShotOverlay, type ViewOptions } from './draw'
import { ParticleSystem } from './particles'

interface Props {
  result: SimulationResult
  shots: ShotOverlay[]
  options: ViewOptions
}

/**
 * 2D flight view. Draws imperatively on a canvas, driven by the playback store
 * rather than React renders, and only runs an animation loop while something is
 * actually moving (the shot, or lingering smoke).
 */
export function TrajectoryCanvas({ result, shots, options }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef({ result, shots, options })
  const requestRef = useRef<() => void>(() => {})

  useEffect(() => {
    const canvas = canvasRef.current!
    const container = containerRef.current!
    const ctx = canvas.getContext('2d')!
    const particles = new ParticleSystem()

    let raf = 0
    let lastFrame = 0
    let width = 0
    let height = 0
    let dpr = 1
    let lastRunId = playback.getState().runId
    let prevTime = playback.getState().time
    let prevDuration = playback.getState().duration
    let wasPlaying = false

    const frame = (now: number) => {
      raf = 0
      if (width === 0 || height === 0) return
      const dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0
      lastFrame = now

      const pb = playback.getState()
      const { result, shots, options } = inputRef.current

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const geo = drawScene(ctx, width, height, { result, shots, options, time: pb.time })

      if (pb.runId !== lastRunId) {
        lastRunId = pb.runId
        particles.clear()
        particles.emitMuzzle(geo.muzzle.x, geo.muzzle.y, geo.muzzleAngle)
        prevTime = 0
      }
      const impactT = result.impact.time
      if (
        !result.impact.truncated &&
        wasPlaying &&
        pb.duration === prevDuration &&
        prevTime < impactT &&
        pb.time >= impactT
      ) {
        particles.emitImpact(geo.impact.x, geo.impact.y)
      }
      prevTime = pb.time
      prevDuration = pb.duration
      wasPlaying = pb.playing

      particles.update(dt)
      particles.draw(ctx)

      if (pb.playing || particles.alive) raf = requestAnimationFrame(frame)
      else lastFrame = 0
    }

    const request = () => {
      if (!raf) raf = requestAnimationFrame(frame)
    }
    requestRef.current = request

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect
      dpr = Math.min(window.devicePixelRatio || 1, 2.5)
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      request()
    })
    observer.observe(container)
    const unsubscribe = playback.subscribe(request)

    return () => {
      observer.disconnect()
      unsubscribe()
      cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    inputRef.current = { result, shots, options }
    requestRef.current()
  }, [result, shots, options])

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        role="img"
        aria-label={`Trajectory plot: range ${Math.round(result.summary.maxRange)} metres, apogee ${Math.round(result.summary.maxHeight)} metres`}
      />
    </div>
  )
}
