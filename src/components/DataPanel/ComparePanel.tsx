import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHART_AXIS, PALETTE, TOOLTIP_STYLE } from '../../lib/colors'
import { downsample, type PinnedShot } from '../../lib/misc'
import {
  displayUnit,
  formatNumber,
  formatQuantity,
  formatTick,
  type UnitSystem,
} from '../../lib/units'
import type { SimulationResult } from '../../physics/simulate'
import { niceStep } from '../TrajectoryCanvas/scales'
import { EyeIcon, EyeOffIcon, PinIcon, TrashIcon, UploadIcon } from '../ui/icons'
import { ChartCard, EmptyState } from './ChartParts'

interface Props {
  result: SimulationResult
  shots: PinnedShot[]
  units: UnitSystem
  onPin: () => void
  onToggle: (id: number) => void
  onRemove: (id: number) => void
  onLoad: (id: number) => void
  onClear: () => void
}

export function ComparePanel({
  result,
  shots,
  units,
  onPin,
  onToggle,
  onRemove,
  onLoad,
  onClear,
}: Props) {
  const visible = shots.filter((s) => s.visible)
  const all = [{ id: 0, label: 'Current', color: PALETTE.brass, result }, ...visible]
  const maxRange = Math.max(...all.map((s) => s.result.summary.maxRange))
  const maxHeight = Math.max(...all.map((s) => s.result.summary.maxHeight))
  const xUnit = displayUnit(units, 'distance', maxRange)
  const yUnit = displayUnit(units, 'altitude', maxHeight)

  const xMax = niceCeil(maxRange * xUnit.factor)
  const series = all.map((s) => ({
    ...s,
    points: downsample(s.result.samples, 240).map((p) => ({
      x: p.downrange * xUnit.factor,
      y: p.position.y * yUnit.factor,
    })),
  }))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn" onClick={onPin}>
          <PinIcon className="size-3.5" /> Pin current shot{' '}
          <kbd className="rounded bg-ink-800 px-1 font-mono text-[10px] text-ink-400">P</kbd>
        </button>
        {shots.length > 0 && (
          <button type="button" className="btn ml-auto" onClick={onClear}>
            Clear all
          </button>
        )}
      </div>

      {shots.length === 0 ? (
        <EmptyState title="No pinned shots yet">
          Pin a shot, change something — elevation, charge, a preset — and pin again. Pinned
          trajectories stay on the flight view and the impact map.
        </EmptyState>
      ) : (
        <>
          <ChartCard
            title={`Trajectories — altitude (${yUnit.label}) vs downrange (${xUnit.label})`}
            height="h-56"
            legend={all.map((s) => ({ label: s.label, color: s.color }))}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={PALETTE.ink700} strokeDasharray="2 4" />
                <XAxis
                  dataKey="x"
                  type="number"
                  domain={[0, xMax]}
                  tickFormatter={(v: number) => formatTick(v)}
                  {...CHART_AXIS}
                  tickLine={false}
                  axisLine={{ stroke: PALETTE.ink600 }}
                  allowDuplicatedCategory={false}
                />
                <YAxis
                  dataKey="y"
                  type="number"
                  width={48}
                  tickFormatter={(v: number) => formatTick(v)}
                  {...CHART_AXIS}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(l) => `${formatNumber(Number(l))} ${xUnit.label} downrange`}
                  formatter={(v) =>
                    typeof v === 'number' ? `${formatNumber(v)} ${yUnit.label}` : v
                  }
                  isAnimationActive={false}
                />
                {series.map((s) => (
                  <Line
                    key={s.id}
                    data={s.points}
                    dataKey="y"
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={s.id === 0 ? 2 : 1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="overflow-x-auto rounded-xl border border-ink-800">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-ink-800 text-left text-[10.5px] tracking-wider text-ink-400 uppercase">
                  <th className="px-3 py-2 font-medium">Shot</th>
                  <th className="px-2 py-2 text-right font-medium">Range</th>
                  <th className="px-2 py-2 text-right font-medium">Apogee</th>
                  <th className="px-3 py-2 text-right font-medium">Drift</th>
                </tr>
              </thead>
              <tbody className="font-mono whitespace-nowrap tabular-nums">
                <Row
                  color={PALETTE.brass}
                  label="Current (live)"
                  result={result}
                  base={result}
                  units={units}
                />
                {shots.map((s) => (
                  <Row
                    key={s.id}
                    color={s.color}
                    label={s.label}
                    result={s.result}
                    base={result}
                    units={units}
                    dim={!s.visible}
                    actions={
                      <>
                        <IconAction
                          label={s.visible ? 'Hide' : 'Show'}
                          onClick={() => onToggle(s.id)}
                        >
                          {s.visible ? (
                            <EyeIcon className="size-3.5" />
                          ) : (
                            <EyeOffIcon className="size-3.5" />
                          )}
                        </IconAction>
                        <IconAction label="Load this configuration" onClick={() => onLoad(s.id)}>
                          <UploadIcon className="size-3.5" />
                        </IconAction>
                        <IconAction label="Remove" onClick={() => onRemove(s.id)}>
                          <TrashIcon className="size-3.5" />
                        </IconAction>
                      </>
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function Row({
  color,
  label,
  result,
  base,
  units,
  dim,
  actions,
}: {
  color: string
  label: string
  result: SimulationResult
  base: SimulationResult
  units: UnitSystem
  dim?: boolean
  actions?: React.ReactNode
}) {
  const s = result.summary
  const delta = s.maxRange - base.summary.maxRange
  return (
    <tr className="border-b border-ink-800/70 align-top last:border-0">
      <td className="px-3 py-2 font-sans">
        <div className={`flex items-center gap-2 text-ink-100 ${dim ? 'opacity-45' : ''}`}>
          <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
          <span className="max-w-[9rem] truncate">{label}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-0.5 pl-4 text-[10.5px] text-ink-400">
          <span className={`mr-1 font-mono ${dim ? 'opacity-45' : ''}`}>
            {s.timeOfFlight.toFixed(1)} s
          </span>
          {actions}
        </div>
      </td>
      <td className={`px-2 py-2 text-right text-ink-50 ${dim ? 'opacity-45' : ''}`}>
        {formatQuantity(units, 'distance', s.maxRange)}
        {result !== base && Math.abs(delta) > 0.5 && (
          <div className={`text-[10.5px] ${delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {delta > 0 ? '+' : '−'}
            {formatQuantity(units, 'distance', Math.abs(delta))}
          </div>
        )}
      </td>
      <td className={`px-2 py-2 text-right text-ink-200 ${dim ? 'opacity-45' : ''}`}>
        {formatQuantity(units, 'altitude', s.maxHeight)}
      </td>
      <td className={`px-3 py-2 text-right text-ink-200 ${dim ? 'opacity-45' : ''}`}>
        {formatQuantity(units, 'distance', s.lateralDrift)}
      </td>
    </tr>
  )
}

const niceCeil = (v: number) => {
  const step = niceStep(v, 4)
  return Math.ceil(v / step) * step
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded p-1 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
    >
      {children}
    </button>
  )
}
