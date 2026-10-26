import { describe, expect, it } from 'vitest'
import {
  cardsInPlay,
  cardsReducer,
  cardState,
  CARDS_STORAGE_KEY,
  loadCards,
  newCards,
  saveCards,
  isInHand,
  type CardsAction,
  type CardsState,
} from './cardGame'
import { CARDS } from './cards'

const run = (actions: CardsAction[], from: CardsState = newCards()) => actions.reduce(cardsReducer, from)
const next = (times: number): CardsAction[] => Array.from({ length: times }, () => ({ type: 'nextTurn' }))
const discard = (id: number): CardsAction => ({ type: 'setCardState', id, state: 'discarded' })
const remove = (id: number): CardsAction => ({ type: 'setCardState', id, state: 'removed' })
const discardAll = (ids: readonly number[]) => ids.map(discard)
/** A game on any turn, as if nothing had happened on the way there. */
const at = (partial: Partial<CardsState>): CardsState => {
  const turn = partial.turn ?? 1
  return {
    ...newCards(),
    history: Array.from({ length: turn - 1 }, () => ({ returned: [], marked: [], deck: 0 })),
    ...partial,
    turn,
  }
}

// Blockade and Nasser (early), Arms Race (mid).
const BLOCKADE = 10
const NASSER = 15
const ARMS_RACE = 39
const UN_INTERVENTION = 32
const early = cardsInPlay(1).map((c) => c.id)

describe('card data', () => {
  it('matches the checklist: 39 early, 48 mid and 24 late cards', () => {
    const count = (phase: string) => CARDS.filter((card) => card.phase === phase).length
    expect([count('early'), count('mid'), count('late')]).toEqual([39, 48, 24])
  })

  it('has unique ids, stubs and orders', () => {
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length)
    expect(new Set(CARDS.map((c) => c.stub)).size).toBe(CARDS.length)
    expect(CARDS.map((c) => c.order)).toEqual(CARDS.map((_, i) => i + 1))
  })

  it('has kebab-case stubs', () => {
    for (const card of CARDS) expect(card.stub).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('brings in Mid War on turn 4 and Late War on turn 8', () => {
    expect(cardsInPlay(3)).toHaveLength(39)
    expect(cardsInPlay(4)).toHaveLength(87)
    expect(cardsInPlay(7)).toHaveLength(87)
    expect(cardsInPlay(8)).toHaveLength(111)
  })
})

describe('cardsReducer', () => {
  it('starts on turn 1 with every card available', () => {
    const s = newCards()
    expect(s.turn).toBe(1)
    expect(CARDS.every((card) => cardState(s, card.id) === 'available')).toBe(true)
  })

  it('sets and restores a card state', () => {
    let s = run([discard(BLOCKADE), remove(NASSER)])
    expect(cardState(s, BLOCKADE)).toBe('discarded')
    expect(cardState(s, NASSER)).toBe('removed')
    s = cardsReducer(s, { type: 'setCardState', id: NASSER, state: 'available' })
    expect(cardState(s, NASSER)).toBe('available')
  })

  it('starts with 23 cards in the deck', () => {
    expect(newCards().deck).toBe(23)
  })

  it('does not reshuffle while the deck can cover the deal', () => {
    const s = run([...discardAll(early.slice(0, 22)), ...next(1)])
    expect(cardState(s, early[0])).toBe('discarded')
    expect(s.deck).toBe(1)
    expect(s.inHand).toEqual([])
  })

  it('reshuffles when available cards are no more than both hands, marking the rest in hand', () => {
    const s = run([...discardAll(early.slice(0, 23)), ...next(1)])
    expect(early.slice(0, 23).every((id) => cardState(s, id) === 'available')).toBe(true)
    expect([...s.inHand].sort()).toEqual([...early.slice(23)].sort())
    expect(s.deck).toBe(23)
  })

  it('does not reshuffle when Mid War or Late War cards join', () => {
    const s = run([...next(2), discard(BLOCKADE), ...next(1)])
    expect(s.turn).toBe(4)
    expect(cardState(s, BLOCKADE)).toBe('discarded')
    const late = run([...next(3), discard(ARMS_RACE), ...next(1)], s)
    expect(late.turn).toBe(8)
    expect(cardState(late, ARMS_RACE)).toBe('discarded')
  })

  it('counts both hands as 18 from turn 4, after Mid War joins', () => {
    const s = run([...discardAll(early.slice(0, 34)), ...next(1)], at({ turn: 3 }))
    expect(s.turn).toBe(4)
    expect(cardState(s, early[0])).toBe('discarded')
    expect(s.deck).toBe(35)
    const inPlay = cardsInPlay(4).map((c) => c.id)
    expect(run([...discardAll(inPlay.slice(0, 68)), ...next(1)], at({ turn: 4 })).inHand).toEqual([])
    expect(run([...discardAll(inPlay.slice(0, 69)), ...next(1)], at({ turn: 4 })).inHand).toHaveLength(18)
  })

  it('keeps cards in hand across turns until they are discarded or removed', () => {
    let s = run([...discardAll(early.slice(0, 23)), ...next(2)])
    expect(s.turn).toBe(3)
    const permanent = early.slice(23).find((id) => CARDS.find((c) => c.id === id)!.isPermanent)!
    expect(isInHand(s, early[30])).toBe(true)
    expect(isInHand(s, permanent)).toBe(true)
    s = run([discard(early[30]), remove(permanent)], s)
    expect(isInHand(s, early[30])).toBe(false)
    expect(isInHand(s, permanent)).toBe(false)
  })

  it('going back a turn undoes its reshuffle and marks, restores the deck, keeps changes made since', () => {
    let s = run([...discardAll(early.slice(0, 23)), ...next(1)], at({ deck: 7 }))
    s = run([discard(early[30]), { type: 'previousTurn' }], s)
    expect(s.turn).toBe(1)
    expect(early.slice(0, 23).every((id) => cardState(s, id) === 'discarded')).toBe(true)
    expect(cardState(s, early[30])).toBe('discarded')
    expect(s.inHand).toEqual([])
    expect(s.deck).toBe(7)
  })

  it('goes back several turns, each undoing its own step', () => {
    const start = run(discardAll(early.slice(0, 23)))
    const s = run([...next(7), ...Array.from({ length: 7 }, () => ({ type: 'previousTurn' }) as const)], start)
    expect(s).toEqual(start)
  })

  it('stays within turns 1–10', () => {
    expect(cardsReducer(newCards(), { type: 'previousTurn' }).turn).toBe(1)
    expect(run(next(12)).turn).toBe(10)
  })

  it('can only remove cards with an asterisk', () => {
    const s = run([remove(UN_INTERVENTION)])
    expect(cardState(s, UN_INTERVENTION)).toBe('available')
  })

  it('resets on New Game', () => {
    const s = run([discard(BLOCKADE), ...next(5), { type: 'newGame' }])
    expect(s).toEqual(newCards())
  })
})

describe('card persistence', () => {
  const storage = () => {
    const data = new Map<string, string>()
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    } as unknown as Storage
  }

  it('round-trips through storage', () => {
    const store = storage()
    const s = run([discard(BLOCKADE), ...next(4), remove(ARMS_RACE)])
    saveCards(s, store)
    expect(loadCards(store)).toEqual(s)
  })

  it('loads a game saved before the deck was tracked', () => {
    const store = storage()
    store.setItem(CARDS_STORAGE_KEY, JSON.stringify({ turn: 3, states: { 10: 'discarded' }, history: [[], [15]] }))
    expect(loadCards(store)).toEqual({
      turn: 3,
      states: { 10: 'discarded' },
      inHand: [],
      deck: 22,
      pending: null,
      history: [
        { returned: [], marked: [], deck: null },
        { returned: [15], marked: [], deck: null },
      ],
    })
  })

  it('starts fresh on unusable data', () => {
    const store = storage()
    store.setItem(CARDS_STORAGE_KEY, JSON.stringify({ turn: 3, states: { 9999: 'removed' }, history: [[], []] }))
    expect(loadCards(store)).toEqual(newCards())
    store.setItem(CARDS_STORAGE_KEY, '{oops')
    expect(loadCards(store)).toEqual(newCards())
  })
})
