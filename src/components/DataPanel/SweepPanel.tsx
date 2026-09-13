import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHART_AXIS, PALETTE, SERIES_COLORS, TOOLTIP_STYLE } from '../../lib/colors'
import {
  displayUnit,
  formatNumber,
  formatQuantity,
  formatTick,
  roundSig,
  type Quantity,
  type UnitSystem,
} from '../../lib/units'
import type { SimulationConfig } from '../../physics/simulate'
import {
  SWEEP_META,
  type SweepDefinition,
  type SweepParameter,
  type SweepPoint,
} from '../../physics/sweep'
import type { SweepRequest, SweepResponse } from '../../workers/sweep.worker'
import { Select, Toggle, NumberField } from '../ui/controls'
import { ChartCard } from './ChartParts'

const PARAM_QUANTITY: Record<SweepParameter, Quantity> = {
  elevation: 'angle',
  chargeMass: 'mass',
  barrelLength: 'length',
  dragCoefficient: 'ratio',
  projectileMass: 'mass',
  diameter: 'diameter',
  windSpeed: 'speed',
  spinRpm: 'rpm',
}

type Metric = 'range' | 'maxHeight' | 'timeOfFlight' | 'impactVelocity' | 'drift'

const METRICS: Record<Metric, { label: string; quantity: Quantity }> = {
  range: { label: 'Range', quantity: 'distance' },
  maxHeight: { label: 'Apogee', quantity: 'altitude' },
  timeOfFlight: { label: 'Time of flight', quantity: 'time' },
  impactVelocity: { label: 'Impact velocity', quantity: 'speed' },
  drift: { label: 'Lateral drift', quantity: 'distance' },
}

function currentValue(config: SimulationConfig, p: SweepParameter): number {
  switch (p) {
    case 'elevation':
      return config.cannon.elevation
    case 'barrelLength':
      return config.cannon.barrelLength
    case 'chargeMass':
      return config.propellant.chargeMass
    case 'dragCoefficient':
      return config.projectile.dragCoefficient
    case 'projectileMass':
      return config.projectile.mass
    case 'diameter':
      return config.projectile.diameter
    case 'windSpeed':
      return config.environment.wind.speed
    case 'spinRpm':
      return config.projectile.spinRpm
  }
}

function defaultRange(config: SimulationConfig, p: SweepParameter): [number, number] {
  switch (p) {
    case 'elevation':
      return [0, 90]
    case 'dragCoefficient':
      return [0.05, 1.2]
    case 'windSpeed':
      return [0, 40]
    case 'spinRpm':
      return [0, 10000]
    default: {
      const v = currentValue(config, p)
      return [roundSig(v * 0.2, 2), roundSig(v * 3, 2)]
    }
  }
}

/** Runs sweeps in a Web Worker so dragging a slider never stalls the animation. */
function useSweepWorker() {
  const workerRef = useRef<Worker | null>(null)
  const latest = useRef(0)
  const [data, setData] = useState<SweepResponse | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const worker = new Worker(new URL('../../workers/sweep.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (e: MessageEvent<SweepResponse>) => {
      if (e.data.id !== latest.current) return
      setData(e.data)
      setRunning(false)
    }
    worker.onerror = (e) => {
      setError(e.message || 'Sweep failed')
      setRunning(false)
    }
    workerRef.current = worker
    return () => worker.terminate()
  }, [])

  const run = useCallback(
    (config: SimulationConfig, definition: SweepDefinition, includeVacuum: boolean) => {
      const id = ++latest.current
      setRunning(true)
      setError(null)
      workerRef.current?.postMessage({
        id,
        config,
        definition,
        includeVacuum,
      } satisfies SweepRequest)
    },
    [],
  )

  return { data, running, error, run }
}

export function SweepPanel({
  config,
  units,
  active,
}: {
  config: SimulationConfig
  units: UnitSystem
  active: boolean
}) {
  const [parameter, setParameter] = useState<SweepParameter>('elevation')
  const [[from, to], setRange] = useState<[number, number]>([0, 90])
  const [steps, setSteps] = useState(46)
  const [metric, setMetric] = useState<Metric>('range')
  const [includeVacuum, setIncludeVacuum] = useState(true)
  const { data, running, error, run } = useSweepWorker()

  useEffect(() => {
    if (!active) return
    const id = window.setTimeout(
      () => run(config, { parameter, from, to, steps }, includeVacuum),
      220,
    )
    return () => window.clearTimeout(id)
  }, [active, config, parameter, from, to, steps, includeVacuum, run])

  const xUnit = displayUnit(units, PARAM_QUANTITY[parameter])
  const current = currentValue(config, parameter)

  const chart = useMemo(() => {
    if (!data || data.result.parameter !== parameter) return null
    const get = (p: SweepPoint) => p[metric]
    const magnitude = Math.max(
      ...data.result.points.map((p) => Math.abs(get(p))),
      ...(data.vacuum?.points ?? []).map((p) => Math.abs(get(p))),
    )
    const yUnit = displayUnit(units, METRICS[metric].quantity, magnitude)
    const rows = data.result.points.map((p, i) => ({
      x: p.value * xUnit.factor + xUnit.offset,
      y: get(p) * yUnit.factor + yUnit.offset,
      vac: data.vacuum ? get(data.vacuum.points[i]) * yUnit.factor + yUnit.offset : undefined,
    }))
    const bestOf = (points: SweepPoint[]) =>
      points.reduce((a, b) => (get(b) > get(a) ? b : a), points[0])
    const best = bestOf(data.result.points)
    const vacBest = data.vacuum ? bestOf(data.vacuum.points) : null
    return { rows, yUnit, best, vacBest }
  }, [data, metric, parameter, units, xUnit.factor, xUnit.offset])

  const meta = SWEEP_META[parameter]

  return (
    <div className="space-y-3">
      <p className="text-[12.5px] leading-relaxed text-ink-300">
        Hold everything else fixed, vary one input, and see how the result responds. Updates live as
        you change the controls.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Vary"
          value={parameter}
          options={(Object.keys(SWEEP_META) as SweepParameter[]).map((p) => ({
            value: p,
            label: SWEEP_META[p].label,
          }))}
          onChange={(p) => {
            setParameter(p)
            setRange(defaultRange(config, p))
          }}
        />
        <Select
          label="Plot"
          value={metric}
          options={(Object.keys(METRICS) as Metric[]).map((m) => ({
            value: m,
            label: METRICS[m].label,
          }))}
          onChange={setMetric}
        />
        <NumberField
          label="From"
          value={from}
          onChange={(v) => setRange([Math.max(v, meta.min), to])}
          quantity={PARAM_QUANTITY[parameter]}
          units={units}
        />
        <NumberField
          label="To"
          value={to}
          onChange={(v) => setRange([from, Math.min(v, meta.max)])}
          quantity={PARAM_QUANTITY[parameter]}
          units={units}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <label className="flex flex-1 items-center gap-2 text-[12px] text-ink-400">
          Steps
          <input
            type="range"
            className="range flex-1"
            min={5}
            max={120}
            value={steps}
            onChange={(e) => setSteps(Number(e.target.value))}
            style={{ '--fill': `${((steps - 5) / 115) * 100}%` } as React.CSSProperties}
          />
          <span className="w-7 text-right font-mono text-ink-200 tabular-nums">{steps}</span>
        </label>
      </div>
      <Toggle
        label="Compare with vacuum"
        description="Same sweep with drag, wind, spin and Coriolis all off"
        checked={includeVacuum}
        onChange={setIncludeVacuum}
      />

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
          {error}
        </p>
      )}

      {active && (
        <ChartCard
          title={`${METRICS[metric].label}${chart ? ` (${chart.yUnit.label})` : ''} vs ${meta.label.toLowerCase()}${xUnit.label ? ` (${xUnit.label})` : ''}`}
          height="h-64"
          legend={[
            { label: 'This configuration', color: SERIES_COLORS.primary },
            ...(includeVacuum
              ? [{ label: 'Vacuum', color: SERIES_COLORS.vacuum, dashed: true }]
              : []),
          ]}
        >
          <div className={`relative h-full transition-opacity ${running ? 'opacity-60' : ''}`}>
            {running && (
              <span className="absolute top-1 right-2 z-10 animate-pulse text-[11px] text-ink-400">
                computing…
              </span>
            )}
            {chart && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart.rows} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={PALETTE.ink700} strokeDasharray="2 4" />
                  <XAxis
                    dataKey="x"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(v: number) => formatTick(v)}
                    {...CHART_AXIS}
                    tickLine={false}
                    axisLine={{ stroke: PALETTE.ink600 }}
                    minTickGap={20}
                  />
                  <YAxis
                    width={50}
                    tickFormatter={(v: number) => formatTick(v)}
                    {...CHART_AXIS}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={{ color: PALETTE.ink300 }}
                    labelFormatter={(l) =>
                      `${meta.label}: ${formatNumber(Number(l))} ${xUnit.label}`
                    }
                    formatter={(v) =>
                      typeof v === 'number' ? `${formatNumber(v)} ${chart.yUnit.label}` : v
                    }
                    isAnimationActive={false}
                  />
                  <ReferenceLine
                    x={current * xUnit.factor + xUnit.offset}
                    stroke={PALETTE.ink300}
                    strokeDasharray="3 3"
                    label={{
                      value: 'current',
                      position: 'insideTopLeft',
                      fill: PALETTE.ink400,
                      fontSize: 10,
                    }}
                  />
                  {includeVacuum && (
                    <Line
                      dataKey="vac"
                      name="Vacuum"
                      stroke={SERIES_COLORS.vacuum}
                      strokeDasharray="5 4"
                      strokeWidth={1.25}
                      dot={false}
                      isAnimationActive={false}
                    />
                  )}
                  <Line
                    dataKey="y"
                    name="This configuration"
                    stroke={SERIES_COLORS.primary}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <ReferenceDot
                    x={chart.best.value * xUnit.factor + xUnit.offset}
                    y={chart.best[metric] * chart.yUnit.factor + chart.yUnit.offset}
                    r={4.5}
                    fill={PALETTE.brassLight}
                    stroke="#07090f"
                    strokeWidth={1.5}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>
      )}

      {chart && (
        <div className="rounded-xl border border-ink-800 bg-ink-900/60 p-3 text-[12.5px] leading-relaxed text-ink-200">
          Maximum {METRICS[metric].label.toLowerCase()}{' '}
          <span className="font-mono text-brass-200">
            {formatQuantity(units, METRICS[metric].quantity, chart.best[metric])}
          </span>{' '}
          at{' '}
          <span className="font-mono text-brass-200">
            {formatQuantity(units, PARAM_QUANTITY[parameter], chart.best.value, {
              magnitude: 0,
              digits: parameter === 'elevation' ? 1 : undefined,
            })}
          </span>
          {chart.vacBest && (
            <>
              {' '}
              — in a vacuum the peak would be at{' '}
              <span className="font-mono text-ink-50">
                {formatQuantity(units, PARAM_QUANTITY[parameter], chart.vacBest.value, {
                  magnitude: 0,
                  digits: parameter === 'elevation' ? 1 : undefined,
                })}
              </span>
              .
            </>
          )}
          {parameter === 'elevation' &&
            metric === 'range' &&
            chart.vacBest &&
            config.toggles.drag && (
              <p className="mt-1.5 text-[11.5px] text-ink-400">
                {chart.best.value < chart.vacBest.value - 1
                  ? 'Drag punishes the long, high flight of a steep shot more than a flat one, pulling the optimum below the textbook 45°.'
                  : chart.best.value > chart.vacBest.value + 1
                    ? 'Here the optimum is above 45°: a steep shot climbs fast into thin high-altitude air where drag nearly vanishes. That is exactly why the Paris Gun fired at around 50°.'
                    : 'Drag and thinning air roughly cancel out here, leaving the optimum close to the vacuum value.'}
              </p>
            )}
        </div>
      )}
    </div>
  )
}
