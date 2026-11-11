import { useEffect, useState } from 'react'
import type { OnlineGame, SyncServer } from './syncServer'

/** How long the panel waits for the server before saying it can't be reached. */
export const CHECK_TIMEOUT_MS = 5000

export type OnlineCheck =
  | { status: 'checking' }
  | { status: 'none' }
  | { status: 'unreachable' }
  | { status: 'found'; game: OnlineGame }

const CHECKING: OnlineCheck = { status: 'checking' }

/**
 * Watches the online game while `enabled`: the people panel's look at it from an offline phone.
 * 'unreachable' when nothing has answered after CHECK_TIMEOUT_MS; a later answer still shows.
 */
export function useOnlineGame(server: SyncServer, enabled: boolean): OnlineCheck {
  const [check, setCheck] = useState<OnlineCheck>(CHECKING)

  useEffect(() => {
    if (!enabled) return
    setCheck(CHECKING)
    let answered = false
    const timer = window.setTimeout(() => {
      if (!answered) setCheck({ status: 'unreachable' })
    }, CHECK_TIMEOUT_MS)
    const stop = server.watch({
      onGame: (game) => {
        answered = true
        setCheck(game ? { status: 'found', game } : { status: 'none' })
      },
      onConnected: () => {},
    })
    return () => {
      window.clearTimeout(timer)
      stop()
    }
  }, [server, enabled])

  return enabled ? check : CHECKING
}
