import { useEffect, useRef, useState } from 'react'
import { cardState, type CardsState } from './cardGame'
import { CARDS } from './cards'

// The cards this player marked as held: kept on this device only, never sent to the room,
// since a hand is the one thing the players don't share.

export const MY_HAND_KEY = 'ts-companion:my-hand:v1'

const KNOWN_IDS = new Set(CARDS.map((card) => card.id))

export function loadMyHand(): number[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(MY_HAND_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is number => KNOWN_IDS.has(id)) : []
  } catch {
    return []
  }
}

function saveMyHand(ids: number[]): void {
  try {
    localStorage.setItem(MY_HAND_KEY, JSON.stringify(ids))
  } catch {
    // Storage unavailable: the marks last until the app is closed.
  }
}

/** A game nobody has moved in yet: what a new game starts from. */
const isFresh = (cards: CardsState) => cards.turn === 1 && Object.keys(cards.states).length === 0

export interface MyHand {
  has: (id: number) => boolean
  /** Marks an available card as held, or unmarks it. */
  toggle: (id: number) => void
}

/**
 * This player's marked cards. A card leaves the hand once it is played, from either device,
 * and the whole hand goes when a new game starts.
 */
export function useMyHand(cards: CardsState): MyHand {
  const [ids, setIds] = useState(loadMyHand)
  const wasFresh = useRef(isFresh(cards))

  useEffect(() => {
    const fresh = isFresh(cards)
    const newGame = fresh && !wasFresh.current
    wasFresh.current = fresh
    setIds((held) => {
      const kept = newGame ? [] : held.filter((id) => cardState(cards, id) === 'available')
      return kept.length === held.length ? held : kept
    })
  }, [cards])

  useEffect(() => saveMyHand(ids), [ids])

  return {
    has: (id) => ids.includes(id),
    toggle: (id) => {
      if (cardState(cards, id) !== 'available') return
      setIds((held) => (held.includes(id) ? held.filter((other) => other !== id) : [...held, id]))
    },
  }
}
