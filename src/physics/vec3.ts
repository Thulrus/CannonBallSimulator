/**
 * Minimal immutable 3-vector maths.
 *
 * Frame convention used throughout the simulator:
 *   x = downrange (along the cannon's azimuth)
 *   y = altitude  (up, ground plane at y = 0)
 *   z = lateral   (positive to the right when looking downrange)
 * This is right-handed: x̂ × ŷ = ẑ.
 */
export interface Vec3 {
  x: number
  y: number
  z: number
}

export const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z })

export const ZERO: Vec3 = { x: 0, y: 0, z: 0 }

export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })

export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })

export const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s })

export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z

export const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

export const length = (a: Vec3): number => Math.sqrt(dot(a, a))

/** Unit vector, or the zero vector if `a` has no length (avoids NaN at rest). */
export const normalize = (a: Vec3): Vec3 => {
  const len = length(a)
  return len === 0 ? ZERO : scale(a, 1 / len)
}

export const sum = (...vs: Vec3[]): Vec3 => vs.reduce(add, ZERO)

/** Linear interpolation, `t` in [0, 1]. */
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scale(sub(b, a), t))

export const DEG = Math.PI / 180
