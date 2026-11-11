import { newRoom, roomReducer, type RoomAction } from '../lib/room'
import type { OnlineGame, SyncListener, SyncServer } from '../lib/syncServer'

export interface FakeServer extends SyncServer {
  game: OnlineGame | null
  /** Some listener is watching: the connection is open. */
  open: boolean
  /** How many times the connection went from closed to open. */
  opens: number
  setConnected: (up: boolean) => void
  /** What the other phone would do: replaces the online game. */
  replace: (game: OnlineGame | null) => void
  /** Lets held listeners hear the game. */
  release: () => void
}

/**
 * An in-memory sync server that behaves as the Convex client does: changes show at once; while
 * disconnected they wait, reach the game on reconnect, and are dropped once the last watcher stops.
 */
export function fakeServer(initial: OnlineGame | null = null, options: { held?: boolean } = {}): FakeServer {
  const listeners = new Set<SyncListener>()
  let held = options.held ?? false
  let connected = true
  let waiting: RoomAction[] = []

  /** The game as this phone sees it: the server's, with the changes still waiting on top. */
  const shown = (): OnlineGame | null =>
    fake.game && waiting.length > 0
      ? { state: waiting.reduce(roomReducer, fake.game.state), updatedAt: fake.game.updatedAt }
      : fake.game

  const tell = () => {
    if (held) return
    for (const l of listeners) l.onGame(shown())
  }

  const fake: FakeServer = {
    game: initial,
    open: false,
    opens: 0,
    watch(listener) {
      if (listeners.size === 0) {
        fake.open = true
        fake.opens++
      }
      listeners.add(listener)
      listener.onConnected(connected)
      if (!held) listener.onGame(shown())
      return () => {
        listeners.delete(listener)
        if (listeners.size > 0) return
        fake.open = false
        waiting = []
      }
    },
    async start() {
      fake.game = { state: newRoom(), updatedAt: Date.now() }
      tell()
    },
    async dispatch(action: RoomAction) {
      if (!fake.game) throw new Error('No online game')
      if (connected) fake.game = { state: roomReducer(fake.game.state, action), updatedAt: Date.now() }
      else waiting.push(action)
      tell()
    },
    setConnected(up) {
      connected = up
      if (up && fake.game && waiting.length > 0) {
        fake.game = { state: waiting.reduce(roomReducer, fake.game.state), updatedAt: Date.now() }
        waiting = []
        tell()
      }
      for (const l of listeners) l.onConnected(up)
    },
    replace(game) {
      fake.game = game
      tell()
    },
    release() {
      held = false
      tell()
    },
  }
  return fake
}
