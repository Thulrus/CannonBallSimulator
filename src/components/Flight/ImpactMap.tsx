import { PALETTE } from '../../lib/colors'
import type { PinnedShot } from '../../lib/misc'
import { displayUnit, formatQuantity, type UnitSystem } from '../../lib/units'
import type { SimulationResult } from '../../physics/simulate'
import { niceStep } from '../TrajectoryCanvas/scales'

interface Props {
  result: SimulationResult
  /** The same shot with wind, Magnus and Coriolis switched off; null when those are already off. */
  aim: SimulationResult | null
  shots: PinnedShot[]
  units: UnitSystem
}

const R = 88

/**
 * Top-down impact grid centred on the point-blank aim point. "Up" on the map is
 * downrange (long), right is the shooter's right.
 */
export function ImpactMap({ result, aim, shots, units }: Props) {
  const ref = aim ?? result
  const ax = ref.impact.position.x
  const az = ref.impact.position.z
  const dx = result.impact.position.x - ax
  const dz = result.impact.position.z - az

  if (result.impact.truncated || aim?.impact.truncated) {
    return (
      <div className="panel-card flex flex-col p-3">
        <h3 className="text-[10.5px] font-medium tracking-[0.12em] text-ink-400 uppercase">
          Impact map
        </h3>
        <div className="flex flex-col items-center gap-1 px-2 py-10 text-center">
          <p className="text-[13px] font-medium text-amber-200">No impact yet</p>
          <p className="text-[11.5px] leading-snug text-ink-400">
            The shot was still airborne when the flight-time limit ran out. Raise Max flight time
            under Integration to follow it down.
          </p>
        </div>
      </div>
    )
  }

  // Pick a round ring spacing in *display* units (50 yd, not 45.72 m), then convert back.
  const unit = displayUnit(units, 'distance', Math.hypot(dx, dz) * 4)
  const ringDisplay = niceStep(Math.max(Math.hypot(dx, dz) * 1.15, 4) * unit.factor, 3)
  const ringStep = ringDisplay / unit.factor
  const extent = ringStep * 4
  const map = (offX: number, offZ: number) => {
    const k = R / extent
    let x = offZ * k
    let y = -offX * k
    const r = Math.hypot(x, y)
    const clipped = r > R
    if (clipped) {
      x = (x / r) * R
      y = (y / r) * R
    }
    return { x, y, clipped }
  }

  const here = map(dx, dz)
  const pins = shots
    .filter((s) => s.visible)
    .map((s) => ({
      shot: s,
      ...map(s.result.impact.position.x - ax, s.result.impact.position.z - az),
    }))

  const miss = Math.hypot(dx, dz)

  return (
    <div className="panel-card flex flex-col p-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[10.5px] font-medium tracking-[0.12em] text-ink-400 uppercase">
          Impact map
        </h3>
        <span className="text-[10.5px] text-ink-500">
          rings every {Number(ringDisplay.toPrecision(3)).toLocaleString('en-US')} {unit.label}
        </span>
      </div>
      <svg
        viewBox="-100 -100 200 200"
        className="mx-auto my-2 aspect-square w-full max-w-[13rem]"
        role="img"
        aria-label="Impact position relative to aim point"
      >
        <defs>
          <radialGradient id="impact-bg">
            <stop offset="0" stopColor="#111a2c" />
            <stop offset="1" stopColor="#0a0f1a" />
          </radialGradient>
        </defs>
        <circle r={R} fill="url(#impact-bg)" stroke={PALETTE.ink700} />
        {[1, 2, 3].map((i) => (
          <circle
            key={i}
            r={(R * i) / 4}
            fill="none"
            stroke={PALETTE.ink700}
            strokeDasharray="2 3"
          />
        ))}
        <line x1={-R} x2={R} stroke={PALETTE.ink700} />
        <line y1={-R} y2={R} stroke={PALETTE.ink700} />
        <text y={-R - 3} textAnchor="middle" fontSize="8" fill={PALETTE.ink500}>
          long
        </text>
        <text y={R + 9} textAnchor="middle" fontSize="8" fill={PALETTE.ink500}>
          short
        </text>
        <text x={R + 3} y={3} fontSize="8" fill={PALETTE.ink500}>
          R
        </text>
        <text x={-R - 3} y={3} textAnchor="end" fontSize="8" fill={PALETTE.ink500}>
          L
        </text>

        <circle r="5" fill="none" stroke={PALETTE.brass} strokeWidth="1.2" />
        <circle r="1.5" fill={PALETTE.brass} />

        {pins.map(({ shot, x, y, clipped }) => (
          <circle
            key={shot.id}
            cx={x}
            cy={y}
            r={3.5}
            fill={shot.color}
            opacity={clipped ? 0.4 : 0.9}
          />
        ))}

        <line
          x1={0}
          y1={0}
          x2={here.x}
          y2={here.y}
          stroke={PALETTE.brassLight}
          strokeOpacity="0.4"
          strokeDasharray="2 2"
        />
        <circle
          cx={here.x}
          cy={here.y}
          r={4}
          fill={PALETTE.brassLight}
          className="animate-ping-soft"
        />
        <circle
          cx={here.x}
          cy={here.y}
          r={4.5}
          fill={PALETTE.brassLight}
          stroke="#07090f"
          strokeWidth="1.5"
        />
      </svg>
      <p className="text-center font-mono text-[12px] text-ink-100 tabular-nums">
        {miss < 0.005
          ? 'On the aim point'
          : `${formatQuantity(units, 'distance', Math.abs(dx))} ${dx >= 0 ? 'long' : 'short'} · ${formatQuantity(units, 'distance', Math.abs(dz))} ${dz >= 0 ? 'right' : 'left'}`}
      </p>
      <p className="mt-1 text-center text-[10.5px] leading-snug text-ink-500">
        {aim
          ? 'Aim point: same shot without wind, spin or Earth rotation'
          : 'Wind, Magnus and Coriolis are off'}
      </p>
    </div>
  )
}
