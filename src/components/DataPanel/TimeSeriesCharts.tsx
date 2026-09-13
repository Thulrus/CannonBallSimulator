import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHART_AXIS, FORCE_COLORS, PALETTE, SERIES_COLORS, TOOLTIP_STYLE } from '../../lib/colors'
import { downsample } from '../../lib/misc'
import { usePlaybackTime } from '../../lib/playback'
import {
  displayUnit,
  formatNumber,
  formatTick,
  type Quantity,
  type UnitSystem,
} from '../../lib/units'
import type { Sample, SimulationResult } from '../../physics/simulate'
import { ChartCard } from './ChartParts'

type Row = Record<string, number>

interface LineDef {
  key: string
  name: string
  color: string
  dashed?: boolean
  axis?: 'left' | 'right'
}

const MAX_POINTS = 360

export function TimeSeriesCharts({
  result,
  units,
}: {
  result: SimulationResult
  units: UnitSystem
}) {
  const cursor = usePlaybackTime(12)
  const { toggles } = result.config

  const data = useMemo(() => {
    const samples = downsample(result.samples, MAX_POINTS)
    const maxOf = (get: (s: Sample) => number) =>
      samples.reduce((m, s) => Math.max(m, Math.abs(get(s))), 0)
    const unitFor = (q: Quantity, get: (s: Sample) => number) => displayUnit(units, q, maxOf(get))

    const u = {
      altitude: unitFor('altitude', (s) => s.position.y),
      downrange: unitFor('distance', (s) => s.downrange),
      speed: displayUnit(units, 'speed'),
      force: unitFor('force', (s) =>
        Math.max(s.forces.dragMagnitude, Math.abs(s.forces.gravity.y)),
      ),
      energy: unitFor('energy', (s) => s.energy.total),
      drift: displayUnit(
        units,
        'distance',
        maxOf((s) => s.drift),
      ),
      density: displayUnit(units, 'density'),
    }

    const rows: Row[] = samples.map((s) => ({
      t: s.t,
      altitude: s.position.y * u.altitude.factor,
      downrange: s.downrange * u.downrange.factor,
      vacuumDownrange:
        ((Math.min(s.t, result.vacuum.timeOfFlight) * result.vacuum.range) /
          Math.max(result.vacuum.timeOfFlight, 1e-9)) *
        u.downrange.factor,
      speed: s.speed * u.speed.factor,
      vx: s.velocity.x * u.speed.factor,
      vy: s.velocity.y * u.speed.factor,
      vz: s.velocity.z * u.speed.factor,
      drag: s.forces.dragMagnitude * u.force.factor,
      magnus: s.forces.magnusMagnitude * u.force.factor,
      coriolis: s.forces.coriolisMagnitude * u.force.factor,
      gravity: Math.abs(s.forces.gravity.y) * u.force.factor,
      ke: s.energy.kinetic * u.energy.factor,
      pe: s.energy.potential * u.energy.factor,
      te: s.energy.total * u.energy.factor,
      drift: s.drift * u.drift.factor,
      mach: s.mach,
      density: s.airDensity * u.density.factor,
    }))
    return { rows, u }
  }, [result, units])

  const { rows, u } = data

  const forceLines: LineDef[] = [
    { key: 'gravity', name: 'Gravity', color: FORCE_COLORS.gravity, dashed: true },
    ...(toggles.drag ? [{ key: 'drag', name: 'Drag', color: FORCE_COLORS.drag }] : []),
    ...(toggles.magnus ? [{ key: 'magnus', name: 'Magnus', color: FORCE_COLORS.magnus }] : []),
    ...(toggles.coriolis
      ? [{ key: 'coriolis', name: 'Coriolis', color: FORCE_COLORS.coriolis }]
      : []),
  ]

  return (
    <div className="space-y-3">
      <ChartCard
        title={`Altitude (${u.altitude.label})`}
        legend={[{ label: 'Altitude', color: SERIES_COLORS.primary }]}
      >
        <SeriesChart
          rows={rows}
          cursor={cursor}
          lines={[{ key: 'altitude', name: 'Altitude', color: SERIES_COLORS.primary }]}
        />
      </ChartCard>

      <ChartCard
        title={`Downrange distance (${u.downrange.label})`}
        legend={[
          { label: 'Actual', color: SERIES_COLORS.secondary },
          { label: 'Vacuum', color: SERIES_COLORS.vacuum, dashed: true },
        ]}
      >
        <SeriesChart
          rows={rows}
          cursor={cursor}
          lines={[
            { key: 'downrange', name: 'Actual', color: SERIES_COLORS.secondary },
            { key: 'vacuumDownrange', name: 'Vacuum', color: SERIES_COLORS.vacuum, dashed: true },
          ]}
        />
      </ChartCard>

      <ChartCard
        title={`Velocity (${u.speed.label})`}
        legend={[
          { label: '|v|', color: SERIES_COLORS.neutral },
          { label: 'vx', color: SERIES_COLORS.secondary },
          { label: 'vy', color: SERIES_COLORS.primary },
          { label: 'vz', color: SERIES_COLORS.tertiary },
        ]}
      >
        <SeriesChart
          rows={rows}
          cursor={cursor}
          zeroLine
          lines={[
            { key: 'speed', name: '|v|', color: SERIES_COLORS.neutral },
            { key: 'vx', name: 'vx', color: SERIES_COLORS.secondary },
            { key: 'vy', name: 'vy', color: SERIES_COLORS.primary },
            { key: 'vz', name: 'vz', color: SERIES_COLORS.tertiary },
          ]}
        />
      </ChartCard>

      <ChartCard
        title={`Forces (${u.force.label})`}
        subtitle="Drag scales with v² — watch it collapse after the muzzle and dip at apogee."
        legend={forceLines.map((l) => ({ label: l.name, color: l.color, dashed: l.dashed }))}
      >
        <SeriesChart rows={rows} cursor={cursor} lines={forceLines} />
      </ChartCard>

      <ChartCard
        title={`Energy (${u.energy.label})`}
        subtitle={
          toggles.drag
            ? 'Total energy bleeds away to drag — in a vacuum it would be a flat line.'
            : 'No drag: total energy stays flat, a check on the integrator.'
        }
        legend={[
          { label: 'Kinetic', color: SERIES_COLORS.secondary },
          { label: 'Potential', color: SERIES_COLORS.primary },
          { label: 'Total', color: SERIES_COLORS.neutral },
        ]}
      >
        <SeriesChart
          rows={rows}
          cursor={cursor}
          lines={[
            { key: 'ke', name: 'Kinetic', color: SERIES_COLORS.secondary },
            { key: 'pe', name: 'Potential', color: SERIES_COLORS.primary },
            { key: 'te', name: 'Total', color: SERIES_COLORS.neutral },
          ]}
        />
      </ChartCard>

      <ChartCard
        title={`Lateral drift (${u.drift.label})`}
        subtitle="Positive is right of the aim line. Wind, Magnus and Coriolis all push sideways."
        legend={[{ label: 'Drift', color: SERIES_COLORS.tertiary }]}
      >
        <SeriesChart
          rows={rows}
          cursor={cursor}
          zeroLine
          lines={[{ key: 'drift', name: 'Drift', color: SERIES_COLORS.tertiary }]}
        />
      </ChartCard>

      <ChartCard
        title="Mach number & air density"
        legend={[
          { label: 'Mach', color: '#f472b6' },
          { label: `Density (${u.density.label})`, color: SERIES_COLORS.quaternary },
        ]}
      >
        <SeriesChart
          rows={rows}
          cursor={cursor}
          dualAxis
          lines={[
            { key: 'mach', name: 'Mach', color: '#f472b6' },
            { key: 'density', name: 'Density', color: SERIES_COLORS.quaternary, axis: 'right' },
          ]}
          referenceY={{ value: 1, label: 'Mach 1' }}
        />
      </ChartCard>
    </div>
  )
}

/** Time-axis ticks: whole seconds past 10 s, one decimal below — never "25.555s". */
const formatSeconds = (v: number) => `${Number(v.toFixed(v >= 10 ? 0 : 1))}s`

function SeriesChart({
  rows,
  lines,
  cursor,
  zeroLine,
  dualAxis,
  referenceY,
}: {
  rows: Row[]
  lines: LineDef[]
  cursor: number
  zeroLine?: boolean
  dualAxis?: boolean
  referenceY?: { value: number; label: string }
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={rows}
        syncId="timeseries"
        margin={{ top: 4, right: dualAxis ? 0 : 8, bottom: 0, left: 0 }}
      >
        <CartesianGrid stroke={PALETTE.ink700} strokeDasharray="2 4" vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          domain={[0, 'dataMax']}
          tickFormatter={formatSeconds}
          {...CHART_AXIS}
          tickLine={false}
          axisLine={{ stroke: PALETTE.ink600 }}
          minTickGap={24}
        />
        <YAxis
          yAxisId="left"
          width={48}
          tickFormatter={(v: number) => formatTick(v)}
          {...CHART_AXIS}
          tickLine={false}
          axisLine={false}
        />
        {dualAxis && (
          <YAxis
            yAxisId="right"
            orientation="right"
            width={44}
            tickFormatter={(v: number) => formatTick(v)}
            {...CHART_AXIS}
            tickLine={false}
            axisLine={false}
          />
        )}
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: PALETTE.ink300, marginBottom: 2 }}
          labelFormatter={(label) => `t = ${Number(label).toFixed(2)} s`}
          formatter={(value) => (typeof value === 'number' ? formatNumber(value) : value)}
          cursor={{ stroke: PALETTE.ink500 }}
          isAnimationActive={false}
        />
        {zeroLine && <ReferenceLine yAxisId="left" y={0} stroke={PALETTE.ink600} />}
        {referenceY && (
          <ReferenceLine
            yAxisId="left"
            y={referenceY.value}
            stroke="#f472b6"
            strokeOpacity={0.35}
            strokeDasharray="4 4"
          />
        )}
        {lines.map((l) => (
          <Line
            key={l.key}
            yAxisId={l.axis ?? 'left'}
            type="monotone"
            dataKey={l.key}
            name={l.name}
            stroke={l.color}
            strokeWidth={l.dashed ? 1.25 : 1.75}
            strokeDasharray={l.dashed ? '4 3' : undefined}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        ))}
        <ReferenceLine
          yAxisId="left"
          x={cursor}
          stroke={PALETTE.brass}
          strokeOpacity={0.7}
          strokeDasharray="3 3"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
