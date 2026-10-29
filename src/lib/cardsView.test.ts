import { describe, expect, it } from 'vitest'
import { DEFAULT_VIEW, loadView, saveView, VIEW_STORAGE_KEY, type CardsView } from './cardsView'

describe('cards view persistence', () => {
  const storage = () => {
    const data = new Map<string, string>()
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    } as unknown as Storage
  }

  it('starts with the defaults when nothing is saved', () => {
    expect(loadView(storage())).toEqual(DEFAULT_VIEW)
  })

  it('round-trips through storage', () => {
    const store = storage()
    const view: CardsView = {
      filters: { player: ['us', 'neutral'], phase: ['mid'], state: ['discarded'] },
      playedLast: false,
      multiScreen: false,
      swipeScreens: true,
      dimPlayed: false,
    }
    saveView(view, store)
    expect(loadView(store)).toEqual(view)
  })

  it('falls back choice by choice on unusable data', () => {
    const store = storage()
    store.setItem(
      VIEW_STORAGE_KEY,
      JSON.stringify({ filters: { player: ['us', 'mars'], phase: ['late'] }, multiScreen: 'yes', dimPlayed: false }),
    )
    expect(loadView(store)).toEqual({
      ...DEFAULT_VIEW,
      filters: { player: [], phase: ['late'], state: [] },
      dimPlayed: false,
    })
    store.setItem(VIEW_STORAGE_KEY, '{oops')
    expect(loadView(store)).toEqual(DEFAULT_VIEW)
  })
})
