import { describe, expect, it } from 'vitest'
import { newRoom, roomReducer } from '../lib/room'
import type { OnlineGame } from '../lib/syncServer'
import { fakeServer } from './fakeServer'

const listener = () => {
  const games: (OnlineGame | null)[] = []
  return { games, onGame: (g: OnlineGame | null) => games.push(g), onConnected: () => {} }
}

describe('fakeServer', () => {
  it('opens on first watch and closes after the last stop', () => {
    const fake = fakeServer()
    const stopA = fake.watch(listener())
    const stopB = fake.watch(listener())
    expect(fake.opens).toBe(1)
    expect(fake.open).toBe(true)
    stopA()
    expect(fake.open).toBe(true)
    stopB()
    expect(fake.open).toBe(false)
  })

  it('dispatch updates every listener', async () => {
    const fake = fakeServer({ state: newRoom(), updatedAt: 0 })
    const a = listener()
    fake.watch(a)
    await fake.dispatch({ target: 'cards', action: { type: 'nextTurn' } })
    expect(a.games.at(-1)?.state.cards.turn).toBe(2)
  })

  it('start replaces the game with a fresh one', async () => {
    const turned = roomReducer(newRoom(), { target: 'cards', action: { type: 'nextTurn' } })
    const fake = fakeServer({ state: turned, updatedAt: 0 })
    await fake.start()
    expect(fake.game?.state).toEqual(newRoom())
  })

  it('held listeners hear nothing until released', () => {
    const fake = fakeServer({ state: newRoom(), updatedAt: 0 }, { held: true })
    const a = listener()
    fake.watch(a)
    expect(a.games).toEqual([])
    fake.release()
    expect(a.games).toHaveLength(1)
  })
})
