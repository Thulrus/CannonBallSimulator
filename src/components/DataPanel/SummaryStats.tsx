import { percent } from '../../lib/misc'
import { formatQuantity, type UnitSystem } from '../../lib/units'
import { ballisticCoefficient, optimalBarrelLength } from '../../physics/ballistics'
import type { SimulationResult } from '../../physics/simulate'

interface Stat {
  label: string
  value: string
  sub?: string
  accent?: boolean
}

export function SummaryStats({
  result,
  aim,
  units,
}: {
  result: SimulationResult
  aim: SimulationResult | null
  units: UnitSystem
}) {
  const { summary: s, vacuum: v, config: c, samples } = result
  const fq = formatQuantity.bind(null, units)
  const first = samples[0]
  const last = samples[samples.length - 1]
  const speedOfSound = first.mach > 0 ? first.airspeed / first.mach : 343
  const rangeVsVacuum = v.range > 0 ? s.maxRange / v.range : 1
  const bc = ballisticCoefficient(
    c.projectile.mass,
    c.projectile.diameter,
    c.projectile.dragCoefficient,
  )

  const stats: Stat[] = [
    {
      label: 'Range',
      value: fq('distance', s.maxRange),
      sub: c.toggles.drag
        ? `${percent(rangeVsVacuum, 0)} of vacuum range`
        : 'no drag — matches vacuum',
      accent: true,
    },
    {
      label: 'Apogee',
      value: fq('altitude', s.maxHeight),
      sub: `at t = ${result.apogee.time.toFixed(1)} s`,
      accent: true,
    },
    {
      label: 'Time of flight',
      value: `${s.timeOfFlight.toFixed(2)} s`,
      sub: `vacuum ${v.timeOfFlight.toFixed(1)} s`,
      accent: true,
    },
    {
      label: 'Muzzle velocity',
      value: fq('speed', s.muzzleVelocity),
      sub: `Mach ${(s.muzzleVelocity / speedOfSound).toFixed(2)}`,
    },
    {
      label: 'Impact velocity',
      value: fq('speed', s.impactVelocity),
      sub: `${percent(s.impactVelocity / Math.max(s.muzzleVelocity, 1e-9), 0)} of muzzle`,
    },
    {
      label: 'Impact angle',
      value: `${s.impactAngle.toFixed(1)}°`,
      sub: `launched at ${c.cannon.elevation.toFixed(1)}°`,
    },
    {
      label: 'Lateral drift',
      value: fq('distance', Math.abs(s.lateralDrift)),
      sub:
        Math.abs(s.lateralDrift) < 0.005
          ? 'none'
          : s.lateralDrift > 0
            ? 'right of aim line'
            : 'left of aim line',
    },
    {
      label: 'Energy lost to drag',
      value: percent(s.energyLostToDrag),
      sub: `${fq('energy', first.energy.total - last.energy.total)} dissipated`,
    },
    {
      label: 'Peak Mach',
      value: s.peakMach.toFixed(2),
      sub: s.peakMach >= 1 ? 'supersonic' : 'subsonic',
    },
    {
      label: 'Air density at muzzle',
      value: fq('density', s.launchAirDensity, { digits: 3 }),
      sub:
        c.environment.atmosphereModel === 'idealGas' ? 'ideal gas + humidity' : 'barometric model',
    },
    {
      label: 'Barrel efficiency',
      value: percent(result.muzzle.efficiency),
      sub: `sweet spot ${fq('length', optimalBarrelLength(c.projectile.diameter))}`,
    },
    {
      label: 'Ballistic coefficient',
      value: `${bc.toFixed(0)} kg/m²`,
      sub: `Cd ${c.projectile.dragCoefficient.toFixed(2)}`,
    },
  ]

  const insights: string[] = []
  if (c.toggles.drag && v.range > 0) {
    insights.push(
      `Drag cost this shot ${percent(1 - rangeVsVacuum, 0)} of its vacuum range and ${percent(s.energyLostToDrag, 0)} of its energy.`,
    )
  }
  if (c.toggles.drag && Math.abs(c.cannon.elevation - 45) < 4) {
    insights.push(
      '45° is only the best angle in a vacuum. With drag on, the optimum is lower — run an elevation sweep to find it.',
    )
  }
  if (s.peakMach >= 1) {
    const impactMach = last.mach
    insights.push(
      impactMach < 1
        ? `It left the muzzle at Mach ${s.peakMach.toFixed(2)} and fell back through the sound barrier, landing at Mach ${impactMach.toFixed(2)}.`
        : `Still supersonic at impact (Mach ${impactMach.toFixed(2)}).`,
    )
  }
  if (aim) {
    const dx = s.maxRange - aim.summary.maxRange
    const dz = s.lateralDrift - aim.summary.lateralDrift
    insights.push(
      `Wind, spin and Earth's rotation moved the impact ${fq('distance', Math.hypot(dx, dz))} from the still-air aim point.`,
    )
  }

  return (
    <div className="space-y-4">
      {result.warnings.map((w) => (
        <div
          key={w}
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200"
        >
          {w}
        </div>
      ))}

      <div className="grid grid-cols-2 gap-2">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl border px-3 py-2.5 ${stat.accent ? 'border-brass-600/30 bg-brass-400/[0.04]' : 'border-ink-800 bg-ink-900/60'}`}
          >
            <div className="text-[10px] font-medium tracking-[0.12em] text-ink-400 uppercase">
              {stat.label}
            </div>
            <div
              className={`mt-0.5 font-mono text-[17px] tabular-nums ${stat.accent ? 'text-brass-200' : 'text-ink-50'}`}
            >
              {stat.value}
            </div>
            {stat.sub && <div className="mt-0.5 text-[11px] text-ink-400">{stat.sub}</div>}
          </div>
        ))}
      </div>

      {insights.length > 0 && (
        <div className="rounded-xl border border-ink-800 bg-ink-900/60 p-3">
          <h3 className="mb-1.5 text-[10.5px] font-medium tracking-[0.12em] text-ink-400 uppercase">
            What's going on
          </h3>
          <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-ink-200">
            {insights.map((i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-[7px] size-1 shrink-0 rounded-full bg-brass-400" />
                {i}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
