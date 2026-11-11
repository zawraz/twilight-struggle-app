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

/** An in-memory sync server: changes apply at once, as Convex's optimistic updates show them. */
export function fakeServer(initial: OnlineGame | null = null, options: { held?: boolean } = {}): FakeServer {
  const listeners = new Set<SyncListener>()
  let held = options.held ?? false
  let connected = true

  const tell = () => {
    if (held) return
    for (const l of listeners) l.onGame(fake.game)
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
      if (!held) listener.onGame(fake.game)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) fake.open = false
      }
    },
    async start() {
      fake.game = { state: newRoom(), updatedAt: Date.now() }
      tell()
    },
    async dispatch(action: RoomAction) {
      if (!fake.game) throw new Error('No online game')
      fake.game = { state: roomReducer(fake.game.state, action), updatedAt: Date.now() }
      tell()
    },
    setConnected(up) {
      connected = up
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
