import type { RoomAction, RoomState } from './room'

/** The one game both phones share, and when it last changed. */
export interface OnlineGame {
  state: RoomState
  updatedAt: number
}

export interface SyncListener {
  /** The online game, or null when there is none; called on every change. */
  onGame: (game: OnlineGame | null) => void
  /** Whether the connection is up right now. */
  onConnected: (connected: boolean) => void
}

/**
 * The sync server, as the app sees it. Nothing connects until something watches, and the
 * connection closes once the last watcher stops: an offline phone never talks to it.
 */
export interface SyncServer {
  /** Starts listening, opening the connection if it is closed. Returns stop. */
  watch: (listener: SyncListener) => () => void
  /** Replaces the online game with a fresh one; shown to watchers at once. */
  start: () => Promise<void>
  /** Applies one action to the online game; shown to watchers at once. */
  dispatch: (action: RoomAction) => Promise<void>
}
