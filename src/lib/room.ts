import { cardsReducer, isCardsState, newCards, type CardsAction, type CardsState } from './cardGame'
import { gameReducer, isGameState, newGame, type GameAction, type GameState } from './game'

/**
 * A shared game: everything both devices see and change. The server keeps one per room code and
 * runs every action through the same reducers the app uses, so the devices always agree.
 */
export interface RoomState {
  game: GameState
  cards: CardsState
}

export type RoomAction = { target: 'game'; action: GameAction } | { target: 'cards'; action: CardsAction }

export const newRoom = (): RoomState => ({ game: newGame(), cards: newCards() })

export function roomReducer(state: RoomState, { target, action }: RoomAction): RoomState {
  return target === 'game'
    ? { ...state, game: gameReducer(state.game, action) }
    : { ...state, cards: cardsReducer(state.cards, action) }
}

export const isRoomState = (value: unknown): value is RoomState =>
  typeof value === 'object' &&
  value !== null &&
  isGameState((value as Record<string, unknown>).game) &&
  isCardsState((value as Record<string, unknown>).cards)

// ---- Room codes ------------------------------------------------------------

/** No 0/O, 1/I/L or U/V: easy to read out across the table and to type. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTWXYZ23456789'
export const CODE_LENGTH = 5

export function makeRoomCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]
  return code
}

/** The code as typed, tidied up; null when it can't be a room code. */
export function normalizeRoomCode(input: string): string | null {
  const code = input.trim().toUpperCase()
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null
}
