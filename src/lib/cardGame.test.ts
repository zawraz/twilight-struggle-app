import { describe, expect, it } from 'vitest'
import {
  cardsInPlay,
  cardsReducer,
  cardState,
  CARDS_STORAGE_KEY,
  loadCards,
  newCards,
  saveCards,
  ASK_NOT,
  availableIds,
  isInHand,
  pickableIds,
  SALT,
  TEHRAN,
  type CardsAction,
} from './cardGame'
import { CARDS } from './cards'
import { at, discarded, run } from '../test/cardStates'

const next = (times: number): CardsAction[] => Array.from({ length: times }, () => ({ type: 'nextTurn' }))
const discard = (id: number): CardsAction => ({ type: 'setCardState', id, state: 'discarded' })
const remove = (id: number): CardsAction => ({ type: 'setCardState', id, state: 'removed' })
const discardAll = (ids: readonly number[]) => ids.map(discard)

// Blockade and Nasser (early), Arms Race (mid).
const BLOCKADE = 10
const NASSER = 15
const ARMS_RACE = 39
const UN_INTERVENTION = 32
const ASIA_SCORING = 1
const early = cardsInPlay(1).map((c) => c.id)
/** Turn-5 cards other than the event cards, to pick from. */
const pool = cardsInPlay(5)
  .map((c) => c.id)
  .filter((id) => id !== SALT && id !== ASK_NOT && id !== TEHRAN && id !== ASIA_SCORING && id !== BLOCKADE)
const resolve = (...picked: number[]): CardsAction => ({ type: 'resolveEvent', picked })

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

  it('going back a turn keeps a mark given again since', () => {
    const inPlay = cardsInPlay(4).map((c) => c.id).filter((id) => id !== SALT)
    let s = run([...discardAll(inPlay.slice(0, 69)), ...next(1)], at({ turn: 4 }))
    const card = s.inHand.find((id) => id !== SALT && CARDS.find((c) => c.id === id)!.value > 0)!
    s = run([discard(card), remove(SALT), resolve(card)], s)
    expect(isInHand(s, card)).toBe(true)
    s = cardsReducer(s, { type: 'previousTurn' })
    expect(cardState(s, card)).toBe('available')
    expect(isInHand(s, card)).toBe(true)
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

describe('card events', () => {
  it('removing an event card waits for its picker; nothing else moves meanwhile', () => {
    const s = run([remove(TEHRAN)], at({ turn: 5, deck: 20 }))
    expect(s.pending).toBe(TEHRAN)
    expect(run([...next(1), { type: 'previousTurn' }, discard(BLOCKADE)], s)).toBe(s)
  })

  it('offers nothing to pick with no event waiting', () => {
    expect(pickableIds(at({ turn: 5 }))).toEqual([])
  })

  it('Tehran with more than 5 in the deck: no reshuffle; its discards leave the deck', () => {
    let s = run([discard(ARMS_RACE), remove(TEHRAN)], at({ turn: 5, deck: 6 }))
    expect(cardState(s, ARMS_RACE)).toBe('discarded')
    s = cardsReducer(s, resolve(pool[0], pool[1]))
    expect([cardState(s, pool[0]), cardState(s, pool[1])]).toEqual(['discarded', 'discarded'])
    expect(s.deck).toBe(4)
    expect(s.pending).toBeNull()
  })

  it('Tehran remembers what its reshuffle brought back, never counting itself', () => {
    const s = run([discard(TEHRAN), remove(TEHRAN)], at({ turn: 5, deck: 4, states: discarded(pool.slice(0, 3)) }))
    expect([...s.eventReturned].sort()).toEqual([...pool.slice(0, 3)].sort())
    expect(s.deck).toBe(7)
    expect(cardsReducer(s, resolve()).eventReturned).toEqual([])
    expect(run([remove(TEHRAN)], at({ turn: 5, deck: 6, states: discarded(pool.slice(0, 3)) })).eventReturned).toEqual([])
  })

  it('Tehran taken back by SALT and then played counts only the cards still discarded', () => {
    let s = run([discard(TEHRAN), remove(SALT), resolve(TEHRAN)], at({ turn: 5, deck: 4, states: discarded(pool.slice(0, 3)) }))
    expect(isInHand(s, TEHRAN)).toBe(true)
    s = cardsReducer(s, remove(TEHRAN))
    expect([...s.eventReturned].sort()).toEqual([...pool.slice(0, 3)].sort())
    expect(s.deck).toBe(7)
  })

  it('Tehran with 5 or fewer: the discard pile is shuffled in, nobody marked', () => {
    const s = run([remove(TEHRAN)], at({ turn: 5, deck: 4, states: discarded(pool.slice(0, 10)), inHand: [pool[20]] }))
    expect(pool.slice(0, 10).every((id) => cardState(s, id) === 'available')).toBe(true)
    expect(s.deck).toBe(14)
    expect(s.inHand).toEqual([pool[20]])
  })

  it('Tehran ignores cards in hand and picks past 5', () => {
    let s = run([remove(TEHRAN)], at({ turn: 5, deck: 20, inHand: [pool[0]] }))
    expect(pickableIds(s)).not.toContain(pool[0])
    s = cardsReducer(s, resolve(...pool.slice(0, 7)))
    expect(cardState(s, pool[0])).toBe('available')
    expect(pool.slice(1, 6).every((id) => cardState(s, id) === 'discarded')).toBe(true)
    expect(cardState(s, pool[6])).toBe('available')
    expect(s.deck).toBe(15)
  })

  it('never takes the deck below 0', () => {
    const s = run([remove(TEHRAN), resolve(...pool.slice(0, 5))], at({ turn: 5, deck: 2 }))
    expect(s.deck).toBe(0)
  })

  it('Ask Not draws without a reshuffle when the deck covers it', () => {
    let s = run([remove(ASK_NOT), resolve(...pool.slice(0, 6))], at({ turn: 5, deck: 11 }))
    expect(pool.slice(0, 6).every((id) => cardState(s, id) === 'discarded')).toBe(true)
    expect(s.deck).toBe(5)
    expect(s.inHand).toEqual([])
    s = run([remove(ASK_NOT), resolve(...pool.slice(0, 6))], at({ turn: 5, deck: 6 }))
    expect(s.deck).toBe(0)
    expect(cardState(s, pool[0])).toBe('discarded')
  })

  it('Ask Not reshuffles, the just-discarded cards included, and marks the rest in hand', () => {
    const shuffled = pool.slice(0, 11)
    const s = run([remove(ASK_NOT), resolve(...pool.slice(0, 6))], at({ turn: 5, deck: 3, states: discarded(pool.slice(6, 11)) }))
    expect(shuffled.every((id) => cardState(s, id) === 'available')).toBe(true)
    expect(cardState(s, ASK_NOT)).toBe('removed')
    expect([...s.inHand].sort()).toEqual(availableIds(s).filter((id) => !shuffled.includes(id)).sort())
    expect(s.deck).toBe(8)
  })

  it('Ask Not ignores picks past 8', () => {
    const s = run([remove(ASK_NOT), resolve(...pool.slice(0, 10))], at({ turn: 5, deck: 20 }))
    expect(pool.slice(0, 10).filter((id) => cardState(s, id) === 'discarded')).toHaveLength(8)
    expect(s.deck).toBe(12)
  })

  it('SALT takes one non-scoring card from the discard pile into a hand', () => {
    const before = run([discard(ASIA_SCORING), discard(BLOCKADE), discard(NASSER), remove(SALT)], at({ turn: 5, deck: 20 }))
    expect(pickableIds(before)).toEqual(expect.arrayContaining([BLOCKADE, NASSER]))
    expect(pickableIds(before)).not.toContain(ASIA_SCORING)
    const scoring = cardsReducer(before, resolve(ASIA_SCORING))
    expect(cardState(scoring, ASIA_SCORING)).toBe('discarded')
    expect(scoring.pending).toBeNull()
    const s = cardsReducer(before, resolve(BLOCKADE, NASSER))
    expect(cardState(s, BLOCKADE)).toBe('available')
    expect(isInHand(s, BLOCKADE)).toBe(true)
    expect(cardState(s, NASSER)).toBe('discarded')
    expect(s.deck).toBe(20)
  })

  it('plays the spec’s turn-5 example down to 5 in the deck', () => {
    let s = run([remove(TEHRAN)], at({ turn: 5, deck: 4, states: discarded(pool.slice(0, 10)) }))
    expect(s.deck).toBe(14)
    s = run([resolve(...pool.slice(10, 13)), remove(ASK_NOT), resolve(...pool.slice(13, 19))], s)
    expect(s.deck).toBe(5)
    expect(cardState(s, pool[0])).toBe('available')
  })

  it('restore puts back a snapshot', () => {
    const before = at({ turn: 5, deck: 6 })
    const s = run([remove(TEHRAN), resolve(pool[0]), { type: 'restore', state: before }], before)
    expect(s).toEqual(before)
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

  it('loads a save from before events remembered their reshuffle', () => {
    const store = storage()
    const { eventReturned: _, ...saved } = at({ turn: 2, deck: 5 })
    store.setItem(CARDS_STORAGE_KEY, JSON.stringify(saved))
    expect(loadCards(store)).toEqual(at({ turn: 2, deck: 5 }))
  })

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
      eventReturned: [],
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
