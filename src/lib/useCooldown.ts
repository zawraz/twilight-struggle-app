import { useEffect, useState } from 'react'

/** A flag that turns itself off `ms` after `start()`, or at once on `cancel()`. */
export function useCooldown(ms: number) {
  const [active, setActive] = useState(false)
  // Bumped on every start, so a restart gets a fresh timer.
  const [run, setRun] = useState(0)

  useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(() => setActive(false), ms)
    return () => window.clearTimeout(timer)
  }, [active, run, ms])

  const start = () => {
    setActive(true)
    setRun((r) => r + 1)
  }

  const cancel = () => setActive(false)

  return [active, start, cancel] as const
}
