import { useEffect, useState } from 'react'

/**
 * `true` only once `flag` has stayed true for `delay` ms. Most shots finish in a few
 * milliseconds, and flashing an indicator for those would be noisier than the wait.
 */
export function useDelayedFlag(flag: boolean, delay: number): boolean {
  const [elapsed, setElapsed] = useState(false)

  useEffect(() => {
    if (!flag) return
    const id = window.setTimeout(() => setElapsed(true), delay)
    return () => {
      window.clearTimeout(id)
      setElapsed(false)
    }
  }, [flag, delay])

  // Derived rather than stored, so the indicator hides the instant `flag` drops.
  return flag && elapsed
}
