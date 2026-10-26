import { CARDS, phaseStarted, type Card } from './cards'

/** Available: in the draw deck or in either hand — the app can't tell which. */
export type CardState = 'available' | 'discarded' | 'removed'
export const CARD_STATES: readonly CardState[] = ['available', 'discarded', 'removed']

export const FIRST_TURN = 1
export const LAST_TURN = 10

/** Both hands together, as dealt at the start of a turn. */
export const handSize = (turn: number): number => (turn <= 3 ? 16 : 18)

export const SALT = 43
export const ASK_NOT = 77
export const TEHRAN = 108
/** Cards whose event the app follows up with a picker. */
export type EventCard = typeof SALT | typeof ASK_NOT | typeof TEHRAN
const EVENT_CARDS: readonly number[] = [SALT, ASK_NOT, TEHRAN]

/** What entering a turn did, so going back can take it back. */
export interface TurnEntry {
  /** The cards its reshuffle brought back. */
  returned: number[]
  /** The cards its reshuffle marked in hand. */
  marked: number[]
  /** The deck when the turn before was left; null in games saved before the deck was tracked. */
  deck: number | null
}

export interface CardsState {
  turn: number
  /** Only cards that aren't available; a missing id is available. */
  states: Record<number, Exclude<CardState, 'available'>>
  /** Available cards a reshuffle showed must be in one hand or the other. */
  inHand: number[]
  /** Cards in the draw deck. */
  deck: number
  /** An event card just played, waiting for its picker. */
  pending: EventCard | null
  /** What entering each turn after the first did, oldest first (`history[t - 2]` is turn t). */
  history: TurnEntry[]
}

export type CardsAction =
  | { type: 'setCardState'; id: number; state: CardState }
  | { type: 'nextTurn' }
  | { type: 'previousTurn' }
  | { type: 'newGame' }

export function newCards(): CardsState {
  return { turn: FIRST_TURN, states: {}, inHand: [], deck: cardsInPlay(FIRST_TURN).length - handSize(FIRST_TURN), pending: null, history: [] }
}

export const cardState = (state: CardsState, id: number): CardState => state.states[id] ?? 'available'
export const isInHand = (state: CardsState, id: number): boolean => state.inHand.includes(id)

/** The cards whose phase has started by this turn, in checklist order. */
export const cardsInPlay = (turn: number): readonly Card[] => CARDS.filter((card) => phaseStarted(card.phase, turn))

const idsIn = (state: CardsState, wanted: CardState): number[] =>
  cardsInPlay(state.turn)
    .filter((card) => cardState(state, card.id) === wanted)
    .map((card) => card.id)

/** The cards a reshuffle would bring back now. */
export const discardedIds = (state: CardsState): number[] => idsIn(state, 'discarded')
export const availableIds = (state: CardsState): number[] => idsIn(state, 'available')

/** The deck a turn starts with: what's available once both hands are dealt. */
const dealtDeck = (state: CardsState): number => Math.max(0, availableIds(state).length - handSize(state.turn))

/** Whether entering the next turn finds a deck that can't cover the deal. */
export function entersWithReshuffle(state: CardsState): boolean {
  if (state.turn >= LAST_TURN) return false
  const entered = { ...state, turn: state.turn + 1 }
  return availableIds(entered).length <= handSize(entered.turn)
}

/** Cards that leave the hands — discarded or removed — lose their in-hand mark. */
function withStates(state: CardsState, ids: readonly number[], next: CardState): CardsState {
  const states = { ...state.states }
  for (const id of ids) {
    if (next === 'available') delete states[id]
    else states[id] = next
  }
  const inHand = next === 'available' ? state.inHand : state.inHand.filter((id) => !ids.includes(id))
  return { ...state, states, inHand }
}

/** Back to the discard pile — but only cards still available, so a change made since wins. */
function unshuffle(state: CardsState, ids: readonly number[]): CardsState {
  return withStates(
    state,
    ids.filter((id) => cardState(state, id) === 'available'),
    'discarded',
  )
}

const isPermanent = (id: number) => CARDS.find((card) => card.id === id)?.isPermanent ?? false

export function cardsReducer(state: CardsState, action: CardsAction): CardsState {
  switch (action.type) {
    case 'setCardState':
      // Only cards with an asterisk leave the game.
      if (action.state === 'removed' && !isPermanent(action.id)) return state
      return withStates(state, [action.id], action.state)
    case 'nextTurn': {
      if (state.turn >= LAST_TURN) return state
      const entered = { ...state, turn: state.turn + 1 }
      const reshuffles = entersWithReshuffle(state)
      const returned = reshuffles ? discardedIds(entered) : []
      // Everything available before the reshuffle gets dealt out before the new deck is touched.
      const marked = reshuffles ? availableIds(entered).filter((id) => !isInHand(state, id)) : []
      const after = withStates(entered, returned, 'available')
      return {
        ...after,
        inHand: [...after.inHand, ...marked],
        deck: dealtDeck(after),
        history: [...state.history, { returned, marked, deck: state.deck }],
      }
    }
    case 'previousTurn': {
      if (state.turn <= FIRST_TURN) return state
      const entry = state.history.at(-1)!
      const back = unshuffle({ ...state, turn: state.turn - 1 }, entry.returned)
      const left = { ...back, inHand: back.inHand.filter((id) => !entry.marked.includes(id)), history: state.history.slice(0, -1) }
      return { ...left, deck: entry.deck ?? dealtDeck(left) }
    }
    case 'newGame':
      return newCards()
  }
}

// ---- Persistence -----------------------------------------------------------

export const CARDS_STORAGE_KEY = 'ts-companion:cards:v1'

const KNOWN_IDS = new Set(CARDS.map((card) => card.id))
const isTurn = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= FIRST_TURN && (v as number) <= LAST_TURN
const isIdList = (v: unknown): v is number[] => Array.isArray(v) && v.every((id) => KNOWN_IDS.has(id))

const isStates = (v: unknown): v is CardsState['states'] =>
  typeof v === 'object' &&
  v !== null &&
  Object.entries(v).every(([id, state]) => KNOWN_IDS.has(Number(id)) && (state === 'discarded' || state === 'removed'))
const isTurnEntry = (v: unknown): v is TurnEntry => {
  if (typeof v !== 'object' || v === null) return false
  const e = v as Record<string, unknown>
  return isIdList(e.returned) && isIdList(e.marked) && (e.deck === null || isCount(e.deck))
}
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0

export function isCardsState(value: unknown): value is CardsState {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  return (
    isTurn(s.turn) &&
    isStates(s.states) &&
    isIdList(s.inHand) &&
    isCount(s.deck) &&
    (s.pending === null || EVENT_CARDS.includes(s.pending as number)) &&
    Array.isArray(s.history) &&
    s.history.length === s.turn - 1 &&
    s.history.every(isTurnEntry)
  )
}

/** A game saved before the deck was tracked: history held only what each reshuffle brought back. */
function fromLegacy(value: unknown): CardsState | null {
  if (typeof value !== 'object' || value === null) return null
  const s = value as Record<string, unknown>
  if (!isTurn(s.turn) || !isStates(s.states) || !Array.isArray(s.history)) return null
  if (s.history.length !== s.turn - 1 || !s.history.every(isIdList)) return null
  const state: CardsState = {
    turn: s.turn,
    states: s.states,
    inHand: [],
    deck: 0,
    pending: null,
    history: s.history.map((returned) => ({ returned, marked: [], deck: null })),
  }
  return { ...state, deck: dealtDeck(state) }
}

/** The saved cards, or a fresh deck when nothing usable is stored or storage is unavailable. */
export function loadCards(storage: Storage | undefined = globalThis.localStorage): CardsState {
  try {
    const raw = storage?.getItem(CARDS_STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isCardsState(parsed)) return parsed
      const legacy = fromLegacy(parsed)
      if (legacy) return legacy
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
