import { muzzleVelocity } from './ballistics'
import { simulate, vacuumReference, type SimulationConfig } from './simulate'

/** Inputs that the sensitivity sweep can vary. */
export type SweepParameter =
  | 'elevation'
  | 'chargeMass'
  | 'barrelLength'
  | 'dragCoefficient'
  | 'projectileMass'
  | 'diameter'
  | 'windSpeed'
  | 'spinRpm'

export interface SweepDefinition {
  parameter: SweepParameter
  from: number
  to: number
  steps: number
}

export interface SweepPoint {
  value: number
  range: number
  maxHeight: number
  timeOfFlight: number
  impactVelocity: number
  impactAngle: number
  drift: number
}

export interface SweepResult {
  parameter: SweepParameter
  points: SweepPoint[]
  /** The point with the greatest range — the answer to "what's optimal?". */
  best: SweepPoint
}

export const SWEEP_META: Record<
  SweepParameter,
  { label: string; unit: string; min: number; max: number }
> = {
  elevation: { label: 'Elevation angle', unit: '°', min: 0, max: 90 },
  chargeMass: { label: 'Charge mass', unit: 'kg', min: 0, max: 100 },
  barrelLength: { label: 'Barrel length', unit: 'm', min: 0.2, max: 20 },
  dragCoefficient: { label: 'Drag coefficient', unit: '', min: 0, max: 2 },
  projectileMass: { label: 'Projectile mass', unit: 'kg', min: 0.1, max: 2000 },
  diameter: { label: 'Diameter', unit: 'm', min: 0.005, max: 1 },
  windSpeed: { label: 'Wind speed', unit: 'm/s', min: 0, max: 60 },
  spinRpm: { label: 'Spin rate', unit: 'rpm', min: 0, max: 20000 },
}

/** Produce a copy of `config` with one swept parameter replaced. */
export function withParameter(
  config: SimulationConfig,
  parameter: SweepParameter,
  value: number,
): SimulationConfig {
  switch (parameter) {
    case 'elevation':
      return { ...config, cannon: { ...config.cannon, elevation: value } }
    case 'barrelLength':
      return { ...config, cannon: { ...config.cannon, barrelLength: value } }
    case 'chargeMass':
      return { ...config, propellant: { ...config.propellant, chargeMass: value } }
    case 'dragCoefficient':
      return { ...config, projectile: { ...config.projectile, dragCoefficient: value } }
    case 'projectileMass':
      return { ...config, projectile: { ...config.projectile, mass: value } }
    case 'diameter':
      return { ...config, projectile: { ...config.projectile, diameter: value } }
    case 'spinRpm':
      return { ...config, projectile: { ...config.projectile, spinRpm: value } }
    case 'windSpeed':
      return {
        ...config,
        environment: {
          ...config.environment,
          wind: { ...config.environment.wind, speed: value },
        },
      }
  }
}

/**
 * Hold everything fixed, walk one input across a range, and report the resulting
 * flight metrics. The classic payoff: sweep elevation with drag on and the optimum
 * sits well below 45°.
 *
 * Sweeps trade a little precision for speed: each flight's step is scaled to its
 * own (vacuum-estimated) duration, so a 6-second field-gun shot and a 6-minute
 * lunar lob both take roughly a thousand RK4 steps rather than hundreds of thousands.
 */
export function runSweep(base: SimulationConfig, definition: SweepDefinition): SweepResult {
  const steps = Math.max(2, Math.min(Math.round(definition.steps), 240))
  const points: SweepPoint[] = []

  for (let i = 0; i < steps; i++) {
    const value = definition.from + ((definition.to - definition.from) * i) / (steps - 1)
    const config = withParameter(base, definition.parameter, value)
    const muzzle = muzzleVelocity({
      chargeMass: config.propellant.chargeMass,
      energyDensity: config.propellant.energyDensity,
      barrelLength: config.cannon.barrelLength,
      boreDiameter: config.projectile.diameter,
      projectileMass: config.projectile.mass,
    })
    const estimate = vacuumReference(
      muzzle.velocity,
      config.cannon.elevation,
      config.environment.gravity,
    )
    const timestep = Math.max(base.integration.timestep, 0.004, estimate.timeOfFlight / 1500)
    const { summary } = simulate({
      ...config,
      integration: {
        ...config.integration,
        timestep,
        sampleInterval: Math.max(config.integration.sampleInterval, timestep * 8),
      },
    })
    points.push({
      value,
      range: summary.maxRange,
      maxHeight: summary.maxHeight,
      timeOfFlight: summary.timeOfFlight,
      impactVelocity: summary.impactVelocity,
      impactAngle: summary.impactAngle,
      drift: summary.lateralDrift,
    })
  }

  const best = points.reduce((a, b) => (b.range > a.range ? b : a), points[0])
  return { parameter: definition.parameter, points, best }
}
