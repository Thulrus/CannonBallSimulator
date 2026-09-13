import { GRAVITY_PRESETS } from '../physics/constants'
import type { SimulationConfig } from '../physics/simulate'

export const DEFAULT_CONFIG: SimulationConfig = {
  cannon: { elevation: 30, azimuth: 90, barrelLength: 1.68 },
  projectile: {
    mass: 5.6,
    diameter: 0.117,
    dragCoefficient: 0.47,
    spinRpm: 0,
    spinAxis: 'backspin',
    magnusCoefficient: 1,
  },
  propellant: { typeId: 'blackPowder', chargeMass: 1.13, energyDensity: 3.0e6 },
  environment: {
    gravity: GRAVITY_PRESETS.earth,
    latitude: 45,
    atmosphereModel: 'idealGas',
    launchAltitude: 0,
    temperatureC: 15,
    pressurePa: 101325,
    humidity: 0.5,
    wind: { speed: 4, fromDirection: 300 },
  },
  toggles: { drag: true, wind: true, magnus: false, coriolis: false },
  integration: { timestep: 0.002, sampleInterval: 0.02, maxFlightTime: 400 },
}
