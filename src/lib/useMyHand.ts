import { useEffect, useRef, useState } from 'react'
import { cardState, type CardsState } from './cardGame'
import { CARDS } from './cards'

// The cards this player marked as held, in their own hand or the other player's: kept on this
// device only, never sent to the room, since a hand is the one thing the players don't share.

export const MY_HAND_KEY = 'ts-companion:my-hand:v1'
export const THEIR_HAND_KEY = 'ts-companion:their-hand:v1'

/** Whose hand a mark puts a card in. */
export type Whose = 'mine' | 'theirs'

const KNOWN_IDS = new Set(CARDS.map((card) => card.id))

export function loadMyHand(key: string = MY_HAND_KEY): number[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is number => KNOWN_IDS.has(id)) : []
  } catch {
    return []
  }
}

function saveMyHand(key: string, ids: number[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(ids))
  } catch {
    // Storage unavailable: the marks last until the app is closed.
  }
}

/** A game nobody has moved in yet: what a new game starts from. */
const isFresh = (cards: CardsState) => cards.turn === 1 && Object.keys(cards.states).length === 0

type Marks = Record<Whose, number[]>

export interface MyHand {
  /** Marked as held in this player's hand. */
  has: (id: number) => boolean
  /** Marked as held in the other player's hand. */
  theirs: (id: number) => boolean
  /** Marks an available card as held in that hand (out of the other one), or takes its mark off (null). */
  mark: (id: number, whose: Whose | null) => void
  /** Drops every mark: what New Game does on this device. */
  clear: () => void
}

/**
 * This player's marked cards. A card leaves either hand once it is played, from either device,
 * and every mark goes when a new game starts: pressed here, cleared outright; started on
 * another device, seen as the deck going back to fresh.
 */
export function useMyHand(cards: CardsState): MyHand {
  const [marks, setMarks] = useState<Marks>(() => ({ mine: loadMyHand(MY_HAND_KEY), theirs: loadMyHand(THEIR_HAND_KEY) }))
  const wasFresh = useRef(isFresh(cards))

  useEffect(() => {
    const fresh = isFresh(cards)
    const newGame = fresh && !wasFresh.current
    wasFresh.current = fresh
    const keep = (held: number[]) => {
      const kept = newGame ? [] : held.filter((id) => cardState(cards, id) === 'available')
      return kept.length === held.length ? held : kept
    }
    setMarks((prev) => {
      const next = { mine: keep(prev.mine), theirs: keep(prev.theirs) }
      return next.mine === prev.mine && next.theirs === prev.theirs ? prev : next
    })
  }, [cards])

  useEffect(() => saveMyHand(MY_HAND_KEY, marks.mine), [marks.mine])
  useEffect(() => saveMyHand(THEIR_HAND_KEY, marks.theirs), [marks.theirs])

  return {
    has: (id) => marks.mine.includes(id),
    theirs: (id) => marks.theirs.includes(id),
    mark: (id, whose) => {
      if (cardState(cards, id) !== 'available') return
      setMarks((prev) => {
        const set = (hand: Whose) => {
          const held = prev[hand].includes(id)
          if (hand === whose) return held ? prev[hand] : [...prev[hand], id]
          return held ? prev[hand].filter((other) => other !== id) : prev[hand]
        }
        return { mine: set('mine'), theirs: set('theirs') }
      })
    },
    clear: () =>
      setMarks((prev) => (prev.mine.length === 0 && prev.theirs.length === 0 ? prev : { mine: [], theirs: [] })),
  }
}
