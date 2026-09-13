import { GRAVITY_PRESETS } from '../physics/constants'
import type { SimulationConfig } from '../physics/simulate'
import { DEFAULT_CONFIG } from './defaults'

export interface CannonPreset {
  id: string
  name: string
  era: string
  description: string
  /** What the real weapon achieved, for comparison against the model. */
  historical: string
  apply: (base: SimulationConfig) => SimulationConfig
}

/**
 * Historical presets. Specs come from published data; drag coefficients are
 * representative flat values tuned so the flat-Cd model lands near recorded
 * ranges — a good cross-scale sanity check that the physics behaves.
 */
export const CANNON_PRESETS: CannonPreset[] = [
  {
    id: 'napoleon',
    name: 'M1857 Napoleon 12-pounder',
    era: 'American Civil War, 1857',
    description: 'Smoothbore bronze field gun firing 12 lb solid round shot.',
    historical: 'Muzzle velocity ≈ 440 m/s · range ≈ 1,480 m at 5°',
    apply: (base) => ({
      ...base,
      cannon: { ...base.cannon, elevation: 5, barrelLength: 1.68 },
      projectile: {
        ...base.projectile,
        mass: 5.6,
        diameter: 0.117,
        dragCoefficient: 0.47,
        spinRpm: 0,
      },
      propellant: { typeId: 'blackPowder', chargeMass: 1.0, energyDensity: 3.0e6 },
    }),
  },
  {
    id: 'monsMeg',
    name: 'Mons Meg',
    era: 'Scottish bombard, 1449',
    description: 'Wrought-iron siege bombard throwing 150 kg granite balls.',
    historical: 'Range ≈ 3,200 m with iron shot, 1,500 m with stone',
    apply: (base) => ({
      ...base,
      cannon: { ...base.cannon, elevation: 15, barrelLength: 2.84 },
      projectile: {
        ...base.projectile,
        mass: 150,
        diameter: 0.5,
        dragCoefficient: 0.47,
        spinRpm: 0,
      },
      propellant: { typeId: 'blackPowder', chargeMass: 48, energyDensity: 3.0e6 },
    }),
  },
  {
    id: 'm777',
    name: 'M777 155 mm howitzer',
    era: 'Modern towed artillery, 2005',
    description: '39-calibre barrel firing the 43.5 kg M795 high-explosive shell.',
    historical: 'Muzzle velocity ≈ 827 m/s · range ≈ 24 km unassisted',
    apply: (base) => ({
      ...base,
      cannon: { ...base.cannon, elevation: 45, barrelLength: 6.05 },
      projectile: {
        ...base.projectile,
        mass: 43.5,
        diameter: 0.155,
        dragCoefficient: 0.25,
        spinRpm: 0,
      },
      propellant: { typeId: 'tripleBase', chargeMass: 11, energyDensity: 4.9e6 },
    }),
  },
  {
    id: 'parisGun',
    name: 'Paris Gun',
    era: 'German super-gun, 1918',
    description:
      '34 m barrel lobbing 106 kg shells into the stratosphere. Try it with Coriolis on — the shot drifts over a kilometre.',
    historical: 'Muzzle velocity ≈ 1,640 m/s · range ≈ 130 km · apogee ≈ 42 km',
    apply: (base) => ({
      ...base,
      cannon: { ...base.cannon, elevation: 52, barrelLength: 34 },
      projectile: {
        ...base.projectile,
        mass: 106,
        diameter: 0.211,
        dragCoefficient: 0.17,
        spinRpm: 0,
      },
      propellant: { typeId: 'smokeless', chargeMass: 180, energyDensity: 4.5e6 },
      environment: { ...base.environment, latitude: 49.5 },
      integration: { ...base.integration, timestep: 0.004, sampleInterval: 0.1 },
    }),
  },
  {
    id: 'lunar',
    name: 'Napoleon on the Moon',
    era: 'Hypothetical',
    description: 'The same 12-pounder in one-sixth gravity with no air at all.',
    historical: 'No record — nobody has tried it (yet)',
    apply: (base) => ({
      ...CANNON_PRESETS[0].apply(base),
      cannon: { ...base.cannon, elevation: 45, barrelLength: 1.68 },
      environment: { ...base.environment, gravity: GRAVITY_PRESETS.moon },
      toggles: { drag: false, wind: false, magnus: false, coriolis: false },
      integration: {
        ...base.integration,
        timestep: 0.01,
        sampleInterval: 0.25,
        maxFlightTime: 1200,
      },
    }),
  },
]

export const applyPreset = (
  id: string,
  base: SimulationConfig = DEFAULT_CONFIG,
): SimulationConfig => CANNON_PRESETS.find((p) => p.id === id)?.apply(base) ?? base
