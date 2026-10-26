import { cardsReducer, newCards, type CardsAction, type CardsState } from '../lib/cardGame'

export const run = (actions: CardsAction[], from: CardsState = newCards()) => actions.reduce(cardsReducer, from)

/** A game on any turn, as if nothing had happened on the way there. */
export const at = (partial: Partial<CardsState>): CardsState => {
  const turn = partial.turn ?? 1
  return {
    ...newCards(),
    history: Array.from({ length: turn - 1 }, () => ({ returned: [], marked: [], deck: 0 })),
    ...partial,
    turn,
  }
}

export const discarded = (ids: readonly number[]) => Object.fromEntries(ids.map((id) => [id, 'discarded' as const]))
