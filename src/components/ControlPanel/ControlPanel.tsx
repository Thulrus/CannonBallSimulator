import { PROJECTILE_SHAPES, shapeForCd } from '../../data/projectileShapes'
import { PROPELLANTS, propellantById } from '../../data/propellantPresets'
import { FORCE_COLORS } from '../../lib/colors'
import { formatQuantity, type Quantity, type UnitSystem } from '../../lib/units'
import { airStateAt, standardPressureAt } from '../../physics/atmosphere'
import {
  ballisticCoefficient,
  OPTIMAL_CALIBRES,
  optimalBarrelLength,
} from '../../physics/ballistics'
import { GRAVITY_PRESETS, type GravityBody } from '../../physics/constants'
import type { SpinAxis } from '../../physics/forces'
import { buildWorld, type SimulationConfig, type SimulationResult } from '../../physics/simulate'
import { CompassInput, Section, Segmented, Select, Slider, Toggle } from '../ui/controls'
import { BallIcon, BoltIcon, CannonIcon, CloudIcon, PowderIcon, SlidersIcon } from '../ui/icons'

interface Props {
  config: SimulationConfig
  onChange: (config: SimulationConfig) => void
  units: UnitSystem
  result: SimulationResult
}

const GRAVITY_LABELS: Record<GravityBody | 'custom', string> = {
  earth: 'Earth',
  moon: 'Moon',
  mars: 'Mars',
  jupiter: 'Jupiter',
  custom: 'Custom',
}

const COMPASS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
]
const compassPoint = (deg: number) => COMPASS[Math.round(deg / 22.5) % 16]

export function ControlPanel({ config, onChange, units, result }: Props) {
  const { cannon, projectile, propellant, environment: env, toggles, integration } = config

  function set<K extends keyof SimulationConfig>(key: K, patch: Partial<SimulationConfig[K]>) {
    onChange({ ...config, [key]: { ...config[key], ...patch } })
  }
  const fq = (q: Quantity, v: number, digits?: number) => formatQuantity(units, q, v, { digits })

  const optimal = optimalBarrelLength(projectile.diameter)
  const gravityBody =
    (Object.entries(GRAVITY_PRESETS).find(([, g]) => Math.abs(g - env.gravity) < 1e-6)?.[0] as
      GravityBody | undefined) ?? 'custom'
  const air = airStateAt(buildWorld(config).atmosphere, 0)
  const stdPressure = standardPressureAt(env.launchAltitude)
  const bc = ballisticCoefficient(projectile.mass, projectile.diameter, projectile.dragCoefficient)
  const activeForces = Object.values(toggles).filter(Boolean).length

  return (
    <div>
      <Section title="Cannon" icon={<CannonIcon />}>
        <Slider
          label="Elevation"
          value={cannon.elevation}
          onChange={(v) => set('cannon', { elevation: v })}
          min={0}
          max={90}
          step={0.5}
          quantity="angle"
          units={units}
          digits={1}
        />
        <Slider
          label="Azimuth (heading)"
          value={cannon.azimuth}
          onChange={(v) => set('cannon', { azimuth: v })}
          min={0}
          max={359}
          step={1}
          quantity="angle"
          units={units}
          digits={0}
          hint={`Firing ${compassPoint(cannon.azimuth)} — matters for wind and Coriolis`}
        />
        <Slider
          label="Barrel length"
          value={cannon.barrelLength}
          onChange={(v) => set('cannon', { barrelLength: v })}
          min={0.3}
          max={40}
          scale="log"
          quantity="length"
          units={units}
          marker={{ value: optimal, label: 'Most efficient length' }}
          hint={
            <>
              Efficiency{' '}
              <span className="text-ink-200">{(result.muzzle.efficiency * 100).toFixed(1)}%</span> ·{' '}
              <span className="text-emerald-400/90">▍</span>sweet spot {fq('length', optimal)} (
              {OPTIMAL_CALIBRES.toFixed(0)} calibres)
            </>
          }
        />
      </Section>

      <Section title="Projectile" icon={<BallIcon />}>
        <Select
          label="Shape"
          value={shapeForCd(projectile.dragCoefficient)}
          options={PROJECTILE_SHAPES.map((s) => ({
            value: s.id,
            label: s.id === 'custom' ? 'Custom Cd' : `${s.name} — Cd ${s.dragCoefficient}`,
          }))}
          onChange={(id) => {
            const shape = PROJECTILE_SHAPES.find((s) => s.id === id)
            if (shape && id !== 'custom')
              set('projectile', { dragCoefficient: shape.dragCoefficient })
          }}
        />
        <Slider
          label="Drag coefficient (Cd)"
          value={projectile.dragCoefficient}
          onChange={(v) => set('projectile', { dragCoefficient: v })}
          min={0.05}
          max={1.5}
          step={0.01}
          quantity="ratio"
          units={units}
          digits={2}
        />
        <Slider
          label="Mass"
          value={projectile.mass}
          onChange={(v) => set('projectile', { mass: v })}
          min={0.05}
          max={2000}
          scale="log"
          quantity="mass"
          units={units}
        />
        <Slider
          label="Diameter"
          value={projectile.diameter}
          onChange={(v) => set('projectile', { diameter: v })}
          min={0.01}
          max={1}
          scale="log"
          quantity="diameter"
          units={units}
          digits={1}
          hint={`Ballistic coefficient ${bc.toFixed(0)} kg/m² — higher carries further`}
        />
        <Slider
          label="Spin rate"
          value={projectile.spinRpm}
          onChange={(v) => set('projectile', { spinRpm: v })}
          min={0}
          max={12000}
          step={50}
          quantity="rpm"
          units={units}
          digits={0}
          disabled={!toggles.magnus}
          hint={toggles.magnus ? undefined : 'Enable Magnus under Forces to use spin'}
        />
        <div className={toggles.magnus ? '' : 'pointer-events-none opacity-45'}>
          <div className="mb-1 text-[12.5px] text-ink-300">Spin axis</div>
          <Segmented<SpinAxis>
            label="Spin axis"
            size="sm"
            value={projectile.spinAxis}
            onChange={(v) => set('projectile', { spinAxis: v })}
            options={[
              { value: 'backspin', label: 'Backspin' },
              { value: 'topspin', label: 'Topspin' },
              { value: 'sidespinLeft', label: '↺ Left' },
              { value: 'sidespinRight', label: '↻ Right' },
            ]}
          />
        </div>
      </Section>

      <Section title="Propellant" icon={<PowderIcon />}>
        <Select
          label="Type"
          value={propellant.typeId}
          options={PROPELLANTS.map((p) => ({
            value: p.id,
            label: `${p.name} — ${(p.energyDensity / 1e6).toFixed(1)} MJ/kg`,
          }))}
          onChange={(id) => {
            const p = propellantById(id)
            set('propellant', { typeId: p.id, energyDensity: p.energyDensity })
          }}
        />
        <p className="-mt-2 text-[11px] leading-snug text-ink-400">
          {propellantById(propellant.typeId).description}
        </p>
        <Slider
          label="Charge mass"
          value={propellant.chargeMass}
          onChange={(v) => set('propellant', { chargeMass: v })}
          min={0.01}
          max={400}
          scale="log"
          quantity="mass"
          units={units}
          hint={
            <>
              Muzzle velocity{' '}
              <span className="font-mono text-brass-300">
                {fq('speed', result.muzzle.velocity)}
              </span>{' '}
              · {fq('energy', result.muzzle.deliveredEnergy)} of{' '}
              {fq('energy', result.muzzle.chemicalEnergy)} reaches the shot
            </>
          }
        />
      </Section>

      <Section
        title="Forces"
        icon={<BoltIcon />}
        aside={
          <span className="rounded-full bg-ink-800 px-1.5 text-[10.5px] text-ink-300 tabular-nums">
            {activeForces}/4
          </span>
        }
      >
        <p className="text-[11px] leading-snug text-ink-400">
          Gravity is always on. The coloured dots match the force arrows in the flight view.
        </p>
        <Toggle
          label="Quadratic drag"
          description="½ρv²·Cd·A, against the airflow"
          accent={FORCE_COLORS.drag}
          checked={toggles.drag}
          onChange={(v) => set('toggles', { drag: v })}
        />
        <Toggle
          label="Wind"
          description="Shifts the airflow the drag acts against"
          accent={FORCE_COLORS.wind}
          checked={toggles.wind}
          onChange={(v) => set('toggles', { wind: v })}
        />
        <Toggle
          label="Magnus effect"
          description="Lift from spin: S(ω × v)"
          accent={FORCE_COLORS.magnus}
          checked={toggles.magnus}
          onChange={(v) => set('toggles', { magnus: v })}
        />
        <Toggle
          label="Coriolis effect"
          description="Earth's rotation; noticeable past a few km"
          accent={FORCE_COLORS.coriolis}
          checked={toggles.coriolis}
          onChange={(v) => set('toggles', { coriolis: v })}
        />
      </Section>

      <Section title="Environment" icon={<CloudIcon />}>
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <Select
            label="Gravity"
            value={gravityBody}
            options={(Object.keys(GRAVITY_LABELS) as (GravityBody | 'custom')[]).map((b) => ({
              value: b,
              label:
                b === 'custom' ? 'Custom' : `${GRAVITY_LABELS[b]} — ${GRAVITY_PRESETS[b]} m/s²`,
            }))}
            onChange={(b) => b !== 'custom' && set('environment', { gravity: GRAVITY_PRESETS[b] })}
          />
        </div>
        <Slider
          label="Gravitational acceleration"
          value={env.gravity}
          onChange={(v) => set('environment', { gravity: v })}
          min={0.5}
          max={30}
          step={0.01}
          quantity="acceleration"
          units={units}
        />

        <Slider
          label="Wind speed"
          value={env.wind.speed}
          onChange={(v) => set('environment', { wind: { ...env.wind, speed: v } })}
          min={0}
          max={60}
          step={0.5}
          quantity="speed"
          units={units}
          disabled={!toggles.wind}
        />
        <CompassInput
          label="Wind direction"
          value={env.wind.fromDirection}
          onChange={(v) => set('environment', { wind: { ...env.wind, fromDirection: v } })}
          azimuth={cannon.azimuth}
          disabled={!toggles.wind}
        >
          <div className="text-[12.5px] text-ink-300">Wind from</div>
          <div className="font-mono text-[15px] text-ink-50">
            {compassPoint(env.wind.fromDirection)}{' '}
            <span className="text-ink-400">{env.wind.fromDirection}°</span>
          </div>
          <div className="mt-1">
            Drag the dial. <span className="text-sky-300">Arrow</span> = where it blows,{' '}
            <span className="text-brass-400">dashed</span> = your heading.
          </div>
        </CompassInput>

        <div className="flex items-center justify-between">
          <span className="text-[12.5px] text-ink-300">Air density model</span>
          <Segmented
            label="Air density model"
            size="sm"
            value={env.atmosphereModel}
            onChange={(v) => set('environment', { atmosphereModel: v })}
            options={[
              { value: 'idealGas', label: 'Ideal gas' },
              { value: 'barometric', label: 'Barometric' },
            ]}
          />
        </div>
        <Slider
          label="Temperature"
          value={env.temperatureC}
          onChange={(v) => set('environment', { temperatureC: v })}
          min={-40}
          max={50}
          step={0.5}
          quantity="temperature"
          units={units}
          digits={1}
        />
        <Slider
          label="Pressure"
          value={env.pressurePa}
          onChange={(v) => set('environment', { pressurePa: v })}
          min={50000}
          max={108000}
          step={50}
          quantity="pressure"
          units={units}
          disabled={env.atmosphereModel === 'barometric'}
          hint={
            env.atmosphereModel === 'idealGas' && Math.abs(stdPressure - env.pressurePa) > 100 ? (
              <button
                type="button"
                className="text-brass-300 underline decoration-dotted underline-offset-2 hover:text-brass-200"
                onClick={() => set('environment', { pressurePa: Math.round(stdPressure) })}
              >
                Use standard pressure for this altitude (
                {fq('pressure', stdPressure, units === 'metric' ? 0 : 2)})
              </button>
            ) : undefined
          }
        />
        <Slider
          label="Relative humidity"
          value={env.humidity}
          onChange={(v) => set('environment', { humidity: v })}
          min={0}
          max={1}
          step={0.01}
          quantity="percent"
          units={units}
          digits={0}
          disabled={env.atmosphereModel === 'barometric'}
        />
        <Slider
          label="Launch altitude"
          value={env.launchAltitude}
          onChange={(v) => set('environment', { launchAltitude: v })}
          min={0}
          max={5000}
          step={10}
          quantity="altitude"
          units={units}
          digits={0}
        />
        <div className="rounded-lg border border-ink-800 bg-ink-900/60 px-3 py-2 text-[11.5px] text-ink-400">
          Air at the muzzle:{' '}
          <span className="font-mono text-ink-100">{fq('density', air.density, 3)}</span> · speed of
          sound <span className="font-mono text-ink-100">{fq('speed', air.speedOfSound, 0)}</span>
        </div>
        <Slider
          label="Latitude"
          value={env.latitude}
          onChange={(v) => set('environment', { latitude: v })}
          min={-90}
          max={90}
          step={0.5}
          quantity="angle"
          units={units}
          digits={1}
          hint={
            toggles.coriolis
              ? `${Math.abs(env.latitude).toFixed(1)}° ${env.latitude >= 0 ? 'N' : 'S'}`
              : 'Only used by the Coriolis effect'
          }
        />
      </Section>

      <Section title="Integration" icon={<SlidersIcon />} defaultOpen={false}>
        <Slider
          label="RK4 timestep"
          value={integration.timestep}
          onChange={(v) => set('integration', { timestep: v })}
          min={0.0005}
          max={0.02}
          scale="log"
          quantity="time"
          units={units}
          digits={4}
          hint="Smaller is more accurate and slower. 2 ms is plenty for most shots."
        />
        <Slider
          label="Sample interval"
          value={integration.sampleInterval}
          onChange={(v) => set('integration', { sampleInterval: v })}
          min={0.005}
          max={1}
          scale="log"
          quantity="time"
          units={units}
          digits={3}
          hint={`${result.samples.length.toLocaleString()} samples recorded for charts and CSV`}
        />
        <Slider
          label="Max flight time"
          hint="Safety cap on simulated time. Long flights are automatically allowed up to 2.5× their vacuum flight time (at most one hour)."
          value={integration.maxFlightTime}
          onChange={(v) => set('integration', { maxFlightTime: v })}
          min={10}
          max={3000}
          scale="log"
          quantity="time"
          units={units}
          digits={0}
        />
      </Section>
    </div>
  )
}
