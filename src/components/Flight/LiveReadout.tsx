import { useMemo } from 'react'
import { FORCE_COLORS } from '../../lib/colors'
import { usePlaybackTime } from '../../lib/playback'
import { formatQuantity, type UnitSystem } from '../../lib/units'
import { sampleAt, type SimulationResult } from '../../physics/simulate'

/** Gauges that follow the playhead, plus a live energy-budget bar. */
export function LiveReadout({ result, units }: { result: SimulationResult; units: UnitSystem }) {
  const time = usePlaybackTime(24)
  const s = useMemo(() => sampleAt(result, time), [result, time])
  const { toggles } = result.config
  const lateral = toggles.wind || toggles.magnus || toggles.coriolis

  const items: [string, string][] = [
    ['Time', `${s.t.toFixed(2)} s`],
    ['Altitude', formatQuantity(units, 'altitude', s.position.y)],
    ['Downrange', formatQuantity(units, 'distance', s.downrange)],
    ['Speed', formatQuantity(units, 'speed', s.speed)],
    ['Mach', s.mach.toFixed(2)],
    ['Drag force', formatQuantity(units, 'force', s.forces.dragMagnitude)],
    ['Kinetic energy', formatQuantity(units, 'energy', s.energy.kinetic)],
    lateral
      ? ['Lateral drift', formatQuantity(units, 'distance', s.drift)]
      : ['Air density', formatQuantity(units, 'density', s.airDensity, { digits: 3 })],
  ]

  const e0 = result.samples[0].energy.total
  const ke = e0 > 0 ? s.energy.kinetic / e0 : 0
  const pe = e0 > 0 ? Math.max(s.energy.potential, 0) / e0 : 0
  const lost = Math.max(1 - ke - pe, 0)

  return (
    <div className="panel-card overflow-hidden">
      <div className="grid grid-cols-2 gap-px bg-ink-800/70 sm:grid-cols-4">
        {items.map(([k, v]) => (
          <div key={k} className="bg-ink-900 px-3 py-2">
            <div className="text-[10px] font-medium tracking-[0.12em] text-ink-400 uppercase">
              {k}
            </div>
            <div className="mt-0.5 truncate font-mono text-[14px] text-ink-50 tabular-nums">
              {v}
            </div>
          </div>
        ))}
      </div>
      <div className="px-3 py-2.5">
        <div className="mb-1.5 flex items-center justify-between text-[10.5px] text-ink-400">
          <span className="font-medium tracking-[0.12em] uppercase">Energy budget</span>
          <span className="flex gap-3">
            <Legend color={FORCE_COLORS.velocity} label={`Kinetic ${(ke * 100).toFixed(0)}%`} />
            <Legend color="#eab25a" label={`Potential ${(pe * 100).toFixed(0)}%`} />
            <Legend color={FORCE_COLORS.drag} label={`Lost to drag ${(lost * 100).toFixed(0)}%`} />
          </span>
        </div>
        <div
          className="flex h-2 overflow-hidden rounded-full bg-ink-800"
          role="img"
          aria-label="Energy budget"
        >
          <div style={{ width: `${ke * 100}%`, background: FORCE_COLORS.velocity }} />
          <div style={{ width: `${pe * 100}%`, background: '#eab25a' }} />
          <div style={{ width: `${lost * 100}%`, background: FORCE_COLORS.drag, opacity: 0.75 }} />
        </div>
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="hidden items-center gap-1 tabular-nums sm:flex">
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}
