import { useEffect, useState } from 'react'

/** How long a control stays armed waiting for its confirming tap. */
export const CONFIRM_TIMEOUT_MS = 3000

/**
 * Two-tap confirmation: the first tap arms, the second (within the timeout) acts.
 * Returns whether it is armed, the tap handler, and a way to disarm.
 */
export function useConfirmTap(onConfirm: () => void) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const timer = window.setTimeout(() => setArmed(false), CONFIRM_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [armed])

  const tap = () => {
    if (armed) {
      setArmed(false)
      onConfirm()
    } else {
      setArmed(true)
    }
  }

  return { armed, tap, disarm: () => setArmed(false) }
}
