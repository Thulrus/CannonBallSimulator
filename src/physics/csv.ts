import type { SimulationResult } from './simulate'

const COLUMNS: [string, (s: SimulationResult['samples'][number]) => number][] = [
  ['t_s', (s) => s.t],
  ['x_downrange_m', (s) => s.position.x],
  ['y_altitude_m', (s) => s.position.y],
  ['z_drift_m', (s) => s.position.z],
  ['altitude_asl_m', (s) => s.altitudeASL],
  ['vx_mps', (s) => s.velocity.x],
  ['vy_mps', (s) => s.velocity.y],
  ['vz_mps', (s) => s.velocity.z],
  ['speed_mps', (s) => s.speed],
  ['airspeed_mps', (s) => s.airspeed],
  ['mach', (s) => s.mach],
  ['air_density_kgm3', (s) => s.airDensity],
  ['drag_N', (s) => s.forces.dragMagnitude],
  ['drag_x_N', (s) => s.forces.drag.x],
  ['drag_y_N', (s) => s.forces.drag.y],
  ['drag_z_N', (s) => s.forces.drag.z],
  ['magnus_N', (s) => s.forces.magnusMagnitude],
  ['coriolis_N', (s) => s.forces.coriolisMagnitude],
  ['kinetic_energy_J', (s) => s.energy.kinetic],
  ['potential_energy_J', (s) => s.energy.potential],
  ['total_energy_J', (s) => s.energy.total],
]

/**
 * Full time series as CSV, always in SI units regardless of the UI unit toggle —
 * anyone pulling this into a notebook wants consistent units, not display units.
 * A commented header records the configuration so the file stands on its own.
 */
export function toCsv(result: SimulationResult): string {
  const { config, summary } = result
  const header = [
    '# Cannonball Trajectory Simulator export (SI units)',
    `# elevation_deg=${config.cannon.elevation} azimuth_deg=${config.cannon.azimuth} barrel_m=${config.cannon.barrelLength}`,
    `# projectile_kg=${config.projectile.mass} diameter_m=${config.projectile.diameter} cd=${config.projectile.dragCoefficient} spin_rpm=${config.projectile.spinRpm}`,
    `# charge_kg=${config.propellant.chargeMass} propellant=${config.propellant.typeId}`,
    `# drag=${config.toggles.drag} wind=${config.toggles.wind} magnus=${config.toggles.magnus} coriolis=${config.toggles.coriolis}`,
    `# muzzle_velocity_mps=${fmt(summary.muzzleVelocity)} range_m=${fmt(summary.maxRange)} apogee_m=${fmt(summary.maxHeight)} tof_s=${fmt(summary.timeOfFlight)}`,
  ]
  const rows = result.samples.map((s) => COLUMNS.map(([, get]) => fmt(get(s))).join(','))
  return [...header, COLUMNS.map(([name]) => name).join(','), ...rows].join('\n') + '\n'
}

const fmt = (v: number) => (Number.isFinite(v) ? Number(v.toPrecision(8)).toString() : '')
