import type { AtmosphereConfig, AtmosphereModel } from './atmosphere'
import { crossSectionalArea, muzzleVelocity, type MuzzleResult } from './ballistics'
import {
  computeForces,
  earthRotationVector,
  spinVector,
  windVector,
  type ForceBreakdown,
  type ProjectileConfig,
  type WindConfig,
  type WorldConfig,
} from './forces'
import { rk4Step, type State } from './integrator'
import { DEG, length, lerp, scale, sub, vec, ZERO, type Vec3 } from './vec3'

export interface CannonConfig {
  /** Elevation above horizontal, degrees. */
  elevation: number
  /** Heading, degrees clockwise from north. */
  azimuth: number
  /** Barrel length, m. */
  barrelLength: number
}

export interface PropellantConfig {
  /** Preset id, for display only. */
  typeId: string
  /** Charge mass, kg. */
  chargeMass: number
  /** Energy density, J/kg. */
  energyDensity: number
}

export interface EnvironmentConfig {
  gravity: number
  latitude: number
  atmosphereModel: AtmosphereModel
  launchAltitude: number
  temperatureC: number
  pressurePa: number
  /** Relative humidity, 0–1. */
  humidity: number
  wind: WindConfig
}

export interface Toggles {
  drag: boolean
  wind: boolean
  magnus: boolean
  coriolis: boolean
}

export interface IntegrationConfig {
  /** Fixed RK4 step, s. */
  timestep: number
  /** Minimum spacing between recorded samples, s. */
  sampleInterval: number
  /** Abort the flight after this long, s. */
  maxFlightTime: number
}

export interface SimulationConfig {
  cannon: CannonConfig
  projectile: ProjectileConfig
  propellant: PropellantConfig
  environment: EnvironmentConfig
  toggles: Toggles
  integration: IntegrationConfig
}

export interface Sample {
  /** Time since muzzle exit, s. */
  t: number
  position: Vec3
  velocity: Vec3
  /** Speed over the ground, m/s. */
  speed: number
  /** Speed relative to the air, m/s. */
  airspeed: number
  mach: number
  airDensity: number
  altitudeASL: number
  /** Downrange distance along the firing azimuth, m. */
  downrange: number
  /** Lateral drift, m (positive = right of the aim line). */
  drift: number
  forces: {
    gravity: Vec3
    drag: Vec3
    magnus: Vec3
    coriolis: Vec3
    dragMagnitude: number
    magnusMagnitude: number
    coriolisMagnitude: number
  }
  energy: {
    kinetic: number
    potential: number
    total: number
  }
}

export interface ImpactInfo {
  time: number
  position: Vec3
  velocity: Vec3
  speed: number
  /** Descent angle below horizontal at impact, degrees. */
  angle: number
  /** Straight-line ground distance from the muzzle, m. */
  groundDistance: number
  /** True when the flight-time limit ran out before the shot reached the ground. */
  truncated: boolean
}

export interface Apogee {
  time: number
  altitude: number
  downrange: number
  speed: number
}

export interface VacuumReference {
  /** Analytic no-drag range, m. */
  range: number
  maxHeight: number
  timeOfFlight: number
  /** Sampled parabola for overlaying on the trajectory plot. */
  path: { x: number; y: number }[]
}

export interface SimulationSummary {
  muzzleVelocity: number
  maxRange: number
  maxHeight: number
  timeOfFlight: number
  impactVelocity: number
  impactAngle: number
  lateralDrift: number
  /** Fraction of muzzle kinetic energy lost to drag over the flight, 0–1. */
  energyLostToDrag: number
  /** Air density at the muzzle, kg/m³. */
  launchAirDensity: number
  /** Peak Mach number reached. */
  peakMach: number
}

export interface SimulationResult {
  config: SimulationConfig
  muzzle: MuzzleResult
  samples: Sample[]
  impact: ImpactInfo
  apogee: Apogee
  vacuum: VacuumReference
  summary: SimulationSummary
  warnings: string[]
}

/** Assemble the force-model view of a configuration. */
export function buildWorld(config: SimulationConfig): WorldConfig {
  const env = config.environment
  const atmosphere: AtmosphereConfig = {
    model: env.atmosphereModel,
    launchAltitude: env.launchAltitude,
    temperatureC: env.temperatureC,
    pressurePa: env.pressurePa,
    humidity: env.humidity,
  }
  return {
    gravity: env.gravity,
    azimuth: config.cannon.azimuth,
    latitude: env.latitude,
    atmosphere,
    wind: env.wind,
    enableDrag: config.toggles.drag,
    enableWind: config.toggles.wind,
    enableMagnus: config.toggles.magnus,
    enableCoriolis: config.toggles.coriolis,
  }
}

/** Hard ceiling on the automatically extended flight-time limit, s. */
export const AUTO_FLIGHT_TIME_CAP = 3600

/** Initial velocity vector at muzzle exit, m/s. */
export function launchVelocity(speed: number, elevationDeg: number): Vec3 {
  const el = elevationDeg * DEG
  return vec(speed * Math.cos(el), speed * Math.sin(el), 0)
}

/**
 * Run a full flight and return the time series plus headline metrics.
 *
 * The integrator runs at a fixed small step for accuracy, but samples are only
 * recorded every `sampleInterval` so a 60-second mortar shot doesn't produce
 * 60,000 chart points. The impact sample is always included, interpolated between
 * the two steps that straddle the ground rather than snapped to whichever step
 * happened to land below zero.
 */
export function simulate(config: SimulationConfig): SimulationResult {
  const warnings: string[] = []
  const world = buildWorld(config)
  const { projectile } = config

  const muzzle = muzzleVelocity({
    chargeMass: config.propellant.chargeMass,
    energyDensity: config.propellant.energyDensity,
    barrelLength: config.cannon.barrelLength,
    boreDiameter: projectile.diameter,
    projectileMass: projectile.mass,
  })

  const precomputed = {
    wind: world.enableWind ? windVector(world.wind, world.azimuth) : ZERO,
    omega: earthRotationVector(world.latitude, world.azimuth),
    spin: spinVector(projectile),
    area: crossSectionalArea(projectile.diameter),
  }

  const accel = (_t: number, state: State): Vec3 => {
    const f = computeForces(state.position, state.velocity, projectile, world, precomputed)
    return scale(f.total, 1 / projectile.mass)
  }

  const dt = clamp(config.integration.timestep, 1e-5, 0.05)
  // The configured limit is a floor, not a trap. A light shell on a big charge can
  // legitimately stay up for many minutes, and cutting it off mid-air used to report
  // the cut-off point as the "impact". Allow at least 2.5× the vacuum flight time —
  // drag almost always shortens a flight — up to a hard safety cap.
  const vacuum = vacuumReference(muzzle.velocity, config.cannon.elevation, world.gravity)
  const maxT = Math.max(
    config.integration.maxFlightTime,
    Math.min(vacuum.timeOfFlight * 2.5, AUTO_FLIGHT_TIME_CAP),
  )
  const sampleInterval = Math.max(config.integration.sampleInterval, dt)

  let state: State = {
    position: ZERO,
    velocity: launchVelocity(muzzle.velocity, config.cannon.elevation),
  }
  let t = 0

  const samples: Sample[] = [makeSample(0, state, projectile, world, precomputed)]
  let nextSampleAt = sampleInterval
  let peakMach = samples[0].mach

  let impact: ImpactInfo | null = null
  let prev = state
  let prevT = 0

  while (t < maxT) {
    prev = state
    prevT = t
    state = rk4Step(t, state, dt, accel)
    t += dt

    // The shot has crossed the ground plane somewhere inside this step.
    if (state.position.y <= 0 && t > dt) {
      const span = state.position.y - prev.position.y
      const frac = span === 0 ? 0 : clamp(-prev.position.y / span, 0, 1)
      const hitState: State = {
        position: lerp(prev.position, state.position, frac),
        velocity: lerp(prev.velocity, state.velocity, frac),
      }
      const hitT = prevT + frac * dt
      hitState.position.y = 0
      const sample = makeSample(hitT, hitState, projectile, world, precomputed)
      samples.push(sample)
      peakMach = Math.max(peakMach, sample.mach)
      impact = {
        time: hitT,
        position: hitState.position,
        velocity: hitState.velocity,
        speed: length(hitState.velocity),
        angle:
          (Math.atan2(-hitState.velocity.y, Math.hypot(hitState.velocity.x, hitState.velocity.z)) *
            180) /
          Math.PI,
        groundDistance: Math.hypot(hitState.position.x, hitState.position.z),
        truncated: false,
      }
      break
    }

    if (t >= nextSampleAt) {
      const sample = makeSample(t, state, projectile, world, precomputed)
      samples.push(sample)
      peakMach = Math.max(peakMach, sample.mach)
      nextSampleAt += sampleInterval
    }
  }

  if (!impact) {
    warnings.push(
      `Still airborne after ${Math.round(maxT)} s, so there is no impact point. Raise Max flight time under Integration to follow it down.`,
    )
    const last = samples[samples.length - 1]
    impact = {
      time: last.t,
      position: last.position,
      velocity: last.velocity,
      speed: last.speed,
      angle:
        (Math.atan2(-last.velocity.y, Math.hypot(last.velocity.x, last.velocity.z)) * 180) /
        Math.PI,
      groundDistance: Math.hypot(last.position.x, last.position.z),
      truncated: true,
    }
  }

  if (muzzle.velocity === 0) {
    warnings.push('No propellant energy delivered — increase the charge mass or barrel length.')
  }
  if (muzzle.velocity > 2500) {
    warnings.push(
      `A muzzle velocity of ${Math.round(muzzle.velocity)} m/s is beyond any real powder gun (about 2 km/s). The energy model has no gas-expansion limit, so treat this as a thought experiment.`,
    )
  }

  const apogee = findApogee(samples)
  if (apogee.altitude > 100_000 || impact.groundDistance > 500_000) {
    warnings.push(
      'This shot is outside the flat-Earth, constant-gravity model: above ~100 km or beyond a few hundred km of range, the real Earth curves away beneath it and gravity weakens.',
    )
  }

  const launchKE = samples[0].energy.kinetic
  const impactSample = samples[samples.length - 1]
  const summary: SimulationSummary = {
    muzzleVelocity: muzzle.velocity,
    maxRange: impact.groundDistance,
    maxHeight: apogee.altitude,
    timeOfFlight: impact.time,
    impactVelocity: impact.speed,
    impactAngle: impact.angle,
    lateralDrift: impact.position.z,
    energyLostToDrag:
      launchKE > 0 ? clamp(1 - impactSample.energy.total / samples[0].energy.total, 0, 1) : 0,
    launchAirDensity: samples[0].airDensity,
    peakMach,
  }

  return { config, muzzle, samples, impact, apogee, vacuum, summary, warnings }
}

function makeSample(
  t: number,
  state: State,
  projectile: ProjectileConfig,
  world: WorldConfig,
  precomputed: Parameters<typeof computeForces>[4],
): Sample {
  const f: ForceBreakdown = computeForces(
    state.position,
    state.velocity,
    projectile,
    world,
    precomputed,
  )
  const speed = length(state.velocity)
  const airspeed = length(f.relativeVelocity)
  return {
    t,
    position: state.position,
    velocity: state.velocity,
    speed,
    airspeed,
    mach: airspeed / f.air.speedOfSound,
    airDensity: f.air.density,
    altitudeASL: f.air.altitudeASL,
    downrange: state.position.x,
    drift: state.position.z,
    forces: {
      gravity: f.gravity,
      drag: f.drag,
      magnus: f.magnus,
      coriolis: f.coriolis,
      dragMagnitude: length(f.drag),
      magnusMagnitude: length(f.magnus),
      coriolisMagnitude: length(f.coriolis),
    },
    energy: {
      kinetic: 0.5 * projectile.mass * speed * speed,
      potential: projectile.mass * world.gravity * state.position.y,
      total:
        0.5 * projectile.mass * speed * speed + projectile.mass * world.gravity * state.position.y,
    },
  }
}

/**
 * Apogee refined by a parabolic fit through the three samples around the peak, so
 * it doesn't quantise to the sampling interval.
 */
function findApogee(samples: Sample[]): Apogee {
  let best = 0
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].position.y > samples[best].position.y) best = i
  }
  const peak = samples[best]
  const fallback: Apogee = {
    time: peak.t,
    altitude: peak.position.y,
    downrange: peak.downrange,
    speed: peak.speed,
  }
  if (best === 0 || best === samples.length - 1) return fallback

  const a = samples[best - 1]
  const c = samples[best + 1]
  const denom = a.position.y - 2 * peak.position.y + c.position.y
  // denom >= 0 means the three points aren't concave-down, so there is no interior peak.
  if (denom >= 0) return fallback

  // Standard three-point parabolic peak interpolation; `shift` is in units of the
  // sample spacing and is always within ±0.5 for a genuine interior maximum.
  const shift = clamp((0.5 * (a.position.y - c.position.y)) / denom, -0.5, 0.5)
  const spacing = (c.t - a.t) / 2
  return {
    time: peak.t + shift * spacing,
    altitude: peak.position.y - 0.25 * (a.position.y - c.position.y) * shift,
    downrange: peak.downrange + shift * (c.downrange - a.downrange) * 0.5,
    speed: peak.speed,
  }
}

/** Analytic drag-free trajectory for the same muzzle velocity and elevation. */
export function vacuumReference(
  speed: number,
  elevationDeg: number,
  gravity: number,
): VacuumReference {
  const el = elevationDeg * DEG
  const vx = speed * Math.cos(el)
  const vy = speed * Math.sin(el)
  const timeOfFlight = gravity > 0 ? (2 * vy) / gravity : 0
  const range = vx * timeOfFlight
  const maxHeight = gravity > 0 ? (vy * vy) / (2 * gravity) : 0

  const steps = 200
  const path: { x: number; y: number }[] = []
  for (let i = 0; i <= steps; i++) {
    const t = (timeOfFlight * i) / steps
    path.push({ x: vx * t, y: Math.max(vy * t - 0.5 * gravity * t * t, 0) })
  }
  return { range, maxHeight, timeOfFlight, path }
}

/** Instantaneous force arrows at an arbitrary time, for the flight-view overlay. */
export function sampleAt(result: SimulationResult, time: number): Sample {
  const samples = result.samples
  if (time <= samples[0].t) return samples[0]
  const last = samples[samples.length - 1]
  if (time >= last.t) return last

  let lo = 0
  let hi = samples.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (samples[mid].t <= time) lo = mid
    else hi = mid
  }
  const a = samples[lo]
  const b = samples[hi]
  const span = b.t - a.t
  const f = span === 0 ? 0 : (time - a.t) / span
  const velocity = lerp(a.velocity, b.velocity, f)
  const speed = length(velocity)
  return {
    ...a,
    t: time,
    position: lerp(a.position, b.position, f),
    velocity,
    speed,
    airspeed: mix(a.airspeed, b.airspeed, f),
    mach: mix(a.mach, b.mach, f),
    airDensity: mix(a.airDensity, b.airDensity, f),
    altitudeASL: mix(a.altitudeASL, b.altitudeASL, f),
    downrange: mix(a.downrange, b.downrange, f),
    drift: mix(a.drift, b.drift, f),
    forces: {
      gravity: lerp(a.forces.gravity, b.forces.gravity, f),
      drag: lerp(a.forces.drag, b.forces.drag, f),
      magnus: lerp(a.forces.magnus, b.forces.magnus, f),
      coriolis: lerp(a.forces.coriolis, b.forces.coriolis, f),
      dragMagnitude: mix(a.forces.dragMagnitude, b.forces.dragMagnitude, f),
      magnusMagnitude: mix(a.forces.magnusMagnitude, b.forces.magnusMagnitude, f),
      coriolisMagnitude: mix(a.forces.coriolisMagnitude, b.forces.coriolisMagnitude, f),
    },
    energy: {
      kinetic: mix(a.energy.kinetic, b.energy.kinetic, f),
      potential: mix(a.energy.potential, b.energy.potential, f),
      total: mix(a.energy.total, b.energy.total, f),
    },
  }
}

/** Relative airflow direction at a sample, useful for drawing the wind arrow. */
export const relativeAirflow = (sample: Sample, wind: Vec3): Vec3 => sub(sample.velocity, wind)

const mix = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
