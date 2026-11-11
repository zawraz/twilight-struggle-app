import { PLAYERS, perPlayer, type PerPlayer, type PlayerId } from './players'

export type Track = 'success' | 'dice'

export interface GameState {
  /** 4 Ops cards played per side. */
  fourOps: PerPlayer<number>
  /** Every confirmed roll per track and side, oldest first. */
  rolls: Record<Track, PerPlayer<number[]>>
  /** End was pressed: summaries are shown and the header offers New Game. */
  ended: boolean
}

export type GameAction =
  | { type: 'incrementFourOps'; player: PlayerId }
  | { type: 'decrementFourOps'; player: PlayerId }
  | { type: 'addRoll'; track: Track; player: PlayerId; value: number }
  /** Takes back a side's newest roll on a track. */
  | { type: 'undoRoll'; track: Track; player: PlayerId }
  | { type: 'end' }
  | { type: 'newGame' }

export function newGame(): GameState {
  return {
    fourOps: perPlayer(() => 0),
    rolls: { success: perPlayer(() => []), dice: perPlayer(() => []) },
    ended: false,
  }
}

/**
 * What a fresh install opens on: no game running, so nothing can be recorded until New Game starts
 * one. Held as an ended game with nothing in it, so the rest of the app needs no state of its own.
 */
export const notStarted = (): GameState => ({ ...newGame(), ended: true })

/** Nothing recorded yet: no rolls and no 4 Ops cards, so an ended game has no results to show. */
export const isBlank = (state: GameState): boolean =>
  Object.values(state.rolls).every((track) => track.ussr.length === 0 && track.us.length === 0) &&
  state.fourOps.ussr === 0 &&
  state.fourOps.us === 0

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'incrementFourOps':
      return { ...state, fourOps: { ...state.fourOps, [action.player]: state.fourOps[action.player] + 1 } }
    case 'decrementFourOps':
      return {
        ...state,
        fourOps: { ...state.fourOps, [action.player]: Math.max(0, state.fourOps[action.player] - 1) },
      }
    case 'addRoll': {
      const track = state.rolls[action.track]
      return {
        ...state,
        rolls: { ...state.rolls, [action.track]: { ...track, [action.player]: [...track[action.player], action.value] } },
      }
    }
    case 'undoRoll': {
      const track = state.rolls[action.track]
      return {
        ...state,
        rolls: { ...state.rolls, [action.track]: { ...track, [action.player]: track[action.player].slice(0, -1) } },
      }
    }
    case 'end':
      return { ...state, ended: true }
    case 'newGame':
      return newGame()
  }
}

// ---- Persistence -----------------------------------------------------------

export const STORAGE_KEY = 'ts-companion:game:v1'

const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0
const isRollList = (v: unknown): v is number[] => Array.isArray(v) && v.every(Number.isFinite)
const isPerPlayer = <T>(v: unknown, check: (x: unknown) => x is T): v is PerPlayer<T> =>
  typeof v === 'object' && v !== null && PLAYERS.every(({ id }) => check((v as Record<string, unknown>)[id]))

export function isGameState(value: unknown): value is GameState {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  const rolls = s.rolls as Record<string, unknown> | null | undefined
  return (
    isPerPlayer(s.fourOps, isCount) &&
    typeof rolls === 'object' &&
    rolls !== null &&
    isPerPlayer(rolls.success, isRollList) &&
    isPerPlayer(rolls.dice, isRollList) &&
    typeof s.ended === 'boolean'
  )
}

/** The saved game, or none running when nothing usable is stored or storage is unavailable. */
export function loadGame(storage: Storage | undefined = globalThis.localStorage): GameState {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isGameState(parsed)) return parsed
    }
  } catch {
    // Private mode, blocked storage or a corrupt entry: start fresh.
  }
  return notStarted()
}

export function saveGame(state: GameState, storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or unavailable: keep playing in memory.
  }
}
