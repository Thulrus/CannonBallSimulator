/**
 * Interior ballistics: turning a powder charge into a muzzle velocity.
 *
 * This is deliberately a lumped-energy model rather than a real interior-ballistics
 * solve (which would need a burn-rate law and a gas-pressure ODE). It gets the
 * *behaviour* right — more powder means more speed, with diminishing returns from
 * barrel length — which is what makes the charge slider feel like it matters.
 */

export interface PropellantType {
  id: string
  name: string
  /** Chemical energy released per kilogram, J/kg. */
  energyDensity: number
  description: string
}

export interface ChargeConfig {
  /** Mass of propellant burned, kg. */
  chargeMass: number
  /** Energy density of the propellant, J/kg. */
  energyDensity: number
  /** Barrel length, m. */
  barrelLength: number
  /** Bore diameter, m (taken as the projectile diameter). */
  boreDiameter: number
  /** Projectile mass, kg. */
  projectileMass: number
}

/** Asymptotic fraction of chemical energy reaching the projectile with no bore losses. */
export const MAX_EFFICIENCY = 0.36

/** Barrel length, in calibres, over which gas expansion work saturates. */
const SATURATION_CALIBRES = 18

/** Efficiency lost per calibre of bore to friction, heat and gas leakage. */
const LOSS_PER_CALIBRE = 0.0012

/**
 * Barrel efficiency, 0 to {@link MAX_EFFICIENCY}, as a function of length in calibres.
 *
 * Two competing effects: gas expansion does more work the longer the projectile
 * stays in the bore (a saturating exponential), while friction, heat transfer and
 * leakage grow roughly linearly with bore length. The difference peaks at a finite
 * length, so there is a genuine sweet spot rather than "longer is always better".
 *
 * Working in calibres (L/D) rather than metres is what lets one curve serve a
 * 1.7 m Napoleon and a 34 m Paris Gun: expansion ratio scales with bore volume,
 * not absolute length. Constants are tuned so the historical presets land within
 * a few percent of their recorded muzzle velocities.
 */
export function barrelEfficiency(barrelLength: number, boreDiameter: number): number {
  const calibres = Math.max(barrelLength, 0) / Math.max(boreDiameter, 1e-4)
  const expansion = MAX_EFFICIENCY * (1 - Math.exp(-calibres / SATURATION_CALIBRES))
  return Math.max(expansion - LOSS_PER_CALIBRE * calibres, 0)
}

/** Barrel length in calibres that maximises {@link barrelEfficiency}. */
export const OPTIMAL_CALIBRES =
  -SATURATION_CALIBRES * Math.log((LOSS_PER_CALIBRE * SATURATION_CALIBRES) / MAX_EFFICIENCY)

/** Most efficient barrel length for a given bore, m. */
export const optimalBarrelLength = (boreDiameter: number): number => OPTIMAL_CALIBRES * boreDiameter

export interface MuzzleResult {
  /** Muzzle velocity, m/s. */
  velocity: number
  /** Chemical energy in the charge, J. */
  chemicalEnergy: number
  /** Energy actually delivered to the projectile, J. */
  deliveredEnergy: number
  /** Efficiency used, 0–1. */
  efficiency: number
}

/**
 * `v = sqrt(2 * E_delivered / m)` where `E_delivered = m_charge * energyDensity * efficiency`.
 */
export function muzzleVelocity(config: ChargeConfig): MuzzleResult {
  const efficiency = barrelEfficiency(config.barrelLength, config.boreDiameter)
  const chemicalEnergy = Math.max(config.chargeMass, 0) * Math.max(config.energyDensity, 0)
  const deliveredEnergy = chemicalEnergy * efficiency
  const mass = Math.max(config.projectileMass, 1e-6)
  return {
    velocity: Math.sqrt((2 * deliveredEnergy) / mass),
    chemicalEnergy,
    deliveredEnergy,
    efficiency,
  }
}

/** Cross-sectional area of a projectile of the given diameter, m². */
export const crossSectionalArea = (diameter: number): number => Math.PI * (diameter / 2) ** 2

/** Sectional density, kg/m² — the mass-to-area ratio that governs how hard drag bites. */
export const sectionalDensity = (mass: number, diameter: number): number =>
  mass / crossSectionalArea(diameter)

/** Ballistic coefficient in the simple `SD / Cd` sense, kg/m². */
export const ballisticCoefficient = (mass: number, diameter: number, dragCoefficient: number) =>
  sectionalDensity(mass, diameter) / Math.max(dragCoefficient, 1e-6)
