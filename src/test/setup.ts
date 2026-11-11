import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import { newGame, STORAGE_KEY } from '../lib/game'

// Every test starts on a game just begun; a test of a fresh install clears the storage itself.
beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newGame()))
})
afterEach(() => cleanup())
