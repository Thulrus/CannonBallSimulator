/**
 * Display-unit conversion. The physics is SI end to end; this layer only exists
 * at the edges — slider readouts, stat cards, chart axes.
 */
export type UnitSystem = 'metric' | 'imperial'

export type Quantity =
  | 'distance'
  | 'altitude'
  | 'length'
  | 'diameter'
  | 'speed'
  | 'acceleration'
  | 'mass'
  | 'force'
  | 'energy'
  | 'temperature'
  | 'pressure'
  | 'density'
  | 'angle'
  | 'time'
  | 'rpm'
  | 'percent'
  | 'ratio'

/** `display = si * factor + offset`. Temperatures are stored in °C, so °C is the "SI" side. */
export interface DisplayUnit {
  label: string
  factor: number
  offset: number
}

const u = (label: string, factor = 1, offset = 0): DisplayUnit => ({ label, factor, offset })

const M_PER_MI = 1609.344
const FT_PER_M = 3.280839895
const YD_PER_M = 1.0936133
const LB_PER_KG = 2.20462262
const LBF_PER_N = 0.224808943
const FTLBF_PER_J = 0.737562149

/** Walk an SI-style prefix ladder so big forces and energies stay readable. */
function prefixed(base: string, factor: number, magnitude: number): DisplayUnit {
  const v = Math.abs(magnitude * factor)
  if (v >= 1e10) return u(`G${base}`, factor * 1e-9)
  if (v >= 1e7) return u(`M${base}`, factor * 1e-6)
  if (v >= 1e4) return u(`k${base}`, factor * 1e-3)
  return u(base, factor)
}

/**
 * The unit to show a quantity in. `magnitude` (SI) lets distances switch to km/mi
 * and energies to kJ/MJ once the numbers get unwieldy; omit it for the base unit.
 */
export function displayUnit(system: UnitSystem, q: Quantity, magnitude = 0): DisplayUnit {
  const metric = system === 'metric'
  const big = Math.abs(magnitude) >= 10000
  switch (q) {
    case 'distance':
      if (metric) return big ? u('km', 1e-3) : u('m')
      return big ? u('mi', 1 / M_PER_MI) : u('yd', YD_PER_M)
    case 'altitude':
      if (metric) return big ? u('km', 1e-3) : u('m')
      return big ? u('mi', 1 / M_PER_MI) : u('ft', FT_PER_M)
    case 'length':
      return metric ? u('m') : u('ft', FT_PER_M)
    case 'diameter':
      return metric ? u('mm', 1000) : u('in', 39.3700787)
    case 'speed':
      return metric ? u('m/s') : u('ft/s', FT_PER_M)
    case 'acceleration':
      return metric ? u('m/s²') : u('ft/s²', FT_PER_M)
    case 'mass':
      return metric ? u('kg') : u('lb', LB_PER_KG)
    case 'force':
      return metric ? prefixed('N', 1, magnitude) : prefixed('lbf', LBF_PER_N, magnitude)
    case 'energy':
      return metric ? prefixed('J', 1, magnitude) : prefixed('ft·lbf', FTLBF_PER_J, magnitude)
    case 'temperature':
      return metric ? u('°C') : u('°F', 1.8, 32)
    case 'pressure':
      return metric ? u('hPa', 0.01) : u('inHg', 0.000295299831)
    case 'density':
      return metric ? u('kg/m³') : u('lb/ft³', 0.0624279606)
    case 'angle':
      return u('°')
    case 'time':
      return u('s')
    case 'rpm':
      return u('rpm')
    case 'percent':
      return u('%', 100)
    case 'ratio':
      return u('')
  }
}

export const toDisplay = (unit: DisplayUnit, si: number) => si * unit.factor + unit.offset

export const fromDisplay = (unit: DisplayUnit, display: number) =>
  (display - unit.offset) / unit.factor

export function formatQuantity(
  system: UnitSystem,
  q: Quantity,
  si: number,
  opts: { digits?: number; withUnit?: boolean; magnitude?: number } = {},
): string {
  if (!Number.isFinite(si)) return '—'
  const unit = displayUnit(system, q, opts.magnitude ?? si)
  const text = formatNumber(toDisplay(unit, si), opts.digits)
  if (opts.withUnit === false || !unit.label) return text
  return unit.label === '°' || unit.label === '%' ? `${text}${unit.label}` : `${text} ${unit.label}`
}

/** Enough precision to see a slider move, never a wall of decimals. */
export function formatNumber(value: number, digits?: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  const d =
    digits ??
    (abs === 0 ? 0 : abs >= 1000 ? 0 : abs >= 100 ? 1 : abs >= 1 ? 2 : abs >= 0.01 ? 3 : 4)
  return value.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

/** Compact axis tick label. */
export function formatTick(value: number): string {
  const rounded = Number(value.toPrecision(6))
  return rounded.toLocaleString('en-US', { maximumFractionDigits: 3 })
}

export const roundSig = (v: number, sig: number) => (v === 0 ? 0 : Number(v.toPrecision(sig)))
