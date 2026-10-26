import { CARDS, phaseStarted, type Card } from './cards'

/** Available: in the draw deck or in either hand — the app can't tell which. */
export type CardState = 'available' | 'discarded' | 'removed'
export const CARD_STATES: readonly CardState[] = ['available', 'discarded', 'removed']

export const FIRST_TURN = 1
export const LAST_TURN = 10
/** Entering these turns deals from an exhausted deck: the discard pile is reshuffled into it. */
export const RESHUFFLE_TURNS: readonly number[] = [3, 7]

export interface CardsState {
  turn: number
  /** Only cards that aren't available; a missing id is available. */
  states: Record<number, Exclude<CardState, 'available'>>
  /**
   * What entering each turn after the first did, oldest first (`history[t - 2]` is turn t):
   * the cards its reshuffle brought back. Going back a turn takes them back to the discard pile.
   */
  history: number[][]
}

export type CardsAction =
  | { type: 'setCardState'; id: number; state: CardState }
  | { type: 'nextTurn' }
  | { type: 'previousTurn' }
  /** The deck ran out at an unscheduled moment. */
  | { type: 'reshuffle' }
  /** Takes back a manual reshuffle: the cards it brought back go back to the discard pile. */
  | { type: 'undoReshuffle'; ids: readonly number[] }
  | { type: 'newGame' }

export function newCards(): CardsState {
  return { turn: FIRST_TURN, states: {}, history: [] }
}

export const cardState = (state: CardsState, id: number): CardState => state.states[id] ?? 'available'

/** The cards whose phase has started by this turn, in checklist order. */
export const cardsInPlay = (turn: number): readonly Card[] => CARDS.filter((card) => phaseStarted(card.phase, turn))

/** The cards a reshuffle would bring back now. */
export const discardedIds = (state: CardsState): number[] =>
  cardsInPlay(state.turn)
    .filter((card) => cardState(state, card.id) === 'discarded')
    .map((card) => card.id)

function withStates(state: CardsState, ids: readonly number[], next: CardState): CardsState['states'] {
  const states = { ...state.states }
  for (const id of ids) {
    if (next === 'available') delete states[id]
    else states[id] = next
  }
  return states
}

/** Back to the discard pile — but only cards still available, so a change made since wins. */
function unshuffle(state: CardsState, ids: readonly number[]): CardsState['states'] {
  return withStates(
    state,
    ids.filter((id) => cardState(state, id) === 'available'),
    'discarded',
  )
}

export function cardsReducer(state: CardsState, action: CardsAction): CardsState {
  switch (action.type) {
    case 'setCardState':
      return { ...state, states: withStates(state, [action.id], action.state) }
    case 'nextTurn': {
      if (state.turn >= LAST_TURN) return state
      const turn = state.turn + 1
      const returned = RESHUFFLE_TURNS.includes(turn) ? discardedIds(state) : []
      return { turn, states: withStates(state, returned, 'available'), history: [...state.history, returned] }
    }
    case 'previousTurn': {
      if (state.turn <= FIRST_TURN) return state
      const returned = state.history.at(-1) ?? []
      return { turn: state.turn - 1, states: unshuffle(state, returned), history: state.history.slice(0, -1) }
    }
    case 'reshuffle':
      return { ...state, states: withStates(state, discardedIds(state), 'available') }
    case 'undoReshuffle':
      return { ...state, states: unshuffle(state, action.ids) }
    case 'newGame':
      return newCards()
  }
}

// ---- Persistence -----------------------------------------------------------

export const CARDS_STORAGE_KEY = 'ts-companion:cards:v1'

const KNOWN_IDS = new Set(CARDS.map((card) => card.id))
const isTurn = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= FIRST_TURN && (v as number) <= LAST_TURN
const isIdList = (v: unknown): v is number[] => Array.isArray(v) && v.every((id) => KNOWN_IDS.has(id))

export function isCardsState(value: unknown): value is CardsState {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  const states = s.states
  return (
    isTurn(s.turn) &&
    typeof states === 'object' &&
    states !== null &&
    Object.entries(states).every(([id, v]) => KNOWN_IDS.has(Number(id)) && (v === 'discarded' || v === 'removed')) &&
    Array.isArray(s.history) &&
    s.history.length === s.turn - 1 &&
    s.history.every(isIdList)
  )
}

/** The saved cards, or a fresh deck when nothing usable is stored or storage is unavailable. */
export function loadCards(storage: Storage | undefined = globalThis.localStorage): CardsState {
  try {
    const raw = storage?.getItem(CARDS_STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isCardsState(parsed)) return parsed
    }
  } catch {
    // Private mode, blocked storage or a corrupt entry: start fresh.
  }
  return newCards()
}

export function saveCards(state: CardsState, storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(CARDS_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or unavailable: keep playing in memory.
  }
}
