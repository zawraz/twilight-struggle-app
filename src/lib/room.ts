import {
  ASK_NOT,
  cardsReducer,
  discardedIds,
  EVENT_CARDS,
  EVENT_PICKS,
  FIRST_TURN,
  isCardsState,
  LAST_TURN,
  newCards,
  pickableIds,
  TEHRAN,
  type CardsAction,
  type CardsState,
  type CardState,
  type EventCard,
} from './cardGame'
import { CARDS } from './cards'
import { gameReducer, isGameState, newGame, type GameAction, type GameState, type Track } from './game'
import type { PlayerId } from './players'

/**
 * One move in the room, from either device: the header shows the last one, with a way to take it back.
 *
 * A card's `before` is the whole card game from just before it, so taking it back also restores a
 * card's in-hand mark; it is null once the move can't be taken back. The other moves are taken back
 * by their opposite while `armed`.
 */
export type Move =
  | { type: 'roll'; track: Track; player: PlayerId; value: number; armed: boolean }
  /** The Dziennik's 4 Ops count moved by hand. */
  | { type: 'fourOps'; player: PlayerId; by: 1 | -1; armed: boolean }
  /** A new turn: `turn` is the one entered. */
  | { type: 'turn'; turn: number; armed: boolean }
  | { type: 'card'; id: number; state: CardState; by: PlayerId | null; before: CardsState | null }
  | {
      type: 'event'
      id: EventCard
      /** What the event's picker took. */
      picked: number[]
      /** How many cards a reshuffle during the event brought back. */
      back: number
      /** Ask Not's 4 Ops discards, counted for the USA. */
      usFourOps: number
      by: PlayerId | null
      before: CardsState | null
    }

/** The moves the room keeps: the last two can be taken back, the one before them is only shown. */
export const KEPT_MOVES = 3
const UNDOABLE_MOVES = 2

/**
 * A game: everything both phones see and change. The server keeps the one online game and
 * runs every action through the same reducers the app uses, so the phones always agree.
 */
export interface RoomState {
  game: GameState
  cards: CardsState
  /** The last moves, oldest first. */
  moves: Move[]
}

export type RoomAction =
  | { target: 'game'; action: GameAction }
  | { target: 'cards'; action: CardsAction }
  /** A card changes state; a 4 Ops card names the side that played it, counted in the log. */
  | { target: 'play'; id: number; state: CardState; by: PlayerId | null }
  /** Closes the waiting event's picker with what it picked. */
  | { target: 'resolve'; picked: number[] }
  /** Takes the last move back. */
  | { target: 'undoLast' }

export const newRoom = (): RoomState => ({ game: newGame(), cards: newCards(), moves: [] })

const isArmed = (move: Move): boolean => (move.type === 'card' || move.type === 'event' ? move.before !== null : move.armed)

/** The move can no longer be taken back; a card's snapshot goes with it. */
const disarm = (move: Move): Move =>
  move.type === 'card' || move.type === 'event' ? { ...move, before: null } : { ...move, armed: false }

/** Whether the last move can be taken back now: a roll or a count not once the game has ended. */
export function canUndo({ game, moves }: Pick<RoomState, 'game' | 'moves'>): boolean {
  const last = moves.at(-1)
  if (!last || !isArmed(last)) return false
  return !(game.ended && (last.type === 'roll' || last.type === 'fourOps'))
}

/** A new last move: the oldest kept drops out of reach of undo, and the one before it out of the list. */
function push(moves: readonly Move[], move: Move): Move[] {
  const kept = [...moves, move].slice(-KEPT_MOVES)
  return kept.map((m, i) => (i < kept.length - UNDOABLE_MOVES ? disarm(m) : m))
}

/** The newest kept move matching, taken out of the list; null when none does. */
function without(moves: readonly Move[], matches: (move: Move) => boolean): { at: number; moves: Move[] } | null {
  let at = moves.length - 1
  while (at >= 0 && !matches(moves[at])) at--
  return at < 0 ? null : { at, moves: [...moves.slice(0, at), ...moves.slice(at + 1)] }
}

const valueOf = (id: number) => CARDS.find((card) => card.id === id)?.value ?? 0

function moveFourOps(game: GameState, player: PlayerId | null, times: number, by: 1 | -1): GameState {
  // Once the game has ended its counts are final.
  if (!player || game.ended) return game
  let next = game
  for (let i = 0; i < times; i++) next = gameReducer(next, { type: by > 0 ? 'incrementFourOps' : 'decrementFourOps', player })
  return next
}

function play(state: RoomState, id: number, cardState: CardState, by: PlayerId | null): RoomState {
  const cards = cardsReducer(state.cards, { type: 'setCardState', id, state: cardState })
  if (cards === state.cards) return state
  const counted = cardState !== 'available' && valueOf(id) === 4 && !state.game.ended ? by : null
  return {
    game: moveFourOps(state.game, counted, 1, 1),
    cards,
    moves: push(state.moves, { type: 'card', id, state: cardState, by: counted, before: state.cards }),
  }
}

function resolve(state: RoomState, picked: readonly number[]): RoomState {
  const { cards } = state
  const event = cards.pending
  if (event === null) return state
  const allowed = pickableIds(cards)
  const picks = picked.filter((id) => allowed.includes(id)).slice(0, EVENT_PICKS[event])
  const n = picks.length
  const back =
    event === TEHRAN ? cards.eventReturned.length : event === ASK_NOT && cards.deck < n ? discardedIds(cards).length + n : 0
  // Ask Not's discards come from the US hand: each 4 Ops card among them counts as one the US played.
  const usFourOps = event === ASK_NOT && !state.game.ended ? picks.filter((id) => valueOf(id) === 4).length : 0
  // The event's play becomes the event: one move, taken back whole. Nothing else moves while its
  // picker is open, so the play is still the last move unless the game came from an older save.
  const last = state.moves.at(-1)
  const played = last?.type === 'card' && last.id === event ? last : null
  const move: Move = {
    type: 'event',
    id: event,
    picked: picks,
    back,
    usFourOps,
    by: played?.by ?? null,
    before: played?.before ?? null,
  }
  return {
    game: moveFourOps(state.game, 'us', usFourOps, 1),
    cards: cardsReducer(cards, { type: 'resolveEvent', picked: picks }),
    moves: played ? [...state.moves.slice(0, -1), move] : push(state.moves, move),
  }
}

/** A move on the Dziennik: rolls and 4 Ops counts become the last move. */
function gameMove(state: RoomState, action: GameAction): RoomState {
  const game = gameReducer(state.game, action)
  switch (action.type) {
    case 'addRoll': {
      const move: Move = { type: 'roll', track: action.track, player: action.player, value: action.value, armed: true }
      return { ...state, game, moves: push(state.moves, move) }
    }
    case 'incrementFourOps':
    case 'decrementFourOps': {
      // At zero there is nothing to take away: not a move.
      if (game.fourOps[action.player] === state.game.fourOps[action.player]) return state
      const by = action.type === 'incrementFourOps' ? 1 : -1
      return { ...state, game, moves: push(state.moves, { type: 'fourOps', player: action.player, by, armed: true }) }
    }
    case 'undoRoll': {
      // The roll's own undo button took it back: it is no longer there to take back again.
      const taken = without(state.moves, (m) => m.type === 'roll' && m.track === action.track && m.player === action.player)
      return { ...state, game, moves: taken?.moves ?? state.moves }
    }
    case 'end':
      return { ...state, game }
    case 'newGame':
      return { ...state, game, moves: [] }
  }
}

/** A move on the Karty tab. */
function cardsMove(state: RoomState, action: CardsAction): RoomState {
  switch (action.type) {
    case 'setCardState':
      return play(state, action.id, action.state, null)
    case 'resolveEvent':
      return resolve(state, action.picked)
    case 'newGame':
    case 'restore':
      return { ...state, cards: cardsReducer(state.cards, action), moves: [] }
    case 'nextTurn': {
      const cards = cardsReducer(state.cards, action)
      if (cards === state.cards) return state
      return { ...state, cards, moves: push(state.moves, { type: 'turn', turn: cards.turn, armed: true }) }
    }
    case 'previousTurn': {
      const cards = cardsReducer(state.cards, action)
      if (cards === state.cards) return state
      // Gone back with the turn button: the moves made since on that turn can't be taken back cleanly.
      const taken = without(state.moves, (m) => m.type === 'turn')
      const moves = taken ? taken.moves.map((m, i) => (i >= taken.at ? disarm(m) : m)) : state.moves
      return { ...state, cards, moves }
    }
  }
}

function undoLast(state: RoomState): RoomState {
  const last = state.moves.at(-1)
  if (!last || !canUndo(state)) return state
  const moves = state.moves.slice(0, -1)
  switch (last.type) {
    case 'roll':
      return { ...state, game: gameReducer(state.game, { type: 'undoRoll', track: last.track, player: last.player }), moves }
    case 'fourOps': {
      const type = last.by > 0 ? 'decrementFourOps' : 'incrementFourOps'
      return { ...state, game: gameReducer(state.game, { type, player: last.player }), moves }
    }
    case 'turn':
      return { ...state, cards: cardsReducer(state.cards, { type: 'previousTurn' }), moves }
    case 'card':
    case 'event': {
      let game = moveFourOps(state.game, last.by, 1, -1)
      if (last.type === 'event') game = moveFourOps(game, 'us', last.usFourOps, -1)
      return { game, cards: last.before!, moves }
    }
  }
}

export function roomReducer(state: RoomState, action: RoomAction): RoomState {
  switch (action.target) {
    case 'game':
      return gameMove(state, action.action)
    case 'cards':
      return cardsMove(state, action.action)
    case 'play':
      return play(state, action.id, action.state, action.by)
    case 'resolve':
      return resolve(state, action.picked)
    case 'undoLast':
      return undoLast(state)
  }
}

// ---- Validation ------------------------------------------------------------

const KNOWN_IDS = new Set(CARDS.map((card) => card.id))
const STATES: readonly unknown[] = ['available', 'in_play', 'discarded', 'removed'] satisfies CardState[]
const isPlayerOrNull = (v: unknown) => v === null || v === 'ussr' || v === 'us'
const isCount = (v: unknown) => Number.isInteger(v) && (v as number) >= 0

export function isMove(value: unknown): value is Move {
  if (typeof value !== 'object' || value === null) return false
  const a = value as Record<string, unknown>
  const isPlayer = a.player === 'ussr' || a.player === 'us'
  const armed = typeof a.armed === 'boolean'
  switch (a.type) {
    case 'roll':
      return (a.track === 'success' || a.track === 'dice') && isPlayer && Number.isInteger(a.value) && armed
    case 'fourOps':
      return isPlayer && (a.by === 1 || a.by === -1) && armed
    case 'turn':
      return Number.isInteger(a.turn) && (a.turn as number) > FIRST_TURN && (a.turn as number) <= LAST_TURN && armed
  }
  if (!isPlayerOrNull(a.by) || !(a.before === null || isCardsState(a.before))) return false
  if (a.type === 'card') return KNOWN_IDS.has(a.id as number) && STATES.includes(a.state)
  if (a.type === 'event') {
    return (
      EVENT_CARDS.includes(a.id as number) &&
      Array.isArray(a.picked) &&
      a.picked.every((id) => KNOWN_IDS.has(id)) &&
      isCount(a.back) &&
      isCount(a.usFourOps)
    )
  }
  return false
}

const isMoves = (v: unknown): v is Move[] => Array.isArray(v) && v.length <= KEPT_MOVES && v.every(isMove)

export const isRoomState = (value: unknown): value is RoomState => {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  return isGameState(s.game) && isCardsState(s.cards) && isMoves(s.moves)
}

// ---- Persistence -----------------------------------------------------------

export const MOVES_STORAGE_KEY = 'ts-companion:moves:v1'

export function loadMoves(storage: Storage | undefined = globalThis.localStorage): Move[] {
  try {
    const raw = storage?.getItem(MOVES_STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return isMoves(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveMoves(moves: readonly Move[], storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(MOVES_STORAGE_KEY, JSON.stringify(moves))
  } catch {
    // Storage full or unavailable: keep playing in memory.
  }
}
