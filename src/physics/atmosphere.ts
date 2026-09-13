import {
  CELSIUS_TO_KELVIN,
  GAMMA_AIR,
  R_DRY_AIR,
  R_WATER_VAPOUR,
  RHO_SEA_LEVEL,
  SCALE_HEIGHT,
} from './constants'

export type AtmosphereModel = 'barometric' | 'idealGas'

export interface AtmosphereConfig {
  model: AtmosphereModel
  /** Launch site elevation above sea level, m. */
  launchAltitude: number
  /** Air temperature measured at the launch site, °C. */
  temperatureC: number
  /** Station pressure measured at the launch site, Pa. */
  pressurePa: number
  /** Relative humidity at the launch site, 0–1. */
  humidity: number
}

export interface AirState {
  /** Altitude above sea level, m. */
  altitudeASL: number
  /** Air density, kg/m³. */
  density: number
  /** Temperature, K. */
  temperature: number
  /** Total (moist) air pressure, Pa. */
  pressure: number
  /** Speed of sound, m/s. */
  speedOfSound: number
}

/**
 * Saturation vapour pressure over liquid water, Pa.
 *
 * Buck (1996) equation — accurate to ~0.1% between -40 °C and +50 °C, which is
 * more than enough given that humidity moves air density by well under a percent.
 */
export function saturationVapourPressure(temperatureK: number): number {
  const t = temperatureK - CELSIUS_TO_KELVIN
  return 611.21 * Math.exp((18.678 - t / 234.5) * (t / (257.14 + t)))
}

/**
 * Air density from the ideal gas law, treating moist air as a mixture of dry air
 * and water vapour sharing the total pressure (Dalton). Water vapour is lighter
 * than dry air, so humid air is *less* dense — the opposite of most people's
 * intuition, and a nice thing to surface in the readouts.
 */
export function moistAirDensity(temperatureK: number, pressurePa: number, humidity: number) {
  return densityWithVapour(
    temperatureK,
    pressurePa,
    clamp(humidity, 0, 1) * saturationVapourPressure(temperatureK),
  )
}

/**
 * Ideal-gas density of a dry-air + water-vapour mixture at a given vapour partial
 * pressure. Vapour is capped at the total pressure so thin air can never come out
 * as "all vapour", which used to pin density at a constant floor high up.
 */
export function densityWithVapour(temperatureK: number, pressurePa: number, vapourPa: number) {
  const p = Math.max(pressurePa, 0)
  const pv = clamp(vapourPa, 0, p)
  return (p - pv) / (R_DRY_AIR * temperatureK) + pv / (R_WATER_VAPOUR * temperatureK)
}

/** Water-vapour scale height, m: most of the atmosphere's water sits in the lowest few km. */
const VAPOUR_SCALE_HEIGHT = 2000

/** Speed of sound in dry-ish air, m/s. */
export function speedOfSound(temperatureK: number): number {
  return Math.sqrt(GAMMA_AIR * R_DRY_AIR * temperatureK)
}

/**
 * International Standard Atmosphere layers up to 86 km: base geopotential altitude
 * (m), base temperature (K), base pressure (Pa) and lapse rate (K/m, positive = warming).
 */
const ISA_LAYERS = [
  { base: 0, t: 288.15, p: 101325, lapse: -0.0065 },
  { base: 11000, t: 216.65, p: 22632.1, lapse: 0 },
  { base: 20000, t: 216.65, p: 5474.89, lapse: 0.001 },
  { base: 32000, t: 228.65, p: 868.019, lapse: 0.0028 },
  { base: 47000, t: 270.65, p: 110.906, lapse: 0 },
  { base: 51000, t: 270.65, p: 66.9389, lapse: -0.0028 },
  { base: 71000, t: 214.65, p: 3.95642, lapse: -0.002 },
] as const

const G0 = 9.80665

/** Top of the tabulated ISA, m. */
const ISA_TOP = 86000

/**
 * ISA temperature (K) and pressure (Pa) at a geopotential altitude.
 *
 * Above the 86 km table top the profile continues isothermally, so pressure keeps
 * decaying exponentially. (It used to clamp, freezing density at its 86 km value
 * and applying phantom drag to shots in space.) The real thermosphere is warmer
 * and somewhat denser than this, but at those densities drag is negligible either way.
 */
export function isa(altitude: number): { temperature: number; pressure: number } {
  if (altitude > ISA_TOP) {
    const top = isa(ISA_TOP)
    return {
      temperature: top.temperature,
      pressure:
        top.pressure * Math.exp((-G0 * (altitude - ISA_TOP)) / (R_DRY_AIR * top.temperature)),
    }
  }
  const h = Math.max(altitude, -5000)
  let layer: (typeof ISA_LAYERS)[number] = ISA_LAYERS[0]
  for (const l of ISA_LAYERS) if (h >= l.base) layer = l
  const dh = h - layer.base
  const temperature = layer.t + layer.lapse * dh
  const pressure =
    layer.lapse === 0
      ? layer.p * Math.exp((-G0 * dh) / (R_DRY_AIR * layer.t))
      : layer.p * Math.pow(temperature / layer.t, -G0 / (R_DRY_AIR * layer.lapse))
  return { temperature, pressure }
}

/**
 * Full air state at a height `y` above the launch point.
 *
 * `barometric` is the textbook exponential fit: cheap, ignores the user's weather.
 *
 * `idealGas` follows the layered ISA profile, offset so it passes exactly through
 * the user's measured temperature and pressure at the launch site (ISA + ΔT, with
 * pressure scaled by the measured-to-standard ratio). Density is then derived from
 * the ideal gas law including humidity, so it is an *output* rather than an input.
 * The layered profile matters for extreme shots: a single tropospheric lapse rate
 * overstates density at the Paris Gun's 40 km apogee roughly tenfold.
 */
export function airStateAt(config: AtmosphereConfig, y: number): AirState {
  const altitudeASL = config.launchAltitude + y

  if (config.model === 'barometric') {
    const temperature = config.temperatureC + CELSIUS_TO_KELVIN
    const density = RHO_SEA_LEVEL * Math.exp(-Math.max(altitudeASL, 0) / SCALE_HEIGHT)
    return {
      altitudeASL,
      density,
      temperature,
      pressure: density * R_DRY_AIR * temperature,
      speedOfSound: speedOfSound(temperature),
    }
  }

  const reference = isa(config.launchAltitude)
  const deltaT = config.temperatureC + CELSIUS_TO_KELVIN - reference.temperature
  const pressureRatio = config.pressurePa / reference.pressure

  const here = isa(altitudeASL)
  const temperature = Math.max(here.temperature + deltaT, 120)
  const pressure = here.pressure * pressureRatio

  // Humidity is measured at the launch site. Holding that relative humidity at every
  // altitude would put ground-level moisture in the stratosphere, so instead start from
  // the launch-site vapour pressure, fade it with height, and never exceed saturation.
  const launchT = config.temperatureC + CELSIUS_TO_KELVIN
  const launchVapour = clamp(config.humidity, 0, 1) * saturationVapourPressure(launchT)
  const vapour = Math.min(
    launchVapour * Math.exp(-Math.max(y, 0) / VAPOUR_SCALE_HEIGHT),
    saturationVapourPressure(temperature),
  )

  return {
    altitudeASL,
    density: densityWithVapour(temperature, pressure, vapour),
    temperature,
    pressure,
    speedOfSound: speedOfSound(temperature),
  }
}

/** Standard-atmosphere station pressure for a given elevation, Pa. Useful as a UI default. */
export function standardPressureAt(altitudeASL: number): number {
  return isa(altitudeASL).pressure
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
