import { ConvexReactClient } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { newRoom, roomReducer } from './room'
import type { OnlineGame, SyncListener, SyncServer } from './syncServer'

/**
 * The sync server on Convex. The client is made on first use, not when the app loads (it
 * connects as soon as it exists), and closed once nothing watches, so an offline phone stays off it.
 */
export function convexServer(url: string): SyncServer {
  let client: ConvexReactClient | null = null
  let watchers = 0
  let closing: ReturnType<typeof setTimeout> | null = null

  function open(): ConvexReactClient {
    if (closing) {
      clearTimeout(closing)
      closing = null
    }
    // No "Leave site?" prompt: a closed client keeps its unload listener, and would ask for ever
    // about a change it can no longer send.
    client ??= new ConvexReactClient(url, { unsavedChangesWarning: false })
    return client
  }

  function release() {
    watchers--
    if (watchers > 0) return
    // On the next tick, so a remount (StrictMode, a panel reopened) keeps the same connection.
    closing = setTimeout(() => {
      closing = null
      if (watchers > 0 || !client) return
      void client.close()
      client = null
    }, 0)
  }

  return {
    watch({ onGame, onConnected }: SyncListener) {
      const c = open()
      watchers++
      const query = c.watchQuery(api.game.get, {})
      const report = () => {
        let game: OnlineGame | null | undefined
        try {
          game = query.localQueryResult()
        } catch (error) {
          console.error('Could not read the online game', error)
          return
        }
        if (game !== undefined) onGame(game)
      }
      const stopQuery = query.onUpdate(report)
      report()
      const stopConnection = c.subscribeToConnectionState((s) => onConnected(s.isWebSocketConnected))
      onConnected(c.connectionState().isWebSocketConnected)
      let stopped = false
      return () => {
        if (stopped) return
        stopped = true
        stopQuery()
        stopConnection()
        release()
      }
    },
    async start() {
      await open().mutation(api.game.start, {}, {
        optimisticUpdate: (store) => store.setQuery(api.game.get, {}, { state: newRoom(), updatedAt: Date.now() }),
      })
    },
    async dispatch(action) {
      await open().mutation(api.game.dispatch, { action }, {
        optimisticUpdate: (store) => {
          const current = store.getQuery(api.game.get, {})
          if (current) store.setQuery(api.game.get, {}, { state: roomReducer(current.state, action), updatedAt: Date.now() })
        },
      })
    },
  }
}

const url = import.meta.env.VITE_CONVEX_URL as string | undefined

/** The app's sync server; null in a build without one (tests, local dev), where games stay on the phone. */
export const defaultServer: SyncServer | null = url ? convexServer(url) : null
