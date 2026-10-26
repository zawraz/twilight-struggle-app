import { describe, expect, it } from 'vitest'
import { gameReducer, loadGame, newGame, saveGame, STORAGE_KEY } from './game'

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial))
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  }
}

describe('gameReducer', () => {
  it('counts 4 Ops cards per side and never below 0', () => {
    let s = gameReducer(newGame(), { type: 'incrementFourOps', player: 'us' })
    s = gameReducer(s, { type: 'decrementFourOps', player: 'us' })
    s = gameReducer(s, { type: 'decrementFourOps', player: 'us' })
    s = gameReducer(s, { type: 'incrementFourOps', player: 'ussr' })
    expect(s.fourOps).toEqual({ ussr: 1, us: 0 })
  })

  it('adds rolls to the right track and side', () => {
    let s = gameReducer(newGame(), { type: 'addRoll', track: 'success', player: 'ussr', value: -2 })
    s = gameReducer(s, { type: 'addRoll', track: 'dice', player: 'us', value: 6 })
    expect(s.rolls).toEqual({ success: { ussr: [-2], us: [] }, dice: { ussr: [], us: [6] } })
  })

  it('undoes only the newest roll of that track and side', () => {
    let s = gameReducer(newGame(), { type: 'addRoll', track: 'success', player: 'ussr', value: -2 })
    s = gameReducer(s, { type: 'addRoll', track: 'success', player: 'ussr', value: 4 })
    s = gameReducer(s, { type: 'addRoll', track: 'success', player: 'us', value: 1 })
    s = gameReducer(s, { type: 'addRoll', track: 'dice', player: 'ussr', value: 6 })
    s = gameReducer(s, { type: 'undoRoll', track: 'success', player: 'ussr' })
    expect(s.rolls).toEqual({ success: { ussr: [-2], us: [1] }, dice: { ussr: [6], us: [] } })
    expect(gameReducer(newGame(), { type: 'undoRoll', track: 'dice', player: 'us' })).toEqual(newGame())
  })

  it('ends, and starts a new game from nothing', () => {
    let s = gameReducer(newGame(), { type: 'addRoll', track: 'dice', player: 'us', value: 3 })
    s = gameReducer(s, { type: 'end' })
    expect(s.ended).toBe(true)
    expect(gameReducer(s, { type: 'newGame' })).toEqual(newGame())
  })
})

describe('loadGame / saveGame', () => {
  it('round-trips a game', () => {
    const storage = memoryStorage()
    const s = gameReducer(newGame(), { type: 'incrementFourOps', player: 'ussr' })
    saveGame(s, storage)
    expect(loadGame(storage)).toEqual(s)
  })

  it('returns a new game when nothing is saved', () => {
    expect(loadGame(memoryStorage())).toEqual(newGame())
  })

  it.each([
    ['broken JSON', '{'],
    ['wrong shape', JSON.stringify({ fourOps: { ussr: 1 } })],
    ['negative count', JSON.stringify({ ...newGame(), fourOps: { ussr: -1, us: 0 } })],
    ['non-numeric roll', JSON.stringify({ ...newGame(), rolls: { success: { ussr: ['x'], us: [] }, dice: { ussr: [], us: [] } } })],
  ])('returns a new game for %s', (_, raw) => {
    expect(loadGame(memoryStorage({ [STORAGE_KEY]: raw }))).toEqual(newGame())
  })

  it('survives storage that throws', () => {
    const throwing = {
      ...memoryStorage(),
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota')
      },
    } as Storage
    expect(loadGame(throwing)).toEqual(newGame())
    expect(() => saveGame(newGame(), throwing)).not.toThrow()
  })
})
