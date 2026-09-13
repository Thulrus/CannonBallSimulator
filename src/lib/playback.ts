import { useEffect, useState, useSyncExternalStore } from 'react'

export type PlaybackRate = 'auto' | number

export interface PlaybackState {
  /** Current flight time, s. */
  time: number
  /** Total flight time, s. */
  duration: number
  playing: boolean
  rate: PlaybackRate
  /** Increments every time the cannon is fired, so views can trigger one-shot effects. */
  runId: number
}

/** In auto mode, long flights are sped up so they play out in about this many seconds. */
const AUTO_FLIGHT_SECONDS = 7

/**
 * Playback clock, kept outside React state on purpose: it ticks at display refresh
 * rate, and routing that through `useState` in App would re-render every control
 * and chart 60 times a second. Components subscribe to exactly as much as they need.
 */
class PlaybackStore {
  private state: PlaybackState = { time: 0, duration: 0, playing: false, rate: 'auto', runId: 0 }
  private listeners = new Set<() => void>()
  private raf = 0
  private last = 0

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getState = () => this.state

  effectiveRate = () =>
    this.state.rate === 'auto'
      ? Math.max(1, this.state.duration / AUTO_FLIGHT_SECONDS)
      : this.state.rate

  /** New flight computed: park the playhead at the end so the full result is visible. */
  load(duration: number) {
    this.stopLoop()
    this.set({ duration, time: duration, playing: false })
  }

  fire() {
    this.set({ time: 0, playing: true, runId: this.state.runId + 1 })
    this.startLoop()
  }

  play() {
    if (this.state.playing) return
    if (this.state.time >= this.state.duration) return this.fire()
    this.set({ playing: true })
    this.startLoop()
  }

  pause() {
    this.stopLoop()
    if (this.state.playing) this.set({ playing: false })
  }

  toggle() {
    if (this.state.playing) this.pause()
    else this.play()
  }

  seek(time: number) {
    this.set({ time: Math.min(Math.max(time, 0), this.state.duration) })
  }

  /** Step by a fraction of the flight, pausing first. */
  nudge(fraction: number) {
    this.pause()
    this.seek(this.state.time + fraction * this.state.duration)
  }

  setRate(rate: PlaybackRate) {
    this.set({ rate })
  }

  private set(patch: Partial<PlaybackState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((l) => l())
  }

  private startLoop() {
    if (this.raf) return
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.tick)
  }

  private stopLoop() {
    cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  private tick = (now: number) => {
    this.raf = 0
    if (!this.state.playing) return
    const dt = Math.min((now - this.last) / 1000, 0.1)
    this.last = now
    const time = this.state.time + dt * this.effectiveRate()
    if (time >= this.state.duration) {
      this.set({ time: this.state.duration, playing: false })
    } else {
      this.set({ time })
      this.raf = requestAnimationFrame(this.tick)
    }
  }
}

export const playback = new PlaybackStore()

/** Full playback state; re-renders on every tick. Use for small components only. */
export function usePlaybackState(): PlaybackState {
  return useSyncExternalStore(playback.subscribe, playback.getState)
}

/**
 * Playback time, throttled to `maxFps` while playing. Charts and readouts don't need
 * 60 Hz updates, and Recharts in particular gets expensive at that rate.
 */
export function usePlaybackTime(maxFps = 30): number {
  const [time, setTime] = useState(() => playback.getState().time)

  useEffect(() => {
    const interval = 1000 / maxFps
    let lastEmit = 0
    let pending = 0

    const flush = () => {
      pending = 0
      lastEmit = performance.now()
      setTime(playback.getState().time)
    }

    const onChange = () => {
      const s = playback.getState()
      if (!s.playing || performance.now() - lastEmit >= interval) {
        window.clearTimeout(pending)
        flush()
      } else if (!pending) {
        pending = window.setTimeout(flush, interval)
      }
    }

    const unsubscribe = playback.subscribe(onChange)
    onChange()
    return () => {
      unsubscribe()
      window.clearTimeout(pending)
    }
  }, [maxFps])

  return time
}
