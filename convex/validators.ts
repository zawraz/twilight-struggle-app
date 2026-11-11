import { v, type Infer } from 'convex/values'
import type { CardsAction, CardsState } from '../src/lib/cardGame'
import type { GameAction, GameState } from '../src/lib/game'
import type { Move, RoomAction, RoomState } from '../src/lib/room'

// The shapes of the app's game and actions, for the schema and the functions' arguments. They only
// check the shape; what a game may hold (known card ids, turn range…) is checked by the app's own
// `isRoomState`, which `dispatch` still runs on its result.

const player = v.union(v.literal('ussr'), v.literal('us'))
const perPlayer = <T extends Parameters<typeof v.array>[0]>(value: T) => v.object({ ussr: value, us: value })
const track = v.union(v.literal('success'), v.literal('dice'))
const cardState = v.union(v.literal('available'), v.literal('in_play'), v.literal('discarded'), v.literal('removed'))
const eventCard = v.union(v.literal(43), v.literal(77), v.literal(108), v.literal(26), v.literal(62), v.literal(98))
const ids = v.array(v.number())

export const gameState = v.object({
  fourOps: perPlayer(v.number()),
  rolls: v.object({ success: perPlayer(ids), dice: perPlayer(ids) }),
  ended: v.boolean(),
})

export const cardsState = v.object({
  turn: v.number(),
  // Keyed by card id; only cards that aren't available.
  states: v.record(v.string(), v.union(v.literal('in_play'), v.literal('discarded'), v.literal('removed'))),
  inHand: ids,
  deck: v.number(),
  pending: v.union(eventCard, v.null()),
  eventReturned: ids,
  history: v.array(v.object({ returned: ids, marked: ids, deck: v.union(v.number(), v.null()) })),
})

const before = v.union(cardsState, v.null())

export const move = v.union(
  v.object({ type: v.literal('roll'), track, player, value: v.number(), armed: v.boolean() }),
  v.object({ type: v.literal('fourOps'), player, by: v.union(v.literal(1), v.literal(-1)), armed: v.boolean() }),
  v.object({ type: v.literal('turn'), turn: v.number(), armed: v.boolean() }),
  v.object({ type: v.literal('card'), id: v.number(), state: cardState, by: v.union(player, v.null()), before }),
  v.object({
    type: v.literal('event'),
    id: eventCard,
    picked: ids,
    back: v.number(),
    usFourOps: v.number(),
    by: v.union(player, v.null()),
    before,
  }),
)

export const moves = v.array(move)

const gameAction = v.union(
  v.object({ type: v.literal('incrementFourOps'), player }),
  v.object({ type: v.literal('decrementFourOps'), player }),
  v.object({ type: v.literal('addRoll'), track, player, value: v.number() }),
  v.object({ type: v.literal('undoRoll'), track, player }),
  v.object({ type: v.literal('end') }),
  v.object({ type: v.literal('newGame') }),
)

const cardsAction = v.union(
  v.object({ type: v.literal('setCardState'), id: v.number(), state: cardState }),
  v.object({ type: v.literal('nextTurn') }),
  v.object({ type: v.literal('previousTurn') }),
  v.object({ type: v.literal('resolveEvent'), picked: ids }),
  v.object({ type: v.literal('restore'), state: cardsState }),
  v.object({ type: v.literal('newGame') }),
)

export const roomAction = v.union(
  v.object({ target: v.literal('game'), action: gameAction }),
  v.object({ target: v.literal('cards'), action: cardsAction }),
  v.object({ target: v.literal('play'), id: v.number(), state: cardState, by: v.union(player, v.null()) }),
  v.object({ target: v.literal('resolve'), picked: ids }),
  v.object({ target: v.literal('undoLast') }),
)

// ---- Kept in step with the app's types -------------------------------------
// Every game the app makes fits the validators, and everything they let through is a game the app
// knows: a change to one side without the other fails the type-check here.

type Both<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const inStep = <T extends true>(): T => true as T

inStep<Both<Infer<typeof gameState>, GameState>>()
inStep<Both<Infer<typeof move>, Move>>()
inStep<Both<Infer<typeof gameAction>, GameAction>>()
inStep<Both<Infer<typeof cardsAction>, CardsAction>>()
inStep<Both<Infer<typeof roomAction>, RoomAction>>()
inStep<Both<{ game: Infer<typeof gameState>; cards: Infer<typeof cardsState>; moves: Infer<typeof moves> }, RoomState>>()
inStep<Both<Infer<typeof cardsState>, CardsState>>()
