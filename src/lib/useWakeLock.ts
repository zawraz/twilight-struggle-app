import { useEffect } from 'react'

/**
 * Keeps the screen on while the app is in front: a game runs for hours between glances at the table.
 * The browser lets go of the lock whenever the app is hidden, so it is taken again each time it comes back.
 * Where the browser has no wake lock, or refuses it (low battery, no user gesture yet), the screen
 * just sleeps as usual; the first tap tries again.
 */
export function useWakeLock(): void {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let stopped = false

    async function request() {
      if (stopped || document.visibilityState !== 'visible' || (lock && !lock.released)) return
      try {
        const next = await navigator.wakeLock.request('screen')
        if (stopped) void next.release()
        else lock = next
      } catch {
        // Refused for now; the next tap or return to the app asks again.
      }
    }

    void request()
    document.addEventListener('visibilitychange', request)
    // Some browsers only grant the lock after the user has touched the page.
    document.addEventListener('pointerdown', request)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', request)
      document.removeEventListener('pointerdown', request)
      void lock?.release()
    }
  }, [])
}
