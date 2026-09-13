import { windVector } from '../../physics/forces'
import { sampleAt, type Sample, type SimulationResult } from '../../physics/simulate'
import type { Vec3 } from '../../physics/vec3'
import { FORCE_COLORS, PALETTE } from '../../lib/colors'
import { displayUnit, formatQuantity, formatTick, type UnitSystem } from '../../lib/units'
import { makeScale, ticks, type PlotRect, type Scale } from './scales'

export type ViewMode = 'side' | 'top'

export interface ViewOptions {
  view: ViewMode
  showVacuum: boolean
  showForces: boolean
  trueScale: boolean
  units: UnitSystem
}

export interface ShotOverlay {
  id: number
  color: string
  result: SimulationResult
}

export interface SceneInput {
  result: SimulationResult
  shots: ShotOverlay[]
  options: ViewOptions
  time: number
}

export interface SceneGeometry {
  muzzle: { x: number; y: number }
  muzzleAngle: number
  impact: { x: number; y: number }
}

const MARGIN = { left: 60, right: 18, top: 18, bottom: 36 }
const MAX_PATH_POINTS = 1600
const TRUNCATED_COLOR = '#fbbf24'
const FONT = '500 10.5px "Inter Variable", ui-sans-serif, system-ui, sans-serif'
const FONT_BOLD = '600 11px "Inter Variable", ui-sans-serif, system-ui, sans-serif'

interface Bounds {
  xMin: number
  xMax: number
  yMax: number
  zAbs: number
}

const boundsCache = new WeakMap<SimulationResult, Bounds>()

function boundsOf(result: SimulationResult): Bounds {
  let b = boundsCache.get(result)
  if (!b) {
    b = { xMin: 0, xMax: 0, yMax: 0, zAbs: 0 }
    for (const s of result.samples) {
      if (s.position.x < b.xMin) b.xMin = s.position.x
      if (s.position.x > b.xMax) b.xMax = s.position.x
      if (s.position.y > b.yMax) b.yMax = s.position.y
      if (Math.abs(s.position.z) > b.zAbs) b.zAbs = Math.abs(s.position.z)
    }
    boundsCache.set(result, b)
  }
  return b
}

/** Second screen coordinate for the active view. */
const vOf = (p: Vec3, view: ViewMode) => (view === 'side' ? p.y : p.z)

function computeScale(input: SceneInput, plot: PlotRect): Scale {
  const { result, shots, options } = input
  const all = [result, ...shots.map((s) => s.result)]

  let uMin = 0
  let uMax = 1
  let yMax = 1
  let zAbs = 0
  for (const r of all) {
    const b = boundsOf(r)
    uMin = Math.min(uMin, b.xMin)
    uMax = Math.max(uMax, b.xMax)
    yMax = Math.max(yMax, b.yMax)
    zAbs = Math.max(zAbs, b.zAbs)
  }
  // The vacuum arc only sets the frame when it's comparable in size. For a draggy
  // round shot it can be 5× longer than the real flight, which would squash the
  // trajectory you actually care about into a corner — so let it run off the edge.
  if (options.showVacuum && options.view === 'side') {
    if (result.vacuum.range <= uMax * 1.8) uMax = Math.max(uMax, result.vacuum.range)
    if (result.vacuum.maxHeight <= yMax * 1.8) yMax = Math.max(yMax, result.vacuum.maxHeight)
  }

  // Leave ~44 px left of the muzzle for the cannon sprite, and a little air on the right.
  const span = uMax - uMin
  let u0 = uMin - span * (44 / plot.width)
  let u1 = uMax + span * 0.035

  if (options.view === 'side') {
    let v1 = yMax * 1.14
    let v0 = -v1 * 0.035
    if (options.trueScale) {
      const m = Math.max((u1 - u0) / plot.width, (v1 - v0) / plot.height)
      u1 = u0 + m * plot.width
      v0 = -m * plot.height * 0.035
      v1 = v0 + m * plot.height
    }
    return makeScale(u0, u1, v0, v1, plot, true)
  }

  let half = Math.max(zAbs * 1.35, (u1 - u0) * 0.012, 0.5)
  if (options.trueScale) {
    const m = Math.max((u1 - u0) / plot.width, (2 * half) / plot.height)
    u1 = u0 + m * plot.width
    half = (m * plot.height) / 2
  }
  return makeScale(u0, u1, -half, half, plot, false)
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  input: SceneInput,
): SceneGeometry {
  const { result, shots, options, time } = input
  const { view, units } = options
  const plot: PlotRect = {
    left: MARGIN.left,
    top: MARGIN.top,
    width: Math.max(width - MARGIN.left - MARGIN.right, 20),
    height: Math.max(height - MARGIN.top - MARGIN.bottom, 20),
  }
  const scale = computeScale(input, plot)
  const current = sampleAt(result, time)
  const inFlight = time < result.impact.time - 1e-9

  drawBackground(ctx, width, height, scale, view)
  drawGrid(ctx, scale, options)
  if (view === 'side') drawGround(ctx, scale, height)
  else drawAimLine(ctx, scale, result)

  ctx.save()
  ctx.beginPath()
  ctx.rect(plot.left - 50, 0, plot.width + 50 + MARGIN.right, plot.top + plot.height)
  ctx.clip()

  if (options.showVacuum && view === 'side') drawVacuum(ctx, scale, result, units)

  for (const shot of shots) {
    ctx.globalAlpha = 0.6
    strokePath(ctx, scale, shot.result.samples, shot.result.samples.length, view)
    ctx.strokeStyle = shot.color
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.globalAlpha = 1
    const imp = shot.result.impact.position
    dot(ctx, scale.sx(imp.x), scale.sy(vOf(imp, view)), 3, shot.color)
  }

  // The full predicted path, faint, so you can see where the shot is headed.
  if (inFlight) {
    strokePath(ctx, scale, result.samples, result.samples.length, view)
    ctx.setLineDash([2, 5])
    ctx.strokeStyle = 'rgba(163,174,194,0.22)'
    ctx.lineWidth = 1.25
    ctx.stroke()
    ctx.setLineDash([])
  }

  const flownCount = lastIndexAtOrBefore(result.samples, time) + 1
  strokePath(ctx, scale, result.samples, flownCount, view, current)
  ctx.strokeStyle = PALETTE.brass
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.stroke()

  if (inFlight) drawTrail(ctx, scale, result, time, view)

  if (view === 'side' && time >= result.apogee.time) drawApogee(ctx, scale, result, units)
  if (!inFlight) drawImpact(ctx, scale, result, view, units)

  let geometry: SceneGeometry
  if (view === 'side') {
    geometry = drawCannon(ctx, scale, result)
  } else {
    const ox = scale.sx(0)
    const oy = scale.sy(0)
    dot(ctx, ox, oy, 5, PALETTE.brassDark)
    dot(ctx, ox, oy, 2.5, PALETTE.brassLight)
    geometry = { muzzle: { x: ox, y: oy }, muzzleAngle: 0, impact: { x: 0, y: 0 } }
  }
  geometry.impact = {
    x: scale.sx(result.impact.position.x),
    y: scale.sy(vOf(result.impact.position, view)),
  }

  const px = scale.sx(current.position.x)
  const py = scale.sy(vOf(current.position, view))
  if (inFlight && options.showForces) drawForces(ctx, scale, current, view, result)
  drawProjectile(ctx, px, py, inFlight)

  ctx.restore()

  drawWindBadge(ctx, scale, result, view, units)
  return geometry
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scale: Scale,
  view: ViewMode,
) {
  const sky = ctx.createLinearGradient(0, 0, 0, height)
  sky.addColorStop(0, '#080c17')
  sky.addColorStop(1, view === 'side' ? '#101a2d' : '#0b1120')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, width, height)

  if (view === 'side') {
    const gy = scale.sy(0)
    const cx = scale.plot.left + scale.plot.width * 0.35
    const glow = ctx.createRadialGradient(cx, gy, 0, cx, gy, scale.plot.width * 0.75)
    glow.addColorStop(0, 'rgba(234,178,90,0.07)')
    glow.addColorStop(1, 'rgba(234,178,90,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, width, height)
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, scale: Scale, options: ViewOptions) {
  const { plot } = scale
  const { units, view } = options
  const uUnit = displayUnit(units, 'distance', Math.max(Math.abs(scale.u0), Math.abs(scale.u1)))
  const vUnit = displayUnit(
    units,
    view === 'side' ? 'altitude' : 'distance',
    Math.max(Math.abs(scale.v0), Math.abs(scale.v1)),
  )

  ctx.save()
  ctx.font = FONT
  ctx.lineWidth = 1

  const uTicks = ticks(
    scale.u0 * uUnit.factor,
    scale.u1 * uUnit.factor,
    Math.max(2, plot.width / 110),
  )
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  for (const d of uTicks) {
    const x = Math.round(scale.sx(d / uUnit.factor)) + 0.5
    if (x < plot.left - 0.5 || x > plot.left + plot.width + 0.5) continue
    ctx.strokeStyle = d === 0 ? 'rgba(122,135,158,0.22)' : 'rgba(122,135,158,0.08)'
    ctx.beginPath()
    ctx.moveTo(x, plot.top)
    ctx.lineTo(x, plot.top + plot.height)
    ctx.stroke()
    ctx.fillStyle = PALETTE.ink400
    ctx.fillText(formatTick(d), x, plot.top + plot.height + 15)
  }

  const vTicks = ticks(
    scale.v0 * vUnit.factor,
    scale.v1 * vUnit.factor,
    Math.max(2, plot.height / 64),
  )
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (const d of vTicks) {
    const y = Math.round(scale.sy(d / vUnit.factor)) + 0.5
    if (y < plot.top - 0.5 || y > plot.top + plot.height + 0.5) continue
    ctx.strokeStyle = 'rgba(122,135,158,0.08)'
    ctx.beginPath()
    ctx.moveTo(plot.left, y)
    ctx.lineTo(plot.left + plot.width, y)
    ctx.stroke()
    ctx.fillStyle = PALETTE.ink400
    ctx.fillText(formatTick(view === 'top' ? d : d), plot.left - 8, y)
  }

  ctx.fillStyle = PALETTE.ink500
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'right'
  ctx.fillText(`Downrange (${uUnit.label})`, plot.left + plot.width, plot.top + plot.height + 30)
  ctx.textAlign = 'left'
  ctx.fillText(
    view === 'side' ? `Altitude (${vUnit.label})` : `Lateral drift (${vUnit.label}) · right ↓`,
    plot.left + 8,
    plot.top + 14,
  )
  ctx.restore()
}

function drawGround(ctx: CanvasRenderingContext2D, scale: Scale, height: number) {
  const { plot } = scale
  const gy = scale.sy(0)
  const bottom = plot.top + plot.height
  const earth = ctx.createLinearGradient(0, gy, 0, height)
  earth.addColorStop(0, '#1c160e')
  earth.addColorStop(1, '#0d0b08')
  ctx.fillStyle = earth
  ctx.fillRect(plot.left - 50, gy, plot.width + 50 + MARGIN.right, bottom - gy)

  ctx.strokeStyle = 'rgba(234,178,90,0.4)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(plot.left - 50, Math.round(gy) + 0.5)
  ctx.lineTo(plot.left + plot.width + MARGIN.right, Math.round(gy) + 0.5)
  ctx.stroke()
}

function drawAimLine(ctx: CanvasRenderingContext2D, scale: Scale, result: SimulationResult) {
  const { plot } = scale
  const y = Math.round(scale.sy(0)) + 0.5
  ctx.save()
  ctx.strokeStyle = 'rgba(234,178,90,0.35)'
  ctx.setLineDash([6, 6])
  ctx.beginPath()
  ctx.moveTo(plot.left, y)
  ctx.lineTo(plot.left + plot.width, y)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.font = FONT
  ctx.fillStyle = 'rgba(234,178,90,0.7)'
  ctx.textAlign = 'right'
  ctx.fillText(
    `aim line · heading ${String(Math.round(result.config.cannon.azimuth)).padStart(3, '0')}°`,
    plot.left + plot.width - 6,
    y - 7,
  )
  ctx.restore()
}

function lastIndexAtOrBefore(samples: Sample[], time: number): number {
  let lo = 0
  let hi = samples.length - 1
  if (time >= samples[hi].t) return hi
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (samples[mid].t <= time) lo = mid
    else hi = mid
  }
  return lo
}

/** Build (but don't stroke) a polyline over the first `count` samples, plus an optional tail point. */
function strokePath(
  ctx: CanvasRenderingContext2D,
  scale: Scale,
  samples: Sample[],
  count: number,
  view: ViewMode,
  tail?: Sample,
) {
  const stride = Math.max(1, Math.ceil(samples.length / MAX_PATH_POINTS))
  ctx.beginPath()
  const first = samples[0]
  ctx.moveTo(scale.sx(first.position.x), scale.sy(vOf(first.position, view)))
  for (let i = stride; i < count; i += stride) {
    const s = samples[i]
    ctx.lineTo(scale.sx(s.position.x), scale.sy(vOf(s.position, view)))
  }
  const end = tail ?? samples[count - 1]
  ctx.lineTo(scale.sx(end.position.x), scale.sy(vOf(end.position, view)))
}

function drawVacuum(
  ctx: CanvasRenderingContext2D,
  scale: Scale,
  result: SimulationResult,
  units: UnitSystem,
) {
  const path = result.vacuum.path
  if (path.length < 2) return
  ctx.save()
  ctx.beginPath()
  path.forEach((p, i) =>
    i === 0 ? ctx.moveTo(scale.sx(p.x), scale.sy(p.y)) : ctx.lineTo(scale.sx(p.x), scale.sy(p.y)),
  )
  ctx.setLineDash([5, 5])
  ctx.strokeStyle = 'rgba(163,174,194,0.42)'
  ctx.lineWidth = 1.25
  ctx.stroke()
  ctx.setLineDash([])

  const right = scale.plot.left + scale.plot.width
  const top = scale.plot.top
  const apexX = scale.sx(result.vacuum.range / 2)
  const apexY = scale.sy(result.vacuum.maxHeight)
  const range = formatQuantity(units, 'distance', result.vacuum.range)
  let text = `vacuum · ${range}`
  let lx = apexX
  let ly = Math.max(apexY - 8, top + 26)
  let align: CanvasTextAlign = 'center'
  if (apexX > right - 40 || apexY < top + 20) {
    // The arc leaves the frame: label it just inside the exit point, set back to the
    // left so it can't collide with the apogee label of the real shot.
    const exit =
      path.find((p) => scale.sx(p.x) > right - 12 || scale.sy(p.y) < top + 24) ??
      path[path.length - 1]
    text = `vacuum → ${range}`
    lx = Math.min(scale.sx(exit.x), right) - 10
    ly = Math.max(scale.sy(exit.y) + 30, top + 48)
    align = 'right'
  }
  ctx.font = FONT
  ctx.fillStyle = 'rgba(163,174,194,0.75)'
  ctx.textAlign = align
  ctx.fillText(text, lx, ly)
  ctx.restore()
}

function drawTrail(
  ctx: CanvasRenderingContext2D,
  scale: Scale,
  result: SimulationResult,
  time: number,
  view: ViewMode,
) {
  const trail = Math.max(result.impact.time * 0.07, 0.15)
  const start = Math.max(time - trail, 0)
  const chunks = 14
  ctx.save()
  ctx.lineCap = 'round'
  ctx.shadowColor = 'rgba(245,207,133,0.9)'
  for (let k = 0; k < chunks; k++) {
    const ta = start + ((time - start) * k) / chunks
    const tb = start + ((time - start) * (k + 1)) / chunks
    const a = sampleAt(result, ta)
    const b = sampleAt(result, tb)
    const f = (k + 1) / chunks
    ctx.shadowBlur = 10 * f
    ctx.strokeStyle = `rgba(255,228,170,${0.85 * f * f})`
    ctx.lineWidth = 1 + 3 * f
    ctx.beginPath()
    ctx.moveTo(scale.sx(a.position.x), scale.sy(vOf(a.position, view)))
    ctx.lineTo(scale.sx(b.position.x), scale.sy(vOf(b.position, view)))
    ctx.stroke()
  }
  ctx.restore()
}

function drawApogee(
  ctx: CanvasRenderingContext2D,
  scale: Scale,
  result: SimulationResult,
  units: UnitSystem,
) {
  const x = scale.sx(result.apogee.downrange)
  const y = scale.sy(result.apogee.altitude)
  ctx.save()
  ctx.strokeStyle = 'rgba(245,207,133,0.25)'
  ctx.setLineDash([2, 4])
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x, scale.sy(0))
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = PALETTE.brassLight
  ctx.beginPath()
  ctx.moveTo(x, y - 4.5)
  ctx.lineTo(x + 4.5, y)
  ctx.lineTo(x, y + 4.5)
  ctx.lineTo(x - 4.5, y)
  ctx.closePath()
  ctx.fill()

  label(
    ctx,
    `apogee ${formatQuantity(units, 'altitude', result.apogee.altitude)}`,
    x,
    y - 11,
    scale,
    PALETTE.brassLight,
  )
  ctx.restore()
}

function drawImpact(
  ctx: CanvasRenderingContext2D,
  scale: Scale,
  result: SimulationResult,
  view: ViewMode,
  units: UnitSystem,
) {
  const p = result.impact.position
  const x = scale.sx(p.x)
  const y = scale.sy(vOf(p, view))

  // The flight-time limit ran out mid-air: mark where the simulation stopped, but
  // don't pretend it hit anything.
  if (result.impact.truncated) {
    ctx.save()
    ctx.strokeStyle = TRUNCATED_COLOR
    ctx.lineWidth = 1.5
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.arc(x, y, 8, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    label(
      ctx,
      `still airborne at ${Math.round(result.impact.time)} s · flight limit`,
      x,
      y - 18,
      scale,
      TRUNCATED_COLOR,
    )
    ctx.restore()
    return
  }

  ctx.save()
  ctx.strokeStyle = PALETTE.brassLight
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(x, y, 7, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x - 11, y)
  ctx.lineTo(x - 4, y)
  ctx.moveTo(x + 4, y)
  ctx.lineTo(x + 11, y)
  ctx.moveTo(x, y - 11)
  ctx.lineTo(x, y - 4)
  ctx.stroke()
  const text =
    view === 'side'
      ? `impact ${formatQuantity(units, 'distance', result.impact.groundDistance)}`
      : `impact · ${formatQuantity(units, 'distance', Math.abs(p.z))} ${p.z >= 0 ? 'right' : 'left'}`
  label(ctx, text, x, y - 17, scale, PALETTE.ink100)
  ctx.restore()
}

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  scale: Scale,
  color: string,
) {
  ctx.font = FONT_BOLD
  const w = ctx.measureText(text).width
  const cx = Math.min(
    Math.max(x, scale.plot.left + w / 2 + 6),
    scale.plot.left + scale.plot.width - w / 2 - 6,
  )
  const cy = Math.max(y, scale.plot.top + 30)
  ctx.fillStyle = 'rgba(8,12,23,0.78)'
  roundRect(ctx, cx - w / 2 - 6, cy - 12, w + 12, 17, 5)
  ctx.fill()
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(text, cx, cy)
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * Field gun sprite, drawn in screen space so it stays a readable size at any zoom.
 * The barrel is aligned with the *on-screen* launch direction (which differs from the
 * true elevation when axes are scaled independently) so the arc leaves the muzzle
 * cleanly. Anything below the ground line is clipped, which reads as a gun pit at
 * steep mortar angles.
 */
function drawCannon(
  ctx: CanvasRenderingContext2D,
  scale: Scale,
  result: SimulationResult,
): SceneGeometry {
  const ox = scale.sx(0)
  const oy = scale.sy(0)
  const v0 = result.samples[0].velocity
  const angle = Math.atan2(-v0.y * scale.ky, Math.max(v0.x * scale.kx, 1e-9))

  ctx.save()
  ctx.beginPath()
  ctx.rect(ox - 80, oy - 120, 160, 120)
  ctx.clip()

  // Trail of the carriage.
  ctx.strokeStyle = '#4b3620'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(ox - 14, oy - 9)
  ctx.lineTo(ox - 44, oy - 1)
  ctx.stroke()

  // Barrel.
  ctx.save()
  ctx.translate(ox, oy)
  ctx.rotate(angle)
  const L = 36
  const bronze = ctx.createLinearGradient(0, -11, 0, 0)
  bronze.addColorStop(0, '#fae3b4')
  bronze.addColorStop(0.4, '#d99a3a')
  bronze.addColorStop(1, '#6b4715')
  ctx.fillStyle = bronze
  ctx.beginPath()
  ctx.moveTo(-L, 0)
  ctx.lineTo(0, 0)
  ctx.lineTo(0, -7.5)
  ctx.lineTo(-L, -11)
  ctx.closePath()
  ctx.fill()
  ctx.fillRect(-4, -9, 4, 10)
  ctx.beginPath()
  ctx.arc(-L - 2.5, -5.5, 3.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = 1
  ctx.strokeRect(-L * 0.62, -10, 2.5, 10)
  ctx.restore()

  // Wheel.
  const wx = ox - 14
  const wy = oy - 10
  ctx.fillStyle = '#2a1d10'
  ctx.strokeStyle = '#9a7442'
  ctx.lineWidth = 2.2
  ctx.beginPath()
  ctx.arc(wx, wy, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.lineWidth = 1.2
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3
    ctx.beginPath()
    ctx.moveTo(wx, wy)
    ctx.lineTo(wx + Math.cos(a) * 9, wy + Math.sin(a) * 9)
    ctx.stroke()
  }
  dot(ctx, wx, wy, 2.2, '#c9a064')
  ctx.restore()

  return { muzzle: { x: ox, y: oy - 4 }, muzzleAngle: angle, impact: { x: 0, y: 0 } }
}

function drawProjectile(ctx: CanvasRenderingContext2D, x: number, y: number, inFlight: boolean) {
  ctx.save()
  if (inFlight) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 18)
    glow.addColorStop(0, 'rgba(255,224,160,0.55)')
    glow.addColorStop(1, 'rgba(255,224,160,0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(x, y, 18, 0, Math.PI * 2)
    ctx.fill()
  }
  const body = ctx.createRadialGradient(x - 1.5, y - 1.5, 0.5, x, y, 5.5)
  body.addColorStop(0, '#fff6e0')
  body.addColorStop(0.5, '#c9ccd4')
  body.addColorStop(1, '#4a4f5c')
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.arc(x, y, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/**
 * Instantaneous force arrows. Lengths scale with √(|F| / |F_gravity|) so a 10× drag
 * force is visibly bigger without swamping the view, and tiny Coriolis forces still
 * get a minimum-length stub rather than vanishing.
 */
function drawForces(
  ctx: CanvasRenderingContext2D,
  scale: Scale,
  s: Sample,
  view: ViewMode,
  result: SimulationResult,
) {
  const px = scale.sx(s.position.x)
  const py = scale.sy(vOf(s.position, view))
  const ref = Math.max(Math.abs(s.forces.gravity.y), 1e-9)
  const ySign = scale.invert ? -1 : 1

  const vectors: [keyof typeof FORCE_COLORS, Vec3, number][] = [
    ['gravity', s.forces.gravity, 0],
    ['drag', s.forces.drag, 0],
    ['magnus', s.forces.magnus, 0],
    ['coriolis', s.forces.coriolis, 0],
  ]

  for (const [name, f] of vectors) {
    const u = f.x
    const v = vOf(f, view)
    const mag = Math.hypot(u, v)
    if (mag < ref * 1e-9) continue
    let dx = u * scale.kx
    let dy = v * scale.ky * ySign
    const n = Math.hypot(dx, dy)
    if (n === 0) continue
    dx /= n
    dy /= n
    const len = Math.min(Math.max(34 * Math.sqrt(mag / ref), 12), 120)
    arrow(ctx, px, py, px + dx * len, py + dy * len, FORCE_COLORS[name])
  }

  // Velocity, for context: direction of travel on screen.
  const vel = s.velocity
  let vx = vel.x * scale.kx
  let vy = vOf(vel, view) * scale.ky * ySign
  const vn = Math.hypot(vx, vy)
  if (vn > 0) {
    vx /= vn
    vy /= vn
    const len = 22 + 38 * Math.min(s.speed / Math.max(result.summary.muzzleVelocity, 1e-9), 1)
    arrow(ctx, px, py, px + vx * len, py + vy * len, FORCE_COLORS.velocity, true)
  }
}

function arrow(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  thin = false,
) {
  const angle = Math.atan2(y1 - y0, x1 - x0)
  const head = thin ? 6 : 7.5
  ctx.save()
  ctx.lineCap = 'round'
  for (const pass of [0, 1]) {
    ctx.strokeStyle = pass === 0 ? 'rgba(4,6,12,0.7)' : color
    ctx.fillStyle = ctx.strokeStyle
    ctx.lineWidth = pass === 0 ? (thin ? 3.5 : 4.5) : thin ? 1.5 : 2.25
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1 - Math.cos(angle) * head * 0.6, y1 - Math.sin(angle) * head * 0.6)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x1 - head * Math.cos(angle - 0.45), y1 - head * Math.sin(angle - 0.45))
    ctx.lineTo(x1 - head * Math.cos(angle + 0.45), y1 - head * Math.sin(angle + 0.45))
    ctx.closePath()
    if (pass === 0) {
      ctx.lineWidth = 2
      ctx.stroke()
    }
    ctx.fill()
  }
  ctx.restore()
}

/** Wind indicator, top-right of the plot: arrow in the current view's plane plus its speed. */
function drawWindBadge(
  ctx: CanvasRenderingContext2D,
  scale: Scale,
  result: SimulationResult,
  view: ViewMode,
  units: UnitSystem,
) {
  const { config } = result
  if (!config.toggles.wind || config.environment.wind.speed <= 0) return
  const w = windVector(config.environment.wind, config.cannon.azimuth)
  const { plot } = scale
  const cx = plot.left + plot.width - 70
  const cy = plot.top + 22

  ctx.save()
  ctx.fillStyle = 'rgba(8,12,23,0.8)'
  roundRect(ctx, cx - 58, cy - 13, 122, 26, 7)
  ctx.fill()

  const along = w.x
  const across = view === 'side' ? 0 : w.z
  const n = Math.hypot(along, across)
  if (n > 1e-6) {
    const dx = (along / n) * 11
    const dy = (across / n) * 11
    arrow(ctx, cx - 40 - dx, cy - dy, cx - 40 + dx, cy + dy, FORCE_COLORS.wind, true)
  }
  ctx.font = FONT
  ctx.fillStyle = PALETTE.ink200
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const text =
    view === 'side'
      ? `${along >= 0 ? 'tail' : 'head'} ${formatQuantity(units, 'speed', Math.abs(along), { digits: 1 })}`
      : `wind ${formatQuantity(units, 'speed', config.environment.wind.speed, { digits: 1 })}`
  ctx.fillText(text, cx - 24, cy + 0.5)
  ctx.restore()
}
