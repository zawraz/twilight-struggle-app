import { useEffect, useState } from 'react'

/**
 * How long a button that just acted stays disabled, so a double tap doesn't act twice (the act
 * itself is taken back with the undo bar). The flashes that show the act run exactly as long, set
 * from here, so the button comes back just as they fade out.
 */
export const TAP_LOCK_MS = 1000

/**
 * A resting button's class and style: dimmed the moment it is tapped, then easing back to full over
 * the rest, in step with the flashes. Only for a button that rests and is otherwise enabled; one
 * that stays disabled keeps its plain dimmed look.
 */
export const rest = (resting: boolean) =>
  resting
    ? { className: 'animate-rest', style: { animationDuration: `${TAP_LOCK_MS}ms` } }
    : { className: '', style: undefined }

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
