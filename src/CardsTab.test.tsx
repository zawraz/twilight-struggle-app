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

/** Opens the Karty tab as it first shows, on a saved game when given one. */
async function open(saved?: CardsState) {
  if (saved) localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(saved))
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(<App />)
  await user.click(screen.getByRole('tab', { name: 'Karty' }))
  return user
}

/** Puts the whole list together on one screen, which most of these are about. */
async function oneScreen(user: User) {
  await openFilters(user)
  await user.click(screen.getByRole('button', { name: copy.cards.singleScreen }))
  await openFilters(user)
}

/** Opens the Karty tab on one screen, on a saved game when given one. */
async function setup(saved?: CardsState) {
  const user = await open(saved)
  await oneScreen(user)
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
  // Held on to: the swipe may move the card off the screen.
  const button = rowButton(name)
  const surface = button.parentElement!
  fireEvent.pointerDown(surface, { pointerId: 1, button: 0, clientX: 200, clientY: 10 })
  fireEvent.pointerMove(surface, { pointerId: 1, clientX: 200 + dx / 2, clientY: 10 })
  fireEvent.pointerMove(surface, { pointerId: 1, clientX: 200 + dx, clientY: 10 })
  fireEvent.pointerUp(surface, { pointerId: 1, clientX: 200 + dx, clientY: 10 })
  fireEvent.click(button)
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
    expect(rows()[6]).toHaveTextContent('Kulminacja napięć w Azji Płd.-Wsch.')
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
    const user = await setup(at({ turn: 4 }))
    await discard(user, 'Blokada')
    expect(counts(copy.cards.states.discarded)).not.toHaveAccessibleName(/w grze/)
    swipe(name, SWIPE_COMMIT_PX + 10)
    expect(stateOf(name)).toBe('in_play')
    expect(counts(copy.cards.states.discarded)).toHaveAccessibleName(/w grze: Dyplomacja Wahadłowa$/)
    expect(rows()[0]).toHaveTextContent(name)
    // Still on top with Zagrane off.
    await openFilters(user)
    await user.click(screen.getByRole('button', { name: copy.cards.playedLast }))
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

  describe('with the order chip', () => {
    // A hand of three values, which takes its places like any card, and three played cards, each on a value's edge.
    const game = () =>
      at({
        inHand: [idOf('Nasser'), idOf('Fidel'), idOf('Zakaz prób jądrowych')],
        states: Object.fromEntries(['Kulminacja napięć w Azji', 'Blokada', 'Dekolonizacja'].map((n) => [idOf(n), 'discarded'])),
      })
    const dividers = () => rows().flatMap((li, i) => (li.dataset.divider ? [`${i}:${li.dataset.divider}`] : []))
    const names = (...indexes: number[]) => indexes.map((i) => rows()[i].textContent)
    const toggleOrder = async (user: User, ...names: string[]) => {
      await openFilters(user)
      for (const name of names) await user.click(screen.getByRole('button', { name }))
    }

    it('on: a line per value, then the red one', async () => {
      await setup(game())
      // Scoring 0–1, 1 ops 2–8, 2 ops 9–19, 3 ops 20–30, 4 ops 31–35, played 36–38.
      expect(dividers()).toEqual(['1:value', '8:value', '19:value', '30:value', '35:played'])
      expect(names(36)).toEqual([expect.stringContaining('Kulminacja napięć w Azji')])
    })

    it('Zagrane off: no red lines, and a played card on a value’s edge still closes it', async () => {
      const user = await setup(game())
      await toggleOrder(user, copy.cards.playedLast)
      expect(dividers().filter((d) => d.endsWith('played'))).toEqual([])
      // The 0 → 1 edge falls between Kulminacja napięć w Europie and the discarded Blokada.
      const edge = rows().findIndex((li) => li.textContent!.includes('Blokada'))
      expect(rows()[edge - 1]).toHaveAttribute('data-divider', 'value')
      expect(rows()[edge]).not.toHaveAttribute('data-divider')
    })

    it('off: one line per value through the whole checklist', async () => {
      const user = await setup(game())
      await toggleOrder(user, copy.cards.playedLast)
      const values = rows().map((li) => CARDS.find((c) => li.textContent!.includes(c.name))!.value)
      const edges = values.flatMap((v, i) => (i < values.length - 1 && values[i + 1] !== v ? [`${i}:value`] : []))
      expect(dividers()).toEqual(edges)
    })
  })

  it('draws a red line where the played cards begin', async () => {
    const user = await setup()
    await discard(user, 'Blokada')
    const last = rows().findLastIndex((li) => li.dataset.state === 'available')
    expect(rows()[last]).toHaveAttribute('data-divider', 'played')
    expect(rows()[last + 1]).toHaveTextContent('Blokada')
    expect(rows().filter((li) => li.dataset.divider === 'played')).toHaveLength(1)
  })

  it('combines groups: USA + Odrzucone shows only discarded US cards', async () => {
    const user = await setup(at({ states: { [idOf('NATO')]: 'discarded', [idOf('Blokada')]: 'discarded' } }))
    await openFilters(user)
    const side = within(screen.getByRole('group', { name: copy.cards.filterGroups.player }))
    await user.click(side.getByRole('button', { name: 'USA' }))
    await user.click(screen.getByRole('button', { name: copy.cards.states.discarded }))
    expect(rows().map((li) => li.textContent)).toEqual([expect.stringContaining('NATO')])
    // Within a group: either side.
    await user.click(side.getByRole('button', { name: 'ZSRR' }))
    expect(rows()).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: copy.cards.clearFilters }))
    expect(rows()).toHaveLength(39)
  })

  it('can’t show the hand while no card is in it', async () => {
    await setup()
    expect(screen.getByRole('button', { name: copy.cards.showHand })).toBeDisabled()
  })

  it('shows only the cards in hand until pressed again, back to the whole list once the hand is empty', async () => {
    const user = await setup(at({ inHand: [idOf('Nasser'), idOf('Fidel')] }))
    const showHand = screen.getByRole('button', { name: copy.cards.showHand })
    // Filters that would hide the hand don't.
    await openFilters(user)
    await user.click(within(screen.getByRole('group', { name: copy.cards.filterGroups.player })).getByRole('button', { name: 'USA' }))
    await user.click(showHand)
    expect(showHand).toHaveAttribute('aria-pressed', 'true')
    expect(rows().map((li) => li.textContent)).toEqual([expect.stringContaining('Nasser'), expect.stringContaining('Fidel')])
    await user.click(showHand)
    expect(showHand).toHaveAttribute('aria-pressed', 'false')
    expect(rows().length).toBeGreaterThan(2)

    await user.click(showHand)
    await discard(user, 'Nasser')
    expect(rows().map((li) => li.textContent)).toEqual([expect.stringContaining('Fidel')])
    await discard(user, 'Fidel')
    expect(showHand).toBeDisabled()
    expect(showHand).toHaveAttribute('aria-pressed', 'false')
    expect(rows().length).toBeGreaterThan(2)
  })

  describe('on two screens', () => {
    const pileTab = (pile: 'available' | 'played') => screen.getByRole('tab', { name: copy.cards.piles[pile] })
    const twoScreens = async (user: User) => {
      await openFilters(user)
      await user.click(screen.getByRole('button', { name: copy.cards.multiScreen }))
    }

    it('starts on two screens, swiping cards and dimming the played ones', async () => {
      const user = await open()
      await openFilters(user)
      expect(screen.getByRole('button', { name: copy.cards.multiScreen })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: copy.cards.swipeCards })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: copy.cards.dimPlayed })).toHaveAttribute('aria-pressed', 'true')
      expect(pileTab('available')).toHaveAttribute('aria-selected', 'true')
      // One screen has no footer tabs.
      await user.click(screen.getByRole('button', { name: copy.cards.singleScreen }))
      expect(screen.queryByRole('tab', { name: copy.cards.piles.available })).not.toBeInTheDocument()
    })

    it('splits the list between the footer tabs: available and in play, then played', async () => {
      const shuttle = idOf('Dyplomacja Wahadłowa')
      const user = await setup(
        at({ turn: 4, states: { [shuttle]: 'in_play', [idOf('Blokada')]: 'discarded', [idOf('NATO')]: 'removed' } }),
      )
      await twoScreens(user)
      expect(pileTab('available')).toHaveAttribute('aria-selected', 'true')
      expect(rows()[0]).toHaveTextContent('Dyplomacja Wahadłowa')
      expect(rows().every((li) => ['available', 'in_play'].includes(li.dataset.state!))).toBe(true)

      await user.click(pileTab('played'))
      expect(rows().map((li) => li.dataset.state).sort()).toEqual(['discarded', 'removed'])
      expect(rows().map((li) => li.dataset.divider)).toEqual([undefined, undefined])

      await user.click(screen.getByRole('button', { name: copy.cards.singleScreen }))
      expect(screen.queryByRole('tab', { name: copy.cards.piles.played })).not.toBeInTheDocument()
      expect(rows().some((li) => li.dataset.state === 'available')).toBe(true)
    })

    it('a discarded card leaves for the other tab', async () => {
      const user = await setup()
      await twoScreens(user)
      await discard(user, 'Blokada')
      expect(rows()).toHaveLength(38)
      await user.click(pileTab('played'))
      expect(rows().map((li) => li.textContent)).toEqual([expect.stringContaining('Blokada')])
    })

    it('offers the swipe choice only on two screens, swiping cards at first', async () => {
      const user = await setup()
      await openFilters(user)
      expect(screen.queryByRole('group', { name: copy.cards.filterGroups.swipe })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: copy.cards.multiScreen }))
      expect(screen.getByRole('button', { name: copy.cards.swipeCards })).toHaveAttribute('aria-pressed', 'true')
      swipe('Blokada', -SWIPE_COMMIT_PX - 10)
      await user.click(pileTab('played'))
      expect(rows().map((li) => li.textContent)).toEqual([expect.stringContaining('Blokada')])
    })

    it('swiping screens moves between the tabs and leaves the cards alone', async () => {
      const user = await setup(at({ states: { [idOf('NATO')]: 'discarded' } }))
      await twoScreens(user)
      await user.click(screen.getByRole('button', { name: copy.cards.swipeScreens }))
      swipe('Blokada', -SWIPE_COMMIT_PX - 10)
      expect(pileTab('played')).toHaveAttribute('aria-selected', 'true')
      expect(rows().map((li) => li.textContent)).toEqual([expect.stringContaining('NATO')])

      swipe('NATO', SWIPE_COMMIT_PX + 10)
      expect(pileTab('available')).toHaveAttribute('aria-selected', 'true')
      expect(rows()).toHaveLength(38)
      // Either way goes to the other screen.
      swipe('Blokada', SWIPE_COMMIT_PX + 10)
      expect(pileTab('played')).toHaveAttribute('aria-selected', 'true')
      swipe('NATO', -SWIPE_COMMIT_PX - 10)
      expect(pileTab('available')).toHaveAttribute('aria-selected', 'true')
      expect(stateOf('Blokada')).toBe('available')
      // A short swipe stays put, and isn't a tap either: the row stays shut.
      swipe('Blokada', -SWIPE_COMMIT_PX / 2)
      expect(pileTab('available')).toHaveAttribute('aria-selected', 'true')
      expect(rowButton('Blokada')).toHaveAttribute('aria-expanded', 'false')
    })

    it('the list follows the finger, either way', async () => {
      const user = await setup()
      await twoScreens(user)
      await user.click(screen.getByRole('button', { name: copy.cards.swipeScreens }))
      const surface = rowButton('Blokada').parentElement!
      fireEvent.pointerDown(surface, { pointerId: 1, button: 0, clientX: 200, clientY: 10 })
      fireEvent.pointerMove(surface, { pointerId: 1, clientX: 160, clientY: 10 })
      expect(list().style.transform).toBe('translateX(-40px)')
      fireEvent.pointerMove(surface, { pointerId: 1, clientX: 240, clientY: 10 })
      expect(list().style.transform).toBe('translateX(40px)')
      // Let go short of a swipe: it eases back into place.
      fireEvent.pointerUp(surface, { pointerId: 1, clientX: 240, clientY: 10 })
      expect(list().style.transform).toBe('')
      expect(pileTab('available')).toHaveAttribute('aria-selected', 'true')
    })

    it('swiping cards, the hand moves to the footer and leaves neither tab up', async () => {
      const user = await setup(at({ inHand: [idOf('Nasser')] }))
      await twoScreens(user)
      const showHand = screen.getByRole('button', { name: copy.cards.showHand })
      expect(showHand.closest('section')).toBeNull()
      await user.click(showHand)
      expect(showHand).toHaveAttribute('aria-pressed', 'true')
      expect(rows().map((li) => li.textContent)).toEqual([expect.stringContaining('Nasser')])
      expect(pileTab('available')).toHaveAttribute('aria-selected', 'false')
      expect(pileTab('played')).toHaveAttribute('aria-selected', 'false')
      // A tab takes the list back to its pile.
      await user.click(pileTab('played'))
      expect(showHand).toHaveAttribute('aria-pressed', 'false')
      expect(pileTab('played')).toHaveAttribute('aria-selected', 'true')

      await user.click(showHand)
      await discard(user, 'Nasser')
      expect(showHand).toBeDisabled()
      expect(pileTab('played')).toHaveAttribute('aria-selected', 'true')
    })

    it('swiping screens, the hand is a third screen, there only while the hand holds a card', async () => {
      const handTab = () => screen.getByRole('tab', { name: copy.cards.handScreen })
      const user = await setup(at({ inHand: [idOf('Nasser')], states: { [idOf('NATO')]: 'discarded' } }))
      await twoScreens(user)
      await user.click(screen.getByRole('button', { name: copy.cards.swipeScreens }))
      expect(screen.queryByRole('button', { name: copy.cards.showHand })).not.toBeInTheDocument()
      swipe('Blokada', -SWIPE_COMMIT_PX - 10)
      swipe('NATO', -SWIPE_COMMIT_PX - 10)
      expect(handTab()).toHaveAttribute('aria-selected', 'true')
      expect(rows().map((li) => li.textContent)).toEqual([expect.stringContaining('Nasser')])
      // Round from the last screen to the first, and back.
      swipe('Nasser', -SWIPE_COMMIT_PX - 10)
      expect(pileTab('available')).toHaveAttribute('aria-selected', 'true')
      swipe('Blokada', SWIPE_COMMIT_PX + 10)
      expect(handTab()).toHaveAttribute('aria-selected', 'true')

      await user.click(pileTab('available'))
      await discard(user, 'Nasser')
      expect(handTab()).toBeDisabled()
      // With the hand empty, swipes skip it.
      swipe('Blokada', SWIPE_COMMIT_PX + 10)
      expect(pileTab('played')).toHaveAttribute('aria-selected', 'true')
    })

    it('can stop dimming the played cards, there only', async () => {
      const user = await setup(at({ states: { [idOf('NATO')]: 'discarded' } }))
      const dimmed = () => rowButton('NATO').querySelector('.opacity-55')
      expect(dimmed()).not.toBeNull()
      await twoScreens(user)
      const dim = screen.getByRole('button', { name: copy.cards.dimPlayed })
      expect(dim).toHaveAttribute('aria-pressed', 'true')
      await user.click(dim)
      await user.click(pileTab('played'))
      expect(dimmed()).toBeNull()
      // One screen keeps them dimmed, the played cards being among the rest there.
      await user.click(screen.getByRole('button', { name: copy.cards.singleScreen }))
      expect(screen.queryByRole('button', { name: copy.cards.dimPlayed })).not.toBeInTheDocument()
      expect(dimmed()).not.toBeNull()
    })

    it('hides the order row, which has nothing left to do, but keeps a way to clear the filters', async () => {
      const user = await setup()
      await twoScreens(user)
      expect(screen.queryByRole('group', { name: copy.cards.filterGroups.order })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: copy.cards.clearFilters })).not.toBeInTheDocument()
      await user.click(within(screen.getByRole('group', { name: copy.cards.filterGroups.player })).getByRole('button', { name: 'USA' }))
      await user.click(screen.getByRole('button', { name: copy.cards.clearFilters }))
      expect(screen.getByRole('button', { name: 'USA' })).toHaveAttribute('aria-pressed', 'false')
    })
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
    await oneScreen(user)
    expect(turn()).toHaveTextContent('2')
    expect(stateOf('Blokada')).toBe('discarded')

    await user.click(screen.getByRole('button', { name: 'Zakończ grę' }))
    await user.click(screen.getByRole('button', { name: 'Zakończ grę' }))
    await user.click(screen.getByRole('button', { name: 'Nowa gra' }))
    expect(turn()).toHaveTextContent('1')
    expect(stateOf('Blokada')).toBe('available')
  })
})
