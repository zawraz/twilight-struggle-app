import { describe, expect, it } from 'vitest'
import {
  cardsInPlay,
  cardsReducer,
  cardState,
  CARDS_STORAGE_KEY,
  loadCards,
  newCards,
  saveCards,
  type CardsAction,
  type CardsState,
} from './cardGame'
import { CARDS } from './cards'

const run = (actions: CardsAction[], from: CardsState = newCards()) => actions.reduce(cardsReducer, from)
const next = (times: number): CardsAction[] => Array.from({ length: times }, () => ({ type: 'nextTurn' }))
const discard = (id: number): CardsAction => ({ type: 'setCardState', id, state: 'discarded' })
const remove = (id: number): CardsAction => ({ type: 'setCardState', id, state: 'removed' })

// Blockade (early), Arms Race (mid), Terrorism (late).
const BLOCKADE = 10
const NASSER = 15
const ARMS_RACE = 39
const TERRORISM = 92

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

  it('reshuffles the discard pile when entering turn 3, but not removed cards', () => {
    let s = run([discard(BLOCKADE), remove(NASSER), ...next(1)])
    expect(cardState(s, BLOCKADE)).toBe('discarded')
    s = cardsReducer(s, { type: 'nextTurn' })
    expect(s.turn).toBe(3)
    expect(cardState(s, BLOCKADE)).toBe('available')
    expect(cardState(s, NASSER)).toBe('removed')
  })

  it('does not reshuffle when Mid War or Late War cards join', () => {
    const s = run([...next(2), discard(BLOCKADE), ...next(1)])
    expect(s.turn).toBe(4)
    expect(cardState(s, BLOCKADE)).toBe('discarded')
    const late = run([...next(3), discard(ARMS_RACE), ...next(1)], s)
    expect(late.turn).toBe(8)
    expect(cardState(late, ARMS_RACE)).toBe('discarded')
  })

  it('reshuffles again when entering turn 7', () => {
    const s = run([...next(4), discard(ARMS_RACE), discard(BLOCKADE), ...next(2)])
    expect(s.turn).toBe(7)
    expect(cardState(s, ARMS_RACE)).toBe('available')
    expect(cardState(s, BLOCKADE)).toBe('available')
  })

  it('going back a turn undoes its reshuffle, but keeps changes made since', () => {
    let s = run([discard(BLOCKADE), discard(NASSER), ...next(2)])
    s = cardsReducer(s, remove(NASSER))
    s = cardsReducer(s, { type: 'previousTurn' })
    expect(s.turn).toBe(2)
    expect(cardState(s, BLOCKADE)).toBe('discarded')
    expect(cardState(s, NASSER)).toBe('removed')
  })

  it('goes back several turns, each undoing its own step', () => {
    // Blockade comes back on turn 3; Arms Race, discarded on turn 6, on turn 7.
    let s = run([discard(BLOCKADE), ...next(5), discard(ARMS_RACE), ...next(2)])
    expect(s.turn).toBe(8)
    s = run(Array.from({ length: 7 }, () => ({ type: 'previousTurn' }) as const), s)
    expect(s.turn).toBe(1)
    expect(cardState(s, ARMS_RACE)).toBe('discarded')
    expect(cardState(s, BLOCKADE)).toBe('discarded')
    expect(s.history).toEqual([])
  })

  it('stays within turns 1–10', () => {
    expect(cardsReducer(newCards(), { type: 'previousTurn' }).turn).toBe(1)
    expect(run(next(12)).turn).toBe(10)
  })

  it('reshuffles by hand and takes it back', () => {
    let s = run([...next(8), discard(TERRORISM), discard(BLOCKADE)])
    s = cardsReducer(s, { type: 'reshuffle' })
    expect(cardState(s, TERRORISM)).toBe('available')
    s = cardsReducer(s, remove(BLOCKADE))
    s = cardsReducer(s, { type: 'undoReshuffle', ids: [TERRORISM, BLOCKADE] })
    expect(cardState(s, TERRORISM)).toBe('discarded')
    expect(cardState(s, BLOCKADE)).toBe('removed')
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

  it('starts fresh on unusable data', () => {
    const store = storage()
    store.setItem(CARDS_STORAGE_KEY, JSON.stringify({ turn: 3, states: { 9999: 'removed' }, history: [[], []] }))
    expect(loadCards(store)).toEqual(newCards())
    store.setItem(CARDS_STORAGE_KEY, '{oops')
    expect(loadCards(store)).toEqual(newCards())
  })
})
