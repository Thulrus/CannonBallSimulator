import type { SimulationResult } from '../physics/simulate'

export interface PinnedShot {
  id: number
  label: string
  color: string
  visible: boolean
  result: SimulationResult
}

/** Evenly thin a series to at most `max` items, always keeping the first and last. */
export function downsample<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items
  const step = (items.length - 1) / (max - 1)
  const out: T[] = []
  for (let i = 0; i < max; i++) out.push(items[Math.round(i * step)])
  return out
}

export function downloadText(filename: string, text: string, mime = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

export const percent = (fraction: number, digits = 1) => `${(fraction * 100).toFixed(digits)}%`
