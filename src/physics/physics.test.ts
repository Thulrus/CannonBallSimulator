import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../data/defaults'
import { airStateAt, isa, moistAirDensity, type AtmosphereConfig } from './atmosphere'
import { barrelEfficiency, muzzleVelocity, OPTIMAL_CALIBRES } from './ballistics'
import { toCsv } from './csv'
import { windVector } from './forces'
import { rk4Step } from './integrator'
import { sampleAt, simulate, type SimulationConfig } from './simulate'
import { runSweep } from './sweep'
import { cross, vec } from './vec3'

const vacuumConfig = (overrides: Partial<SimulationConfig> = {}): SimulationConfig => ({
  ...DEFAULT_CONFIG,
  toggles: { drag: false, wind: false, magnus: false, coriolis: false },
  ...overrides,
})

const withCannon = (c: SimulationConfig, cannon: Partial<SimulationConfig['cannon']>) => ({
  ...c,
  cannon: { ...c.cannon, ...cannon },
})

describe('vec3', () => {
  it('is right-handed', () => {
    expect(cross(vec(1, 0, 0), vec(0, 1, 0))).toEqual(vec(0, 0, 1))
  })
})

describe('integrator', () => {
  it('is exact for constant acceleration', () => {
    let state = { position: vec(0, 0, 0), velocity: vec(3, 20, 0) }
    for (let i = 0; i < 100; i++) state = rk4Step(i * 0.1, state, 0.1, () => vec(0, -9.8, 0))
    // After 10 s: y = 20·10 − ½·9.8·100 = −290
    expect(state.position.y).toBeCloseTo(-290, 9)
    expect(state.position.x).toBeCloseTo(30, 9)
  })
})

describe('atmosphere', () => {
  const std: AtmosphereConfig = {
    model: 'idealGas',
    launchAltitude: 0,
    temperatureC: 15,
    pressurePa: 101325,
    humidity: 0,
  }

  it('reproduces ISA sea-level density for dry air', () => {
    expect(airStateAt(std, 0).density).toBeCloseTo(1.225, 3)
  })

  it('matches ISA tropopause and stratosphere reference values', () => {
    expect(isa(11000).temperature).toBeCloseTo(216.65, 2)
    expect(isa(20000).pressure).toBeCloseTo(5474.89, -1)
    expect(isa(32000).pressure).toBeCloseTo(868.02, 0)
  })

  it('makes humid air less dense than dry air', () => {
    expect(moistAirDensity(303.15, 101325, 1)).toBeLessThan(moistAirDensity(303.15, 101325, 0))
  })

  it('thins with altitude under both models', () => {
    for (const model of ['idealGas', 'barometric'] as const) {
      const cfg = { ...std, model }
      expect(airStateAt(cfg, 5000).density).toBeLessThan(airStateAt(cfg, 0).density)
    }
  })

  it('passes through the measured launch-site conditions', () => {
    const hot: AtmosphereConfig = {
      ...std,
      launchAltitude: 1600,
      temperatureC: 30,
      pressurePa: 84000,
    }
    const air = airStateAt(hot, 0)
    expect(air.temperature).toBeCloseTo(303.15, 6)
    expect(air.pressure).toBeCloseTo(84000, 6)
  })
})

describe('interior ballistics', () => {
  it('peaks at the optimal barrel length — a real sweet spot', () => {
    const d = 0.1
    const peak = barrelEfficiency(OPTIMAL_CALIBRES * d, d)
    expect(barrelEfficiency(OPTIMAL_CALIBRES * d * 0.5, d)).toBeLessThan(peak)
    expect(barrelEfficiency(OPTIMAL_CALIBRES * d * 2, d)).toBeLessThan(peak)
  })

  it('follows v = sqrt(2E/m)', () => {
    const r = muzzleVelocity({
      chargeMass: 2,
      energyDensity: 3e6,
      barrelLength: 3,
      boreDiameter: 0.12,
      projectileMass: 10,
    })
    expect(r.velocity).toBeCloseTo(Math.sqrt((2 * 2 * 3e6 * r.efficiency) / 10), 9)
  })

  it('gives zero velocity with no charge', () => {
    expect(
      muzzleVelocity({
        chargeMass: 0,
        energyDensity: 3e6,
        barrelLength: 2,
        boreDiameter: 0.1,
        projectileMass: 5,
      }).velocity,
    ).toBe(0)
  })
})

describe('simulate — vacuum', () => {
  it('matches the analytic parabola for range, apogee and flight time', () => {
    for (const elevation of [15, 45, 70]) {
      const r = simulate(withCannon(vacuumConfig(), { elevation }))
      expect(r.summary.maxRange / r.vacuum.range).toBeCloseTo(1, 4)
      expect(r.summary.maxHeight / r.vacuum.maxHeight).toBeCloseTo(1, 4)
      expect(r.summary.timeOfFlight / r.vacuum.timeOfFlight).toBeCloseTo(1, 4)
    }
  })

  it('conserves total energy', () => {
    const r = simulate(vacuumConfig())
    const e0 = r.samples[0].energy.total
    for (const s of r.samples) expect(Math.abs(s.energy.total - e0) / e0).toBeLessThan(1e-6)
  })

  it('lands at the launch speed and mirror angle', () => {
    const r = simulate(withCannon(vacuumConfig(), { elevation: 35 }))
    expect(r.summary.impactVelocity / r.summary.muzzleVelocity).toBeCloseTo(1, 4)
    expect(r.summary.impactAngle).toBeCloseTo(35, 2)
  })
})

describe('simulate — forces', () => {
  it('drag shortens the shot and bleeds energy monotonically', () => {
    const base = withCannon(DEFAULT_CONFIG, { elevation: 45 })
    const drag = simulate({ ...base, toggles: { ...base.toggles, wind: false } })
    const vac = simulate(vacuumConfig({ cannon: base.cannon }))
    expect(drag.summary.maxRange).toBeLessThan(vac.summary.maxRange)
    for (let i = 1; i < drag.samples.length; i++) {
      expect(drag.samples[i].energy.total).toBeLessThanOrEqual(
        drag.samples[i - 1].energy.total + 1e-6,
      )
    }
  })

  it('maps meteorological wind into the firing frame', () => {
    // Firing east; a westerly wind (from 270°) is a pure tailwind.
    const tail = windVector({ speed: 10, fromDirection: 270 }, 90)
    expect(tail.x).toBeCloseTo(10, 9)
    expect(tail.z).toBeCloseTo(0, 9)
    // Firing east; a northerly blows south, which is to the shooter's right (+z).
    const cross = windVector({ speed: 10, fromDirection: 0 }, 90)
    expect(cross.z).toBeCloseTo(10, 9)
  })

  it('tailwind extends range, crosswind drifts downwind', () => {
    const base = withCannon(DEFAULT_CONFIG, { elevation: 30, azimuth: 90 })
    const calm = simulate(base)
    const env = (fromDirection: number) => ({
      ...base,
      environment: { ...base.environment, wind: { speed: 15, fromDirection } },
    })
    expect(simulate(env(270)).impact.position.x).toBeGreaterThan(calm.impact.position.x)
    expect(simulate(env(0)).summary.lateralDrift).toBeGreaterThan(1)
  })

  it('backspin Magnus lifts the shot; left sidespin drifts left', () => {
    const base: SimulationConfig = {
      ...DEFAULT_CONFIG,
      toggles: { drag: true, wind: false, magnus: true, coriolis: false },
      projectile: { ...DEFAULT_CONFIG.projectile, spinRpm: 3000 },
    }
    const none = simulate({ ...base, toggles: { ...base.toggles, magnus: false } })
    const back = simulate({ ...base, projectile: { ...base.projectile, spinAxis: 'backspin' } })
    const left = simulate({ ...base, projectile: { ...base.projectile, spinAxis: 'sidespinLeft' } })
    expect(back.summary.maxHeight).toBeGreaterThan(none.summary.maxHeight)
    expect(left.summary.lateralDrift).toBeLessThan(0)
  })

  it('Coriolis deflects right in the northern hemisphere, left in the southern', () => {
    const base = vacuumConfig({
      cannon: { elevation: 20, azimuth: 0, barrelLength: 34 },
      projectile: { ...DEFAULT_CONFIG.projectile, mass: 106, diameter: 0.211 },
      propellant: { typeId: 'smokeless', chargeMass: 180, energyDensity: 4.5e6 },
      toggles: { drag: false, wind: false, magnus: false, coriolis: true },
    })
    const north = simulate({ ...base, environment: { ...base.environment, latitude: 45 } })
    const south = simulate({ ...base, environment: { ...base.environment, latitude: -45 } })
    expect(north.summary.lateralDrift).toBeGreaterThan(10)
    expect(south.summary.lateralDrift).toBeLessThan(-10)
  })
})

describe('simulate — impact and sampling', () => {
  it('interpolates impact exactly onto the ground plane', () => {
    const r = simulate(DEFAULT_CONFIG)
    expect(r.impact.position.y).toBe(0)
    expect(r.samples[r.samples.length - 1].t).toBeCloseTo(r.impact.time, 12)
  })

  it('sampleAt interpolates between recorded samples', () => {
    const r = simulate(DEFAULT_CONFIG)
    const a = r.samples[10]
    const b = r.samples[11]
    const mid = sampleAt(r, (a.t + b.t) / 2)
    expect(mid.position.x).toBeCloseTo((a.position.x + b.position.x) / 2, 9)
  })

  it('warns when the flight is truncated', () => {
    const r = simulate({
      ...DEFAULT_CONFIG,
      integration: { ...DEFAULT_CONFIG.integration, maxFlightTime: 1 },
    })
    expect(r.warnings.length).toBeGreaterThan(0)
  })
})

describe('sensitivity sweep', () => {
  it('finds 45° optimal in vacuum but lower with drag', () => {
    const def = { parameter: 'elevation' as const, from: 20, to: 70, steps: 51 }
    expect(runSweep(vacuumConfig(), def).best.value).toBeCloseTo(45, 0)
    const drag = { ...DEFAULT_CONFIG, toggles: { ...DEFAULT_CONFIG.toggles, wind: false } }
    expect(runSweep(drag, def).best.value).toBeLessThan(42)
  })
})

describe('csv export', () => {
  it('writes a header, a column row and one row per sample', () => {
    const r = simulate(DEFAULT_CONFIG)
    const lines = toCsv(r).trim().split('\n')
    const columnRow = lines.findIndex((l) => l.startsWith('t_s,'))
    expect(columnRow).toBeGreaterThan(0)
    expect(lines.length - columnRow - 1).toBe(r.samples.length)
  })
})
