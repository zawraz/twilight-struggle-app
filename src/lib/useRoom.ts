import { useEffect, useReducer, useState } from 'react'
import { loadCards, saveCards, type CardsAction, type CardsState } from './cardGame'
import { loadGame, saveGame, type GameAction, type GameState } from './game'
import { loadMoves, newRoom, roomReducer, saveMoves, type Move, type RoomAction, type RoomState } from './room'
import type { OnlineGame, SyncServer } from './syncServer'

/** Offline: the game lives on this phone alone. Online: it is the one game both phones share. */
export type SyncMode = 'online' | 'offline'

export const SYNC_MODE_KEY = 'ts-companion:sync-mode:v1'

export interface RoomSync {
  mode: SyncMode
  /** Online only: the online game has loaded, so changes go through. Until then the last game seen is shown, read-only. */
  live: boolean
  /** Online only: reaching the server right now; while not, changes wait and go through once it is back. */
  connected: boolean
  /** Online only: the server answered that there is no online game. */
  missing: boolean
  /** A fresh game in this mode: online replaces the online game, offline leaves it alone. */
  newGame: (mode: SyncMode) => void
  /** Replaces this phone's game with the online one, for good, and goes online. */
  join: (game: OnlineGame) => void
  /** Stops syncing, keeping the game on screen. */
  leave: () => void
  server: SyncServer
}

export interface Room {
  game: GameState
  dispatch: (action: GameAction) => void
  cards: CardsState
  dispatchCards: (action: CardsAction) => void
  /** The last moves, oldest first, with what taking them back needs. */
  moves: Move[]
  /** Plays a card, closes an event's picker or takes the last move back. */
  act: (action: RoomAction) => void
  /** Null when the app runs without a sync server: the game stays on this phone. */
  sync: RoomSync | null
}

function loadMode(): SyncMode {
  try {
    return localStorage.getItem(SYNC_MODE_KEY) === 'online' ? 'online' : 'offline'
  } catch {
    return 'offline'
  }
}

function saveMode(mode: SyncMode): void {
  try {
    localStorage.setItem(SYNC_MODE_KEY, mode)
  } catch {
    // Storage unavailable: the mode lasts until the app is closed.
  }
}

/** The game kept on this phone: the whole game offline, the last one seen online. */
const loadRoom = (): RoomState => ({ game: loadGame(), cards: loadCards(), moves: loadMoves() })

function saveRoom(state: RoomState): void {
  saveGame(state.game)
  saveCards(state.cards)
  saveMoves(state.moves)
}

type LocalAction = RoomAction | { target: 'replace'; state: RoomState }

const localReducer = (state: RoomState, action: LocalAction): RoomState =>
  action.target === 'replace' ? action.state : roomReducer(state, action)

/**
 * The game on screen and how to change it. One local game is always what is shown: offline it is
 * changed here; online every answer from the server replaces it, so turning sync off keeps it as is.
 */
export function useRoom(server: SyncServer | null): Room {
  const [state, local] = useReducer(localReducer, undefined, loadRoom)
  const [storedMode, setMode] = useState<SyncMode>(loadMode)
  const mode: SyncMode = server ? storedMode : 'offline'
  const [live, setLive] = useState(false)
  const [missing, setMissing] = useState(false)
  const [connected, setConnected] = useState(false)

  useEffect(() => saveRoom(state), [state])
  useEffect(() => {
    if (server) saveMode(storedMode)
  }, [server, storedMode])

  useEffect(() => {
    if (!server || mode !== 'online') return
    const stop = server.watch({
      onGame: (game) => {
        setLive(game !== null)
        setMissing(game === null)
        if (game) local({ target: 'replace', state: game.state })
      },
      onConnected: setConnected,
    })
    return () => {
      stop()
      setLive(false)
      setMissing(false)
    }
  }, [server, mode])

  const act = (action: RoomAction) => {
    if (!server || mode === 'offline') return local(action)
    if (!live) return
    server.dispatch(action).catch((error: unknown) => console.error('Change not saved', error))
  }

  return {
    game: state.game,
    dispatch: (action) => act({ target: 'game', action }),
    cards: state.cards,
    dispatchCards: (action) => act({ target: 'cards', action }),
    moves: state.moves,
    act,
    sync: server && {
      mode,
      live,
      connected,
      missing,
      newGame: (next) => {
        local({ target: 'replace', state: newRoom() })
        setMode(next)
        if (next === 'online') server.start().catch((error: unknown) => console.error('Could not start the online game', error))
      },
      join: (game) => {
        local({ target: 'replace', state: game.state })
        setMode('online')
      },
      leave: () => setMode('offline'),
      server,
    },
  }
}
