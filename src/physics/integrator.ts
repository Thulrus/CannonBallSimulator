import { add, scale, type Vec3 } from './vec3'

export interface State {
  position: Vec3
  velocity: Vec3
}

/** Acceleration as a function of time and state, m/s². */
export type Derivative = (t: number, state: State) => Vec3

/**
 * One classical RK4 step.
 *
 * Euler is tempting for a 2nd-order ODE this small, but it visibly under-damps
 * quadratic drag and leaks energy in the vacuum case — both of which show up
 * immediately in the energy chart. RK4 at a few-millisecond step keeps the
 * no-drag total energy flat to well under a joule over a full flight.
 */
export function rk4Step(t: number, state: State, dt: number, accel: Derivative): State {
  const k1v = accel(t, state)
  const k1x = state.velocity

  const s2: State = {
    position: add(state.position, scale(k1x, dt / 2)),
    velocity: add(state.velocity, scale(k1v, dt / 2)),
  }
  const k2v = accel(t + dt / 2, s2)
  const k2x = s2.velocity

  const s3: State = {
    position: add(state.position, scale(k2x, dt / 2)),
    velocity: add(state.velocity, scale(k2v, dt / 2)),
  }
  const k3v = accel(t + dt / 2, s3)
  const k3x = s3.velocity

  const s4: State = {
    position: add(state.position, scale(k3x, dt)),
    velocity: add(state.velocity, scale(k3v, dt)),
  }
  const k4v = accel(t + dt, s4)
  const k4x = s4.velocity

  const sixth = dt / 6
  return {
    position: {
      x: state.position.x + sixth * (k1x.x + 2 * k2x.x + 2 * k3x.x + k4x.x),
      y: state.position.y + sixth * (k1x.y + 2 * k2x.y + 2 * k3x.y + k4x.y),
      z: state.position.z + sixth * (k1x.z + 2 * k2x.z + 2 * k3x.z + k4x.z),
    },
    velocity: {
      x: state.velocity.x + sixth * (k1v.x + 2 * k2v.x + 2 * k3v.x + k4v.x),
      y: state.velocity.y + sixth * (k1v.y + 2 * k2v.y + 2 * k3v.y + k4v.y),
      z: state.velocity.z + sixth * (k1v.z + 2 * k2v.z + 2 * k3v.z + k4v.z),
    },
  }
}
