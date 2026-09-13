import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { ControlPanel } from './components/ControlPanel/ControlPanel'
import { DataPanel } from './components/DataPanel/DataPanel'
import { ImpactMap } from './components/Flight/ImpactMap'
import { LiveReadout } from './components/Flight/LiveReadout'
import { PlaybackBar } from './components/Flight/PlaybackBar'
import { PresetSelector } from './components/PresetSelector/PresetSelector'
import type { ViewMode, ViewOptions } from './components/TrajectoryCanvas/draw'
import { TrajectoryCanvas } from './components/TrajectoryCanvas/TrajectoryCanvas'
import { Segmented, ToggleChip } from './components/ui/controls'
import { KeyboardIcon, ResetIcon } from './components/ui/icons'
import { applyPreset, CANNON_PRESETS } from './data/cannonPresets'
import { DEFAULT_CONFIG } from './data/defaults'
import { FORCE_COLORS, SHOT_COLORS } from './lib/colors'
import type { PinnedShot } from './lib/misc'
import { playback } from './lib/playback'
import { configFromLocation, encodeConfig } from './lib/share'
import type { UnitSystem } from './lib/units'
import { simulate, type SimulationConfig } from './physics/simulate'

const UNITS_KEY = 'cannonball.units'

function loadUnits(): UnitSystem {
  try {
    return localStorage.getItem(UNITS_KEY) === 'imperial' ? 'imperial' : 'metric'
  } catch {
    return 'metric'
  }
}

export default function App() {
  const [config, setConfigState] = useState<SimulationConfig>(
    () => configFromLocation() ?? DEFAULT_CONFIG,
  )
  const [presetId, setPresetId] = useState<string | null>(null)
  const [units, setUnits] = useState<UnitSystem>(loadUnits)
  const [view, setView] = useState<ViewMode>('side')
  const [showVacuum, setShowVacuum] = useState(true)
  const [showForces, setShowForces] = useState(true)
  const [trueScale, setTrueScale] = useState(false)
  const [shots, setShots] = useState<PinnedShot[]>([])
  const nextShotId = useRef(1)
  const fireOnNextResult = useRef(true)

  const setConfig = useCallback((next: SimulationConfig) => {
    setConfigState(next)
    setPresetId(null)
  }, [])

  // Slider drags can outpace the integrator on long flights; let React drop
  // intermediate configs rather than queueing every one.
  const deferred = useDeferredValue(config)
  const result = useMemo(() => simulate(deferred), [deferred])

  const hasLateral =
    (deferred.toggles.wind && deferred.environment.wind.speed > 0) ||
    (deferred.toggles.magnus && deferred.projectile.spinRpm > 0) ||
    deferred.toggles.coriolis
  const aim = useMemo(
    () =>
      hasLateral
        ? simulate({
            ...deferred,
            toggles: { ...deferred.toggles, wind: false, magnus: false, coriolis: false },
          })
        : null,
    [deferred, hasLateral],
  )

  // Guard against StrictMode's double effect run: re-loading the same result would
  // park the playhead and cancel the flight that was just fired.
  const loadedResult = useRef<typeof result | null>(null)
  useEffect(() => {
    if (loadedResult.current === result) return
    loadedResult.current = result
    playback.load(result.impact.time)
    if (fireOnNextResult.current) {
      fireOnNextResult.current = false
      playback.fire()
    }
  }, [result])

  useEffect(() => {
    const id = window.setTimeout(() => {
      history.replaceState(null, '', `#c=${encodeConfig(config)}`)
    }, 400)
    return () => window.clearTimeout(id)
  }, [config])

  useEffect(() => {
    try {
      localStorage.setItem(UNITS_KEY, units)
    } catch {
      /* storage unavailable — the toggle still works for this session */
    }
  }, [units])

  const fire = useCallback(() => playback.fire(), [])

  const applyPresetById = useCallback((id: string) => {
    fireOnNextResult.current = true
    setConfigState(applyPreset(id, DEFAULT_CONFIG))
    setPresetId(id)
  }, [])

  const reset = useCallback(() => {
    fireOnNextResult.current = true
    setConfigState(DEFAULT_CONFIG)
    setPresetId(null)
  }, [])

  const pin = useCallback(() => {
    const id = nextShotId.current++
    const preset = CANNON_PRESETS.find((p) => p.id === presetId)
    const c = result.config
    const label = `${preset ? preset.name.split(/[ (]/)[0] : `Shot ${id}`} · ${c.cannon.elevation.toFixed(1)}°`
    setShots((list) =>
      [
        ...list,
        { id, label, color: SHOT_COLORS[(id - 1) % SHOT_COLORS.length], visible: true, result },
      ].slice(-8),
    )
  }, [result, presetId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement
      if (target.closest('input, select, textarea, [contenteditable="true"], [role="slider"]'))
        return
      const onButton = !!target.closest('button')
      switch (e.key) {
        case ' ':
          if (onButton) return
          e.preventDefault()
          playback.toggle()
          break
        case 'f':
        case 'F':
          fire()
          break
        case 'p':
        case 'P':
          pin()
          break
        case 'v':
        case 'V':
          setView((v) => (v === 'side' ? 'top' : 'side'))
          break
        case 'ArrowLeft':
          e.preventDefault()
          playback.nudge(-0.02)
          break
        case 'ArrowRight':
          e.preventDefault()
          playback.nudge(0.02)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fire, pin])

  const viewOptions = useMemo<ViewOptions>(
    () => ({ view, showVacuum, showForces, trueScale, units }),
    [view, showVacuum, showForces, trueScale, units],
  )
  const overlays = useMemo(
    () =>
      shots.filter((s) => s.visible).map((s) => ({ id: s.id, color: s.color, result: s.result })),
    [shots],
  )

  const activeForces = [
    ['Gravity', FORCE_COLORS.gravity, true],
    ['Drag', FORCE_COLORS.drag, result.config.toggles.drag],
    ['Magnus', FORCE_COLORS.magnus, result.config.toggles.magnus],
    ['Coriolis', FORCE_COLORS.coriolis, result.config.toggles.coriolis],
    ['Velocity', FORCE_COLORS.velocity, true],
  ] as const

  return (
    <div className="flex min-h-screen flex-col xl:h-screen">
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-ink-800 bg-ink-950/85 px-4 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="text-[15px] leading-tight font-semibold tracking-tight text-ink-50">
              Cannonball Trajectory Simulator
            </h1>
            <p className="text-[11.5px] leading-tight text-ink-400">
              RK4 ballistics · quadratic drag · wind · Magnus · Coriolis
            </p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <PresetSelector activeId={presetId} onApply={applyPresetById} />
          <Segmented
            label="Unit system"
            value={units}
            onChange={setUnits}
            options={[
              { value: 'metric', label: 'Metric' },
              { value: 'imperial', label: 'Imperial' },
            ]}
          />
          <button
            type="button"
            className="icon-btn"
            onClick={reset}
            aria-label="Reset to defaults"
            title="Reset to defaults"
          >
            <ResetIcon className="size-4" />
          </button>
        </div>
      </header>

      <main className="grid flex-1 grid-cols-1 lg:grid-cols-[20rem_minmax(0,1fr)] xl:min-h-0 xl:grid-cols-[20rem_minmax(0,1fr)_27rem]">
        <aside
          aria-label="Inputs"
          className="border-ink-800 bg-ink-950 lg:border-r xl:min-h-0 xl:overflow-y-auto"
        >
          <ControlPanel config={config} onChange={setConfig} units={units} result={result} />
        </aside>

        <section
          aria-label="Flight view"
          className="order-first flex min-w-0 flex-col gap-3 p-3 lg:order-none xl:min-h-0 xl:overflow-y-auto"
        >
          <div className="panel-card flex flex-col overflow-hidden xl:min-h-[420px] xl:flex-1">
            <div className="flex flex-wrap items-center gap-2 border-b border-ink-800 px-3 py-2">
              <Segmented
                label="View"
                size="sm"
                value={view}
                onChange={setView}
                options={[
                  { value: 'side', label: 'Side view' },
                  { value: 'top', label: 'Top-down' },
                ]}
              />
              <span className="mx-1 hidden h-4 w-px bg-ink-700 sm:block" />
              <ToggleChip
                label="Vacuum overlay"
                active={showVacuum}
                onClick={() => setShowVacuum((v) => !v)}
              />
              <ToggleChip
                label="Force vectors"
                active={showForces}
                onClick={() => setShowForces((v) => !v)}
              />
              <ToggleChip
                label="1:1 scale"
                active={trueScale}
                onClick={() => setTrueScale((v) => !v)}
              />
              <span
                className="ml-auto hidden items-center gap-1.5 text-[11px] text-ink-500 2xl:flex"
                title="Keyboard shortcuts"
              >
                <KeyboardIcon className="size-3.5" />
                <Kbd>Space</Kbd> play <Kbd>F</Kbd> fire <Kbd>P</Kbd> pin <Kbd>V</Kbd> view{' '}
                <Kbd>←→</Kbd> scrub
              </span>
            </div>

            <div className="relative h-[52vh] min-h-[320px] xl:h-auto xl:flex-1">
              <TrajectoryCanvas result={result} shots={overlays} options={viewOptions} />
              {showForces && (
                <div className="pointer-events-none absolute top-[62px] right-[26px] hidden sm:flex flex-wrap gap-x-3 gap-y-1 rounded-md bg-ink-950/70 px-2 py-1 text-[10.5px] text-ink-300 backdrop-blur-sm">
                  {activeForces
                    .filter(([, , on]) => on)
                    .map(([name, color]) => (
                      <span key={name} className="flex items-center gap-1">
                        <span className="h-0.5 w-3 rounded" style={{ background: color }} />
                        {name}
                      </span>
                    ))}
                </div>
              )}
            </div>

            <PlaybackBar onFire={fire} />
          </div>

          <div className="grid items-start gap-3 2xl:grid-cols-[minmax(0,1fr)_17rem]">
            <LiveReadout result={result} units={units} />
            <ImpactMap result={result} aim={aim} shots={shots} units={units} />
          </div>
        </section>

        <aside
          aria-label="Results"
          className="border-t border-ink-800 bg-ink-950 lg:col-span-2 xl:col-span-1 xl:min-h-0 xl:border-t-0 xl:border-l"
        >
          <DataPanel
            config={deferred}
            result={result}
            aim={aim}
            units={units}
            shots={shots}
            onPin={pin}
            onToggleShot={(id) =>
              setShots((list) => list.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s)))
            }
            onRemoveShot={(id) => setShots((list) => list.filter((s) => s.id !== id))}
            onLoadShot={(id) => {
              const shot = shots.find((s) => s.id === id)
              if (shot) {
                fireOnNextResult.current = true
                setConfig(shot.result.config)
              }
            }}
            onClearShots={() => setShots([])}
          />
        </aside>
      </main>
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-ink-700 bg-ink-900 px-1 font-mono text-[10px] text-ink-300">
      {children}
    </kbd>
  )
}

function Logo() {
  return (
    <svg viewBox="0 0 40 40" className="size-9 shrink-0" aria-hidden>
      <defs>
        <radialGradient id="logo-ball" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fae3b4" />
          <stop offset="0.45" stopColor="#d99a3a" />
          <stop offset="1" stopColor="#3a2508" />
        </radialGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="#111827" stroke="#222c40" />
      <path
        d="M6 32 Q 17 4 34 25"
        fill="none"
        stroke="#eab25a"
        strokeWidth="1.6"
        strokeDasharray="2 2.5"
        strokeLinecap="round"
        opacity="0.75"
      />
      <circle cx="27" cy="14" r="6" fill="url(#logo-ball)" />
    </svg>
  )
}
