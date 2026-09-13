/** Physical constants, all SI. */

/** Universal gas constant, J/(mol·K). */
export const R_UNIVERSAL = 8.31446261815324

/** Molar mass of dry air, kg/mol. */
export const M_DRY_AIR = 0.0289652

/** Molar mass of water vapour, kg/mol. */
export const M_WATER_VAPOUR = 0.018016

/** Specific gas constant for dry air, J/(kg·K). */
export const R_DRY_AIR = R_UNIVERSAL / M_DRY_AIR

/** Specific gas constant for water vapour, J/(kg·K). */
export const R_WATER_VAPOUR = R_UNIVERSAL / M_WATER_VAPOUR

/** ISA tropospheric temperature lapse rate, K/m. */
export const LAPSE_RATE = 0.0065

/** Scale height used by the simple barometric density model, m. */
export const SCALE_HEIGHT = 8500

/** Sea-level standard air density, kg/m³. */
export const RHO_SEA_LEVEL = 1.225

/** Sea-level standard pressure, Pa. */
export const P_SEA_LEVEL = 101325

/** Standard temperature, K. */
export const T_SEA_LEVEL = 288.15

/** Earth's sidereal rotation rate, rad/s. */
export const OMEGA_EARTH = 7.2921159e-5

/** Ratio of specific heats for air (used for speed of sound). */
export const GAMMA_AIR = 1.4

export const CELSIUS_TO_KELVIN = 273.15

/** Surface gravity presets, m/s². */
export const GRAVITY_PRESETS = {
  earth: 9.80665,
  moon: 1.62,
  mars: 3.721,
  jupiter: 24.79,
} as const

export type GravityBody = keyof typeof GRAVITY_PRESETS
