import { airStateAt, type AirState, type AtmosphereConfig } from './atmosphere'
import { OMEGA_EARTH } from './constants'
import { crossSectionalArea } from './ballistics'
import { cross, DEG, length, scale, sub, vec, ZERO, type Vec3 } from './vec3'

export type SpinAxis = 'backspin' | 'topspin' | 'sidespinLeft' | 'sidespinRight'

export interface ProjectileConfig {
  /** Mass, kg. */
  mass: number
  /** Diameter, m. */
  diameter: number
  /** Drag coefficient, dimensionless. */
  dragCoefficient: number
  /** Spin rate, rev/min. */
  spinRpm: number
  spinAxis: SpinAxis
  /** Magnus lift tuning factor; 1 is the textbook Kutta–Joukowski magnitude. */
  magnusCoefficient: number
}

export interface WindConfig {
  /** Wind speed, m/s. */
  speed: number
  /** Meteorological direction the wind blows *from*, degrees clockwise from north. */
  fromDirection: number
}

export interface WorldConfig {
  gravity: number
  /** Cannon heading, degrees clockwise from north. */
  azimuth: number
  /** Latitude, degrees, positive north. */
  latitude: number
  atmosphere: AtmosphereConfig
  wind: WindConfig
  enableDrag: boolean
  enableWind: boolean
  enableMagnus: boolean
  enableCoriolis: boolean
}

/**
 * Wind vector in the simulator's downrange frame, m/s.
 *
 * Meteorological convention: a "north wind" blows *from* the north, i.e. towards
 * the south. We rotate it into the frame whose x̂ points along the cannon azimuth
 * and whose ẑ points to the shooter's right.
 */
export function windVector(wind: WindConfig, azimuthDeg: number): Vec3 {
  // Direction the air is travelling towards, in compass degrees.
  const towards = (wind.fromDirection + 180) * DEG
  const az = azimuthDeg * DEG
  // Components in (East, North): a heading θ maps to (sin θ, cos θ).
  const east = wind.speed * Math.sin(towards)
  const north = wind.speed * Math.cos(towards)
  // x̂ = (sin az, cos az), ẑ = (cos az, -sin az) in (East, North).
  return vec(
    east * Math.sin(az) + north * Math.cos(az),
    0,
    east * Math.cos(az) - north * Math.sin(az),
  )
}

/**
 * Earth's rotation vector expressed in the downrange frame, rad/s.
 *
 * In local East-North-Up coordinates Ω = Ω(0, cos φ, sin φ); we project that onto
 * the frame basis the same way as the wind.
 */
export function earthRotationVector(latitudeDeg: number, azimuthDeg: number): Vec3 {
  const lat = latitudeDeg * DEG
  const az = azimuthDeg * DEG
  return vec(
    OMEGA_EARTH * Math.cos(lat) * Math.cos(az),
    OMEGA_EARTH * Math.sin(lat),
    -OMEGA_EARTH * Math.cos(lat) * Math.sin(az),
  )
}

/**
 * Spin vector in the downrange frame, rad/s.
 *
 * Backspin is rotation about +ẑ: the top of the ball moves rearward, and ω × v
 * then points up, producing lift. Sidespin is about the vertical axis, pushing the
 * shot left or right.
 *
 * Note: this models pure Magnus lift, not the gyroscopic *yaw of repose* that
 * causes real rifled spin drift — that needs an aerodynamic-moment model and is
 * out of scope here.
 */
export function spinVector(projectile: ProjectileConfig): Vec3 {
  const omega = (projectile.spinRpm * 2 * Math.PI) / 60
  switch (projectile.spinAxis) {
    case 'backspin':
      return vec(0, 0, omega)
    case 'topspin':
      return vec(0, 0, -omega)
    case 'sidespinLeft':
      return vec(0, omega, 0)
    case 'sidespinRight':
      return vec(0, -omega, 0)
  }
}

export interface ForceBreakdown {
  gravity: Vec3
  drag: Vec3
  magnus: Vec3
  coriolis: Vec3
  total: Vec3
  /** Air state at the sample point, handy for readouts. */
  air: AirState
  /** Velocity relative to the moving air, m/s. */
  relativeVelocity: Vec3
}

/**
 * Every force acting on the projectile at one instant, in newtons.
 *
 * Coriolis is a fictitious force in the rotating frame; we express it as `m·a_c`
 * so it can be summed with the rest.
 */
export function computeForces(
  position: Vec3,
  velocity: Vec3,
  projectile: ProjectileConfig,
  world: WorldConfig,
  precomputed?: { wind: Vec3; omega: Vec3; spin: Vec3; area: number },
): ForceBreakdown {
  const wind =
    precomputed?.wind ?? (world.enableWind ? windVector(world.wind, world.azimuth) : ZERO)
  const omega = precomputed?.omega ?? earthRotationVector(world.latitude, world.azimuth)
  const spin = precomputed?.spin ?? spinVector(projectile)
  const area = precomputed?.area ?? crossSectionalArea(projectile.diameter)

  const air = airStateAt(world.atmosphere, position.y)
  const relativeVelocity = sub(velocity, wind)
  const relativeSpeed = length(relativeVelocity)

  const gravity = vec(0, -projectile.mass * world.gravity, 0)

  // F_d = -½ ρ Cd A |v_rel| v_rel — quadratic in speed, always opposing v_rel.
  const drag = world.enableDrag
    ? scale(
        relativeVelocity,
        -0.5 * air.density * projectile.dragCoefficient * area * relativeSpeed,
      )
    : ZERO

  // F_m = S (ω × v_rel), S = ½ ρ A r Cm. Dimensionally kg, so S·(ω × v) is newtons.
  const magnus =
    world.enableMagnus && projectile.spinRpm !== 0
      ? scale(
          cross(spin, relativeVelocity),
          0.5 * air.density * area * (projectile.diameter / 2) * projectile.magnusCoefficient,
        )
      : ZERO

  // a_c = -2 Ω × v, using ground-frame velocity (not v_rel).
  const coriolis = world.enableCoriolis ? scale(cross(omega, velocity), -2 * projectile.mass) : ZERO

  return {
    gravity,
    drag,
    magnus,
    coriolis,
    total: {
      x: gravity.x + drag.x + magnus.x + coriolis.x,
      y: gravity.y + drag.y + magnus.y + coriolis.y,
      z: gravity.z + drag.z + magnus.z + coriolis.z,
    },
    air,
    relativeVelocity,
  }
}
