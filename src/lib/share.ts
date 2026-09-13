import { DEFAULT_CONFIG } from '../data/defaults'
import type { SimulationConfig } from '../physics/simulate'

/** Encode a configuration as URL-safe base64 for the `#c=` hash. */
export function encodeConfig(config: SimulationConfig): string {
  const bytes = new TextEncoder().encode(JSON.stringify(config))
  let binary = ''
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Decode a shared configuration, layering it over the defaults section by section so
 * links made by older versions still load. Anything malformed yields `null`.
 */
export function decodeConfig(encoded: string): SimulationConfig | null {
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<SimulationConfig>
    const d = DEFAULT_CONFIG
    const merged: SimulationConfig = {
      cannon: { ...d.cannon, ...parsed.cannon },
      projectile: { ...d.projectile, ...parsed.projectile },
      propellant: { ...d.propellant, ...parsed.propellant },
      environment: {
        ...d.environment,
        ...parsed.environment,
        wind: { ...d.environment.wind, ...parsed.environment?.wind },
      },
      toggles: { ...d.toggles, ...parsed.toggles },
      integration: { ...d.integration, ...parsed.integration },
    }
    return allFinite(merged) ? merged : null
  } catch {
    return null
  }
}

export function configFromLocation(): SimulationConfig | null {
  const match = window.location.hash.match(/[#&]c=([A-Za-z0-9_-]+)/)
  return match ? decodeConfig(match[1]) : null
}

export function shareUrl(config: SimulationConfig): string {
  const url = new URL(window.location.href)
  url.hash = `c=${encodeConfig(config)}`
  return url.toString()
}

function allFinite(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value)
  if (value && typeof value === 'object') return Object.values(value).every(allFinite)
  return true
}
