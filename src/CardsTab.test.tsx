import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { LONG_PRESS_MS, SWIPE_COMMIT_PX } from './components/CardRow'
import { copy } from './copy'
import { CARDS_STORAGE_KEY, cardsInPlay, type CardsState } from './lib/cardGame'
import { CARDS } from './lib/cards'
import { at, discarded } from './test/cardStates'
import { TOAST_MS } from './lib/useToast'

type User = ReturnType<typeof userEvent.setup>

const list = () => screen.getByRole('list', { name: copy.cards.list })
const rows = () => within(list()).getAllByRole('listitem')
const row = (name: string) => rows().find((li) => within(li).queryByText(name, { exact: true }))!
const rowButton = (name: string) => within(row(name)).getAllByRole('button')[0]
const turn = () => screen.getByRole('status', { name: /^Tura \d+ z 10$/ })
const counts = (state: string) => screen.getByLabelText(new RegExp(`^${state}:`))

const early = cardsInPlay(1).map((c) => c.id)
const nameOf = (id: number) => CARDS.find((c) => c.id === id)!.name
const idOf = (name: string) => CARDS.find((c) => c.name === name)!.id
const inHandIcon = (name: string) => within(row(name)).queryByRole('img', { name: copy.cards.inHand })

/** Opens the Karty tab, on a saved game when given one. */
async function setup(saved?: CardsState) {
  if (saved) localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(saved))
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(<App />)
  await user.click(screen.getByRole('tab', { name: 'Karty' }))
  return user
}

async function nextTurns(user: User, times: number) {
  for (let i = 0; i < times; i++) await user.click(screen.getByRole('button', { name: copy.cards.nextTurn }))
}

async function discard(user: User, name: string) {
  await user.click(rowButton(name))
  await user.click(screen.getByRole('button', { name: copy.cards.discard(name) }))
}

function swipe(name: string, dx: number) {
  const surface = rowButton(name).parentElement!
  fireEvent.pointerDown(surface, { pointerId: 1, button: 0, clientX: 200, clientY: 10 })
  fireEvent.pointerMove(surface, { pointerId: 1, clientX: 200 + dx / 2, clientY: 10 })
  fireEvent.pointerMove(surface, { pointerId: 1, clientX: 200 + dx, clientY: 10 })
  fireEvent.pointerUp(surface, { pointerId: 1, clientX: 200 + dx, clientY: 10 })
  fireEvent.click(rowButton(name))
}

function longPress(name: string) {
  const surface = rowButton(name).parentElement!
  fireEvent.pointerDown(surface, { pointerId: 1, button: 0, clientX: 100, clientY: 10 })
  act(() => vi.advanceTimersByTime(LONG_PRESS_MS))
  fireEvent.pointerUp(surface, { pointerId: 1, clientX: 100, clientY: 10 })
  fireEvent.click(rowButton(name))
}

const stateOf = (name: string) => row(name).getAttribute('data-state')

afterEach(() => {
  vi.useRealTimers()
})

describe('Karty: turns', () => {
  it('starts on turn 1 with the 39 Early War cards in checklist order', async () => {
    await setup()
    expect(turn()).toHaveTextContent('1')
    expect(rows()).toHaveLength(39)
    expect(rows()[0]).toHaveTextContent('Kulminacja napięć na Bliskim Wschodzie')
    expect(rows()[38]).toHaveTextContent('Zakaz prób jądrowych')
    expect(screen.getByRole('button', { name: copy.cards.previousTurn })).toBeDisabled()
  })

  it('brings in Mid War on turn 4 and Late War on turn 8', async () => {
    const user = await setup()
    await nextTurns(user, 3)
    expect(rows()).toHaveLength(87)
    // Sorted by value across phases: Early War and Mid War scoring cards first, then the 1s.
    expect(rows()[2]).toHaveTextContent('Kulminacja napięć w Europie')
    expect(rows()[3]).toHaveTextContent('Kulminacja napięć w Afryce')
    expect(rows()[6]).toHaveTextContent('Kulminacja napięć w Azji Południowo-Wschodniej')
    expect(rows()[7]).toHaveTextContent('Blokada')
    expect(rows()[15]).toHaveTextContent('Allende')
    await nextTurns(user, 4)
    expect(turn()).toHaveTextContent('8')
    expect(rows()).toHaveLength(111)
    await nextTurns(user, 5)
    expect(turn()).toHaveTextContent('10')
    expect(screen.getByRole('button', { name: copy.cards.nextTurn })).toBeDisabled()
  })

  it('shows the deck count and has no Przetasuj button', async () => {
    await setup()
    expect(screen.getByRole('status', { name: copy.cards.deckCount(23) })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Przetasuj' })).not.toBeInTheDocument()
  })

  it('reshuffles on a new turn only when the deck runs out, marking cards in hand', async () => {
    const user = await setup(at({ states: discarded(early.slice(0, 23)) }))
    const kept = nameOf(early[30])
    expect(inHandIcon(kept)).toBeNull()
    await nextTurns(user, 1)
    expect(screen.getByText(copy.cards.reshuffled(23))).toBeInTheDocument()
    expect(stateOf(nameOf(early[0]))).toBe('available')
    expect(inHandIcon(kept)).not.toBeNull()
    expect(inHandIcon(nameOf(early[0]))).toBeNull()
    expect(screen.getByRole('status', { name: copy.cards.deckCount(23) })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: copy.undo }))
    expect(turn()).toHaveTextContent('1')
    expect(stateOf(nameOf(early[0]))).toBe('discarded')
    expect(inHandIcon(kept)).toBeNull()
  })

  it('says nothing on a new turn the deck can cover', async () => {
    const user = await setup()
    await nextTurns(user, 1)
    expect(screen.queryByText(copy.cards.reshuffled(0))).not.toBeInTheDocument()
    expect(screen.getByRole('status', { name: copy.cards.deckCount(23) })).toBeInTheDocument()
  })
})

describe('Karty: changing a card', () => {
  it('a tap on an available card offers remove and discard', async () => {
    const user = await setup()
    await user.click(rowButton('Blokada'))
    expect(screen.getByRole('button', { name: copy.cards.remove('Blokada') })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: copy.cards.discard('Blokada') }))
    expect(stateOf('Blokada')).toBe('discarded')
    expect(screen.queryByRole('button', { name: copy.cards.discard('Blokada') })).not.toBeInTheDocument()

    await user.click(rowButton('Nasser'))
    await user.click(screen.getByRole('button', { name: copy.cards.remove('Nasser') }))
    expect(stateOf('Nasser')).toBe('removed')
  })

  it('swipes left to discard and right to remove', async () => {
    await setup()
    swipe('Blokada', -(SWIPE_COMMIT_PX + 10))
    expect(stateOf('Blokada')).toBe('discarded')
    swipe('Nasser', SWIPE_COMMIT_PX + 10)
    expect(stateOf('Nasser')).toBe('removed')
    // A short swipe springs back, and its release isn't a tap.
    swipe('Fidel', SWIPE_COMMIT_PX - 20)
    expect(stateOf('Fidel')).toBe('available')
    expect(screen.queryByRole('button', { name: copy.cards.discard('Fidel') })).not.toBeInTheDocument()
  })

  it('removes a discarded card with a right swipe, but cannot discard it again', async () => {
    const user = await setup()
    await discard(user, 'Blokada')
    swipe('Blokada', -(SWIPE_COMMIT_PX + 10))
    expect(stateOf('Blokada')).toBe('discarded')
    swipe('Blokada', SWIPE_COMMIT_PX + 10)
    expect(stateOf('Blokada')).toBe('removed')
  })

  it('restores a played card only after a long press', async () => {
    const user = await setup()
    await discard(user, 'Blokada')
    await user.click(rowButton('Blokada'))
    expect(screen.queryByRole('button', { name: copy.cards.restore('Blokada') })).not.toBeInTheDocument()

    longPress('Blokada')
    await user.click(screen.getByRole('button', { name: copy.cards.restore('Blokada') }))
    expect(stateOf('Blokada')).toBe('available')
  })

  it('opens a played card’s restore from the keyboard', async () => {
    const user = await setup()
    await discard(user, 'Blokada')
    act(() => rowButton('Blokada').focus())
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: copy.cards.restore('Blokada') })).toBeInTheDocument()
  })

  it('does not offer removing a card without an asterisk', async () => {
    const user = await setup()
    await user.click(rowButton('Interwencja ONZ'))
    expect(screen.queryByRole('button', { name: copy.cards.remove('Interwencja ONZ') })).not.toBeInTheDocument()
    swipe('Interwencja ONZ', SWIPE_COMMIT_PX + 20)
    expect(stateOf('Interwencja ONZ')).toBe('available')
  })

  it('marks the asterisk and important cards', async () => {
    await setup()
    expect(within(row('Blokada')).getByText(copy.cards.permanent)).toBeInTheDocument()
    expect(within(row('Blokada')).getByRole('img', { name: copy.cards.important })).toBeInTheDocument()
    expect(within(row('Interwencja ONZ')).queryByText(copy.cards.permanent)).not.toBeInTheDocument()
    expect(within(row('Interwencja ONZ')).queryByRole('img', { name: copy.cards.important })).not.toBeInTheDocument()
  })
})

describe('Karty: counts', () => {
  it('splits each state by side: ZSRR | USA | N', async () => {
    const user = await setup()
    expect(counts('Dostępne')).toHaveAccessibleName(copy.cards.countFor('Dostępne', 15, 15, 9))
    await discard(user, 'Blokada')
    expect(counts('Dostępne')).toHaveAccessibleName(copy.cards.countFor('Dostępne', 14, 15, 9))
    expect(counts('Odrzucone')).toHaveAccessibleName(copy.cards.countFor('Odrzucone', 1, 0, 0))
  })
})

describe('Karty: filters and order', () => {
  it('combines groups: USA + 4 shows only US 4-ops cards', async () => {
    const user = await setup()
    await user.click(screen.getByRole('button', { name: new RegExp(copy.cards.filters) }))
    await user.click(within(screen.getByRole('group', { name: 'Strona' })).getByRole('button', { name: 'USA' }))
    await user.click(screen.getByRole('button', { name: copy.cards.ops(4) }))
    expect(rows().map((li) => li.textContent)).toEqual([
      expect.stringContaining('NATO'),
      expect.stringContaining('Plan Marshalla'),
      expect.stringContaining('Traktat o bezpieczeństwie USA i Japonii'),
    ])
    // Within a group: either value.
    await user.click(screen.getByRole('button', { name: copy.cards.ops(1) }))
    expect(rows()).toHaveLength(6)

    await user.click(screen.getByRole('button', { name: copy.cards.clearFilters }))
    expect(rows()).toHaveLength(39)
  })

  it('puts cards in hand on top until turned off', async () => {
    const last = 'Zakaz prób jądrowych'
    const user = await setup(at({ inHand: [idOf(last)] }))
    const handFirst = screen.getByRole('button', { name: copy.cards.handFirst })
    expect(handFirst).toHaveAttribute('aria-pressed', 'true')
    expect(rows()[0]).toHaveTextContent(last)
    await user.click(handFirst)
    expect(rows()[0]).toHaveTextContent('Kulminacja napięć na Bliskim Wschodzie')
    expect(rows()[38]).toHaveTextContent(last)
  })

  it('moves played cards to the bottom until turned off', async () => {
    const user = await setup()
    const playedLast = screen.getByRole('button', { name: copy.cards.playedLast })
    expect(playedLast).toHaveAttribute('aria-pressed', 'true')
    await discard(user, 'Kulminacja napięć w Azji')
    expect(rows()[1]).toHaveTextContent('Kulminacja napięć w Europie')
    expect(rows()[38]).toHaveTextContent('Kulminacja napięć w Azji')
    await user.click(playedLast)
    expect(rows()[1]).toHaveTextContent('Kulminacja napięć w Azji')
  })
})

describe('Karty: toast', () => {
  it('takes a card change back, and leaves after two seconds', async () => {
    const user = await setup()
    await discard(user, 'Blokada')
    expect(screen.getByText(copy.cards.changed('Blokada', copy.cards.state.discarded))).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: copy.undo }))
    expect(stateOf('Blokada')).toBe('available')

    await discard(user, 'Fidel')
    act(() => vi.advanceTimersByTime(TOAST_MS))
    expect(screen.queryByRole('button', { name: copy.undo })).not.toBeInTheDocument()
    expect(stateOf('Fidel')).toBe('discarded')
  })
})

describe('Karty: saved progress', () => {
  it('survives a reload and resets on New Game', async () => {
    const user = await setup()
    await discard(user, 'Blokada')
    await nextTurns(user, 1)
    expect(localStorage.getItem(CARDS_STORAGE_KEY)).toContain('"turn":2')

    const { unmount } = { unmount: () => document.body.replaceChildren() }
    unmount()
    render(<App />)
    await user.click(screen.getByRole('tab', { name: 'Karty' }))
    expect(turn()).toHaveTextContent('2')
    expect(stateOf('Blokada')).toBe('discarded')

    await user.click(screen.getByRole('button', { name: 'Zakończ grę' }))
    await user.click(screen.getByRole('button', { name: 'Zakończ grę' }))
    await user.click(screen.getByRole('button', { name: 'Nowa gra' }))
    expect(turn()).toHaveTextContent('1')
    expect(stateOf('Blokada')).toBe('available')
  })
})
