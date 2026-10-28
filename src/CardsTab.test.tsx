import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { LONG_PRESS_MS, SWIPE_COMMIT_PX } from './components/CardRow'
import { SUBMIT_COOLDOWN_MS } from './components/RollTracker'
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
  for (let i = 0; i < times; i++) {
    // Right after a new turn the button takes it back; wait that out first.
    if (screen.queryByRole('button', { name: copy.cards.undoTurn })) act(() => vi.advanceTimersByTime(SUBMIT_COOLDOWN_MS))
    await user.click(screen.getByRole('button', { name: copy.cards.nextTurn }))
  }
}

const openFilters = (user: User) => user.click(screen.getByRole('button', { name: copy.cards.filters }))

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
  })

  it('the next-turn button takes the turn back for a while', async () => {
    const user = await setup()
    await nextTurns(user, 1)
    expect(turn()).toHaveTextContent('2')
    await user.click(screen.getByRole('button', { name: copy.cards.undoTurn }))
    expect(turn()).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: copy.cards.nextTurn })).toBeEnabled()

    await nextTurns(user, 1)
    act(() => vi.advanceTimersByTime(SUBMIT_COOLDOWN_MS))
    expect(screen.queryByRole('button', { name: copy.cards.undoTurn })).not.toBeInTheDocument()
    expect(turn()).toHaveTextContent('2')
  })

  it('playing a card ends the window to take the turn back', async () => {
    const user = await setup()
    await nextTurns(user, 1)
    await discard(user, 'Blokada')
    expect(screen.queryByRole('button', { name: copy.cards.undoTurn })).not.toBeInTheDocument()
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

  it('says the deck ran out when there is nothing to reshuffle', async () => {
    const removed = Object.fromEntries(early.slice(0, 23).map((id) => [id, 'removed' as const]))
    const user = await setup(at({ states: removed }))
    await nextTurns(user, 1)
    expect(screen.getByText(copy.cards.deckRanOut)).toBeInTheDocument()
    expect(screen.queryByText(copy.cards.reshuffled(0))).not.toBeInTheDocument()
    expect(inHandIcon(nameOf(early[30]))).not.toBeNull()
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

  it('puts Shuttle Diplomacy in play with a right swipe, pinned above every other card', async () => {
    const name = 'Dyplomacja Wahadłowa'
    const user = await setup(at({ turn: 4, inHand: [idOf('Nasser'), idOf('Fidel')] }))
    expect(rows()[0]).toHaveTextContent('Nasser')
    await discard(user, 'Blokada')
    expect(counts(copy.cards.states.discarded)).not.toHaveAccessibleName(/w grze/)
    swipe(name, SWIPE_COMMIT_PX + 10)
    expect(stateOf(name)).toBe('in_play')
    expect(counts(copy.cards.states.discarded)).toHaveAccessibleName(/w grze: Dyplomacja Wahadłowa$/)
    expect(rows()[0]).toHaveTextContent(name)
    // Still on top with the order chips off.
    await openFilters(user)
    await user.click(screen.getByRole('button', { name: copy.cards.playedLast }))
    await user.click(screen.getByRole('button', { name: copy.cards.handFirst }))
    expect(rows()[0]).toHaveTextContent(name)
    // In play, a right swipe does nothing; a left one discards it.
    swipe(name, SWIPE_COMMIT_PX + 10)
    expect(stateOf(name)).toBe('in_play')
    swipe(name, -(SWIPE_COMMIT_PX + 10))
    expect(stateOf(name)).toBe('discarded')
  })

  it('a tap on Shuttle Diplomacy offers putting it in play', async () => {
    const name = 'Dyplomacja Wahadłowa'
    const user = await setup(at({ turn: 4 }))
    await user.click(rowButton(name))
    expect(screen.queryByRole('button', { name: copy.cards.remove(name) })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: copy.cards.putInPlay(name) }))
    expect(stateOf(name)).toBe('in_play')
    await discard(user, name)
    expect(stateOf(name)).toBe('discarded')
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
  it('keeps Shuttle Diplomacy in play under Dostępne, which carries its pin', async () => {
    const user = await setup(at({ turn: 4, states: { [idOf('Dyplomacja Wahadłowa')]: 'in_play' } }))
    await openFilters(user)
    const available = within(screen.getByRole('group', { name: copy.cards.filterGroups.state })).getByRole('button', {
      name: new RegExp(`^${copy.cards.states.available}\s*${copy.cards.withShuttle}$`),
    })
    await user.click(available)
    expect(rows()[0]).toHaveTextContent('Dyplomacja Wahadłowa')
    expect(rows().every((li) => ['available', 'in_play'].includes(li.dataset.state!))).toBe(true)
  })

  it('shows the pin on Dostępne only while Shuttle Diplomacy is in play', async () => {
    const user = await setup(at({ turn: 4 }))
    await openFilters(user)
    const state = within(screen.getByRole('group', { name: copy.cards.filterGroups.state }))
    expect(state.getByRole('button', { name: copy.cards.states.available })).toBeInTheDocument()
    expect(state.queryByRole('img', { name: copy.cards.withShuttle })).not.toBeInTheDocument()
  })

  it('closes each ops value with a thicker line, among available cards only', async () => {
    await setup()
    // The three scoring cards, then the 1-ops cards from Blokada on.
    expect(rows()[1]).not.toHaveAttribute('data-divider')
    expect(rows()[2]).toHaveAttribute('data-divider', 'value')
    expect(rows()[3]).toHaveTextContent('Blokada')
    expect(rows().at(-1)).not.toHaveAttribute('data-divider')
  })

  it('closes a card in play on top with a thicker line', async () => {
    await setup(at({ turn: 4, states: { [idOf('Dyplomacja Wahadłowa')]: 'in_play' } }))
    expect(rows()[0]).toHaveTextContent('Dyplomacja Wahadłowa')
    expect(rows()[0]).toHaveAttribute('data-divider', 'value')
  })

  it('draws no thicker line between played cards', async () => {
    const user = await setup()
    // Played last, in checklist order: a scoring card, then Blokada.
    await discard(user, 'Kulminacja napięć w Azji')
    await discard(user, 'Blokada')
    const played = rows().filter((li) => li.dataset.state === 'discarded')
    expect(played.map((li) => li.dataset.divider)).toEqual([undefined, undefined])
  })

  it('draws a red line where the played cards begin', async () => {
    const user = await setup()
    await discard(user, 'Blokada')
    const last = rows().findLastIndex((li) => li.dataset.state === 'available')
    expect(rows()[last]).toHaveAttribute('data-divider', 'played')
    expect(rows()[last + 1]).toHaveTextContent('Blokada')
    expect(rows().filter((li) => li.dataset.divider === 'played')).toHaveLength(1)
  })

  it('combines groups: USA + 4 shows only US 4-ops cards', async () => {
    const user = await setup()
    await openFilters(user)
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
    await openFilters(user)
    const handFirst = screen.getByRole('button', { name: copy.cards.handFirst })
    expect(handFirst).toHaveAttribute('aria-pressed', 'true')
    expect(rows()[0]).toHaveTextContent(last)
    await user.click(handFirst)
    expect(rows()[0]).toHaveTextContent('Kulminacja napięć na Bliskim Wschodzie')
    expect(rows()[38]).toHaveTextContent(last)
  })

  it('moves played cards to the bottom until turned off', async () => {
    const user = await setup()
    await openFilters(user)
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
  it('taking back a discard keeps the card in hand', async () => {
    const user = await setup(at({ inHand: [idOf('Blokada')] }))
    await discard(user, 'Blokada')
    expect(inHandIcon('Blokada')).toBeNull()
    await user.click(screen.getByRole('button', { name: copy.undo }))
    expect(stateOf('Blokada')).toBe('available')
    expect(inHandIcon('Blokada')).not.toBeNull()
  })

  it('takes a card change back, and leaves after five seconds', async () => {
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

describe('Karty: 4 Ops cards', () => {
  const NATO = 'NATO'
  const BAN = 'Zakaz prób jądrowych'
  const opsCount = (player: string) => screen.getByRole('status', { name: copy.fourOps.count(player), hidden: true })
  const dialog = () => screen.getByRole('dialog', { name: copy.fourOps.whoPlayed })

  it('asks who played it, and counts it for that side', async () => {
    const user = await setup()
    await discard(user, BAN)
    expect(stateOf(BAN)).toBe('available')
    expect(within(dialog()).getByText(BAN)).toBeInTheDocument()

    await user.click(within(dialog()).getByRole('button', { name: 'USA' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(stateOf(BAN)).toBe('discarded')
    expect(opsCount('USA')).toHaveTextContent('1')
    expect(opsCount('ZSRR')).toHaveTextContent('0')
    expect(screen.getByText(copy.fourOps.playedBy(copy.cards.changed(BAN, copy.cards.state.discarded), 'USA'))).toBeInTheDocument()
  })

  it('asks on a swipe too, for a discard or a removal', async () => {
    const user = await setup()
    swipe(NATO, SWIPE_COMMIT_PX + 10)
    await user.click(within(dialog()).getByRole('button', { name: 'ZSRR' }))
    expect(stateOf(NATO)).toBe('removed')
    expect(opsCount('ZSRR')).toHaveTextContent('1')

    swipe(BAN, -(SWIPE_COMMIT_PX + 10))
    await user.click(within(dialog()).getByRole('button', { name: 'ZSRR' }))
    expect(opsCount('ZSRR')).toHaveTextContent('2')
  })

  it('leaves the card and the count alone when cancelled', async () => {
    const user = await setup()
    await discard(user, BAN)
    await user.click(within(dialog()).getByRole('button', { name: copy.cancel }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(stateOf(BAN)).toBe('available')
    expect(opsCount('USA')).toHaveTextContent('0')

    swipe(BAN, -(SWIPE_COMMIT_PX + 10))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(stateOf(BAN)).toBe('available')
  })

  it('takes the count back with the card on undo', async () => {
    const user = await setup()
    await discard(user, BAN)
    await user.click(within(dialog()).getByRole('button', { name: 'ZSRR' }))
    await user.click(screen.getByRole('button', { name: copy.undo }))
    expect(stateOf(BAN)).toBe('available')
    expect(opsCount('ZSRR')).toHaveTextContent('0')
  })

  it('does not ask for other cards, nor once the game has ended', async () => {
    const user = await setup()
    await discard(user, 'Blokada')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: copy.end }))
    await user.click(screen.getByRole('button', { name: copy.end }))
    // Ending moves to the log; come back to keep playing cards.
    await user.click(screen.getByRole('tab', { name: 'Karty' }))
    await discard(user, BAN)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(stateOf(BAN)).toBe('discarded')
    expect(opsCount('USA')).toHaveTextContent('0')
  })
})

describe('Karty: event picker', () => {
  const TEHRAN = 'Nasz człowiek w Teheranie'
  const ASK_NOT = '„Nie pytajcie co wasz kraj może zrobić dla was…”'
  const SALT = 'Negocjacje SALT'
  const pick = (name: string) => screen.getByRole('checkbox', { name: copy.cards.pick(name) })
  const deck = (n: number) => screen.getByRole('status', { name: copy.cards.deckCount(n) })

  async function play(user: User, name: string) {
    await user.click(rowButton(name))
    await user.click(screen.getByRole('button', { name: copy.cards.remove(name) }))
  }

  it('Tehran counts what its reshuffle brought back, after a reload too', async () => {
    const user = await setup(at({ turn: 5, deck: 4, states: discarded([...early.slice(0, 3), idOf(TEHRAN)]) }))
    // Removed from the discard pile by a right swipe; its row then leaves the picker's list.
    const surface = rowButton(TEHRAN).parentElement!
    fireEvent.pointerDown(surface, { pointerId: 1, button: 0, clientX: 100, clientY: 10 })
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: 160, clientY: 10 })
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: 100 + SWIPE_COMMIT_PX + 20, clientY: 10 })
    fireEvent.pointerUp(surface, { pointerId: 1, clientX: 100 + SWIPE_COMMIT_PX + 20, clientY: 10 })
    expect(screen.getByText(copy.cards.pickTitle[108])).toBeInTheDocument()
    expect(deck(7)).toBeInTheDocument()
    document.body.replaceChildren()
    render(<App />)
    await user.click(screen.getByRole('tab', { name: 'Karty' }))
    await user.click(screen.getByRole('button', { name: copy.cards.ok }))
    expect(screen.getByText(copy.cards.tehran(0, 3))).toBeInTheDocument()
  })

  it('Tehran opens a picker with no Cancel, and undo takes back the whole play', async () => {
    const user = await setup(at({ turn: 5, deck: 6 }))
    await play(user, TEHRAN)
    expect(screen.getByText(copy.cards.pickTitle[108])).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /anuluj/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: copy.cards.nextTurn })).toBeDisabled()
    expect(screen.getByRole('button', { name: copy.cards.filters })).toBeDisabled()
    expect(rows()).toHaveLength(86)

    const names = early.slice(0, 6).map(nameOf)
    for (const name of names) await user.click(pick(name))
    expect(screen.getByText(copy.cards.picked(5, 5))).toBeInTheDocument()
    expect(pick(names[5])).toHaveAttribute('aria-checked', 'false')
    await user.click(pick(names[4]))
    await user.click(pick(names[3]))
    await user.click(pick(names[2]))
    expect(pick(names[0])).toHaveAttribute('aria-checked', 'true')

    await user.click(screen.getByRole('button', { name: copy.cards.ok }))
    expect(screen.getByText(copy.cards.tehran(2, 0))).toBeInTheDocument()
    expect(deck(4)).toBeInTheDocument()
    expect(stateOf(names[0])).toBe('discarded')

    await user.click(screen.getByRole('button', { name: copy.undo }))
    expect(stateOf(TEHRAN)).toBe('available')
    expect(stateOf(names[0])).toBe('available')
    expect(deck(6)).toBeInTheDocument()
  })

  it('Ask Not reshuffles when the deck can’t cover the draw', async () => {
    const user = await setup(at({ turn: 5, deck: 3, states: discarded(early.slice(10, 15)) }))
    await play(user, ASK_NOT)
    for (const id of early.slice(0, 6)) await user.click(pick(nameOf(id)))
    await user.click(screen.getByRole('button', { name: copy.cards.ok }))
    expect(screen.getByText(copy.cards.drewReshuffled(6, 11))).toBeInTheDocument()
    expect(deck(8)).toBeInTheDocument()
    expect(stateOf(nameOf(early[0]))).toBe('available')
    expect(inHandIcon(nameOf(early[20]))).not.toBeNull()
  })

  it('SALT lists only non-scoring discarded cards and puts the pick in hand', async () => {
    const user = await setup(at({ turn: 5, deck: 20, states: discarded([idOf('Kulminacja napięć w Azji'), idOf('Blokada')]) }))
    await play(user, SALT)
    expect(rows()).toHaveLength(1)
    await user.click(pick('Blokada'))
    await user.click(screen.getByRole('button', { name: copy.cards.ok }))
    expect(screen.getByText(copy.cards.toHand('Blokada'))).toBeInTheDocument()
    expect(stateOf('Blokada')).toBe('available')
    expect(inHandIcon('Blokada')).not.toBeNull()
    expect(deck(20)).toBeInTheDocument()
  })

  it('the picker survives a reload and ignores filters', async () => {
    const user = await setup(at({ turn: 5, deck: 20 }))
    await user.click(screen.getByRole('button', { name: copy.cards.filters }))
    await user.click(screen.getByRole('button', { name: copy.cards.sides.us }))
    await play(user, TEHRAN)
    expect(rows()).toHaveLength(86)

    document.body.replaceChildren()
    render(<App />)
    await user.click(screen.getByRole('tab', { name: 'Karty' }))
    expect(screen.getByText(copy.cards.pickTitle[108])).toBeInTheDocument()
    expect(screen.getByRole('button', { name: copy.cards.nextTurn })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: copy.cards.ok }))
    expect(screen.getByText(copy.cards.tehran(0, 0))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: copy.undo })).not.toBeInTheDocument()
  })

  it('playing an event card dismisses the last toast', async () => {
    const user = await setup(at({ turn: 5, deck: 20 }))
    await discard(user, 'Blokada')
    await play(user, TEHRAN)
    expect(screen.queryByRole('button', { name: copy.undo })).not.toBeInTheDocument()
  })

  it('a turn change dismisses the last toast', async () => {
    const user = await setup()
    await discard(user, 'Blokada')
    expect(screen.getByRole('button', { name: copy.undo })).toBeInTheDocument()
    await nextTurns(user, 1)
    expect(screen.queryByRole('button', { name: copy.undo })).not.toBeInTheDocument()
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
