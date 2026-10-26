import { useEffect, useReducer } from 'react'
import { gameReducer, loadGame, saveGame } from './game'

/** Game state that survives reloads and app restarts until New Game. */
export function useGame() {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => loadGame())

  useEffect(() => {
    saveGame(state)
  }, [state])

  return [state, dispatch] as const
}
