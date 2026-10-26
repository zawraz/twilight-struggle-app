import { useEffect, useReducer } from 'react'
import { cardsReducer, loadCards, saveCards } from './cardGame'

/** Card states and the turn, surviving reloads and app restarts until New Game. */
export function useCards() {
  const [state, dispatch] = useReducer(cardsReducer, undefined, () => loadCards())

  useEffect(() => {
    saveCards(state)
  }, [state])

  return [state, dispatch] as const
}
