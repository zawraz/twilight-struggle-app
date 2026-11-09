import { useConvexConnectionState, useMutation, useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../convex/_generated/api'
import { loadCards, saveCards, type CardsAction, type CardsState } from './cardGame'
import { convex } from './convex'
import { loadGame, saveGame, type GameAction, type GameState } from './game'
import { makeRoomCode, normalizeRoomCode, roomReducer, type RoomAction, type RoomState } from './room'
import { useCards } from './useCards'
import { useGame } from './useGame'

export interface RoomSync {
  /** The room this device plays in; another device joins it with this code or its link. */
  code: string
  /** The room's game has loaded: changes go through. Until then the last game seen is shown, read-only. */
  live: boolean
  /** Reaching the server right now; while not, changes wait and go through once it is back. */
  connected: boolean
  /** Moves this device to another room; false when the code can't be one. */
  join: (code: string) => boolean
}

export interface Room {
  game: GameState
  dispatch: (action: GameAction) => void
  cards: CardsState
  dispatchCards: (action: CardsAction) => void
  /** Null when the app runs without a sync server: the game stays on this device. */
  sync: RoomSync | null
}

export const ROOM_KEY = 'ts-companion:room:v1'
const ROOM_PARAM = 'room'

/** The link that opens the app in this room. */
export function roomLink(code: string): string {
  const url = new URL('/', window.location.origin)
  url.searchParams.set(ROOM_PARAM, code)
  return url.toString()
}

function loadRoomCode(): string | null {
  try {
    return normalizeRoomCode(localStorage.getItem(ROOM_KEY) ?? '')
  } catch {
    return null
  }
}

function saveRoomCode(code: string): void {
  try {
    localStorage.setItem(ROOM_KEY, code)
  } catch {
    // Storage unavailable: the room lasts until the app is closed.
  }
}

/** A code from an opened room link, taken out of the address so a reload doesn't undo a later join. */
function takeLinkCode(): string | null {
  const url = new URL(window.location.href)
  const raw = url.searchParams.get(ROOM_PARAM)
  if (raw === null) return null
  url.searchParams.delete(ROOM_PARAM)
  window.history.replaceState(window.history.state, '', url)
  return normalizeRoomCode(raw)
}

/** The opened link's room, else the one this device was in, else a new one; remembered for next time. */
function startingCode(): string {
  const code = takeLinkCode() ?? loadRoomCode() ?? makeRoomCode()
  saveRoomCode(code)
  return code
}

function useSyncedRoom(): Room {
  const [code, setCode] = useState(startingCode)
  // The last game seen, kept on the device: shown at once on start and while a room loads.
  const [stored] = useState<RoomState>(() => ({ game: loadGame(), cards: loadCards() }))
  const lastSeen = useRef(stored)
  const remote = useQuery(api.rooms.get, { code })
  const { isWebSocketConnected } = useConvexConnectionState()
  const ensure = useMutation(api.rooms.ensure)
  const send = useMutation(api.rooms.dispatch).withOptimisticUpdate((store, args) => {
    // Shown at once, before the server confirms; the server's answer replaces it.
    const current = store.getQuery(api.rooms.get, { code: args.code })
    if (current) store.setQuery(api.rooms.get, { code: args.code }, roomReducer(current, args.action as RoomAction))
  })

  if (remote) lastSeen.current = remote
  useEffect(() => {
    if (!remote) return
    saveGame(remote.game)
    saveCards(remote.cards)
  }, [remote])

  // A room nobody has opened yet (a new code, or a code typed in) starts from the game on screen.
  const ensured = useRef(new Set<string>())
  useEffect(() => {
    if (remote !== null || ensured.current.has(code)) return
    ensured.current.add(code)
    ensure({ code, state: lastSeen.current }).catch((error: unknown) => {
      ensured.current.delete(code)
      console.error('Could not open the room', error)
    })
  }, [remote, code, ensure])

  const live = remote != null
  const state = remote ?? lastSeen.current
  const dispatchRoom = (action: RoomAction) => {
    if (!live) return
    send({ code, action }).catch((error: unknown) => console.error('Change not saved', error))
  }

  return {
    game: state.game,
    dispatch: (action) => dispatchRoom({ target: 'game', action }),
    cards: state.cards,
    dispatchCards: (action) => dispatchRoom({ target: 'cards', action }),
    sync: {
      code,
      live,
      connected: isWebSocketConnected,
      join: (input) => {
        const next = normalizeRoomCode(input)
        if (!next) return false
        saveRoomCode(next)
        setCode(next)
        return true
      },
    },
  }
}

/** Without a sync server: the game lives in this device's storage, as before rooms. */
function useLocalRoom(): Room {
  const [game, dispatch] = useGame()
  const [cards, dispatchCards] = useCards()
  return { game, dispatch, cards, dispatchCards, sync: null }
}

/** The game on screen and how to change it: shared through a room when the app has a sync server. */
export const useRoom: () => Room = convex ? useSyncedRoom : useLocalRoom
