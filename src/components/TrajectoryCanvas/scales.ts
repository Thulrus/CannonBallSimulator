export interface PlotRect {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Linear mapping from world (u, v) metres to canvas pixels. In the side view v is
 * altitude and grows upward (`invert`); in the top-down view v is lateral drift and
 * grows downward, so "right of the aim line" is below it on screen.
 */
export interface Scale {
  u0: number
  u1: number
  v0: number
  v1: number
  kx: number
  ky: number
  invert: boolean
  plot: PlotRect
  sx: (u: number) => number
  sy: (v: number) => number
}

export function makeScale(
  u0: number,
  u1: number,
  v0: number,
  v1: number,
  plot: PlotRect,
  invert: boolean,
): Scale {
  const kx = plot.width / (u1 - u0)
  const ky = plot.height / (v1 - v0)
  return {
    u0,
    u1,
    v0,
    v1,
    kx,
    ky,
    invert,
    plot,
    sx: (u) => plot.left + (u - u0) * kx,
    sy: invert ? (v) => plot.top + plot.height - (v - v0) * ky : (v) => plot.top + (v - v0) * ky,
  }
}

/** A 1-2-5 step giving roughly `target` ticks across `range`. */
export function niceStep(range: number, target: number): number {
  const raw = range / Math.max(target, 1)
  const mag = 10 ** Math.floor(Math.log10(raw))
  const n = raw / mag
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag
}

export function ticks(min: number, max: number, target: number): number[] {
  if (!(max > min)) return [min]
  const step = niceStep(max - min, target)
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) {
    out.push(Math.abs(v) < step * 1e-9 ? 0 : v)
  }
  return out
}
