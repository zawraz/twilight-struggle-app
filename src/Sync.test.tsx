import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { SUBMIT_COOLDOWN_MS } from './components/RollTracker'
import { copy } from './copy'
import { CARDS_STORAGE_KEY } from './lib/cardGame'
import { newRoom, roomReducer, type RoomState } from './lib/room'
import type { OnlineGame } from './lib/syncServer'
import { MY_HAND_KEY, THEIR_HAND_KEY } from './lib/useMyHand'
import { CHECK_TIMEOUT_MS } from './lib/useOnlineGame'
import { SYNC_MODE_KEY } from './lib/useRoom'
import { fakeServer, type FakeServer } from './test/fakeServer'

type User = ReturnType<typeof userEvent.setup>

const header = () => screen.getByRole('banner')
const turn = () => screen.getByRole('status', { name: /^Tura \d+ z 10$/ })

/** A game at this turn. */
function atTurn(n: number): RoomState {
  let state = newRoom()
  for (let t = 1; t < n; t++) state = roomReducer(state, { target: 'cards', action: { type: 'nextTurn' } })
  return state
}
const online = (n: number, updatedAt = Date.now()): OnlineGame => ({ state: atTurn(n), updatedAt })

/** What this phone remembers from before the app was opened. */
function stored(mode: 'online' | 'offline', state: RoomState) {
  localStorage.setItem(SYNC_MODE_KEY, mode)
  localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(state.cards))
}

function setup(fake: FakeServer) {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(<App server={fake} />)
  return user
}

const cardsTab = (user: User) => user.click(screen.getByRole('tab', { name: 'Karty' }))

async function nextTurn(user: User) {
  if (screen.queryByRole('button', { name: copy.cards.undoTurn })) act(() => vi.advanceTimersByTime(SUBMIT_COOLDOWN_MS))
  await user.click(screen.getByRole('button', { name: copy.cards.nextTurn }))
}

async function endGame(user: User) {
  await user.click(within(header()).getByRole('button', { name: copy.end }))
  await user.click(within(header()).getByRole('button', { name: copy.end }))
}

/** Ends the game, presses New Game and picks a mode in the dialog. */
async function chooseNewGame(user: User, label: string) {
  await endGame(user)
  await user.click(within(header()).getByRole('button', { name: copy.newGame }))
  await user.click(within(screen.getByRole('dialog', { name: copy.newGameDialog.title })).getByRole('button', { name: new RegExp(`^${label}`) }))
}

afterEach(() => {
  vi.useRealTimers()
})

describe('New Game: Offline or Online', () => {
  it('asks Offline or Online, and Cancel keeps the ended game', async () => {
    const user = setup(fakeServer())
    await endGame(user)
    await user.click(within(header()).getByRole('button', { name: copy.newGame }))
    const dialog = screen.getByRole('dialog', { name: copy.newGameDialog.title })
    expect(within(dialog).getByRole('button', { name: /^Offline/ })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /^Online/ })).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: copy.newGameDialog.cancel }))
    expect(screen.queryByRole('dialog', { name: copy.newGameDialog.title })).not.toBeInTheDocument()
    expect(within(header()).getByRole('button', { name: copy.newGame })).toBeInTheDocument()
  })

  it('an offline new game never touches the server', async () => {
    const fake = fakeServer()
    const user = setup(fake)
    await cardsTab(user)
    await nextTurn(user)
    await chooseNewGame(user, 'Offline')
    expect(turn()).toHaveAccessibleName('Tura 1 z 10')
    expect(fake.opens).toBe(0)
    expect(fake.game).toBeNull()
    expect(localStorage.getItem(SYNC_MODE_KEY)).toBe('offline')
  })

  it('an online new game replaces the online game and syncs', async () => {
    const fake = fakeServer(online(5))
    const user = setup(fake)
    await chooseNewGame(user, 'Online')
    expect(fake.game?.state).toEqual(newRoom())
    // New Game lands on the Karty tab.
    await nextTurn(user)
    expect(fake.game?.state.cards.turn).toBe(2)
    expect(turn()).toHaveAccessibleName('Tura 2 z 10')
    expect(localStorage.getItem(SYNC_MODE_KEY)).toBe('online')
  })

  it('an offline new game on a synced phone leaves the online game alone', async () => {
    stored('online', atTurn(3))
    const fake = fakeServer(online(3))
    const user = setup(fake)
    // Ending is a change to the online game like any other; New Game → Offline is not.
    await endGame(user)
    const ended = fake.game
    await user.click(within(header()).getByRole('button', { name: copy.newGame }))
    await user.click(screen.getByRole('button', { name: /^Offline/ }))
    expect(fake.game).toBe(ended)
    expect(fake.game?.state.cards.turn).toBe(3)
    expect(fake.open).toBe(false)
    expect(turn()).toHaveAccessibleName('Tura 1 z 10')
  })
})

describe('A synced phone', () => {
  it('resets when the other phone starts a new online game, and drops its hand', async () => {
    stored('online', atTurn(3))
    localStorage.setItem(MY_HAND_KEY, JSON.stringify([5]))
    localStorage.setItem(THEIR_HAND_KEY, JSON.stringify([6]))
    const fake = fakeServer(online(3))
    const user = setup(fake)
    await cardsTab(user)
    expect(turn()).toHaveAccessibleName('Tura 3 z 10')
    act(() => fake.replace({ state: newRoom(), updatedAt: Date.now() }))
    expect(turn()).toHaveAccessibleName('Tura 1 z 10')
    expect(JSON.parse(localStorage.getItem(MY_HAND_KEY)!)).toEqual([])
    expect(JSON.parse(localStorage.getItem(THEIR_HAND_KEY)!)).toEqual([])
  })

  it('after a reload shows the last game at once, read-only until the server answers', async () => {
    stored('online', atTurn(4))
    const fake = fakeServer(online(6), { held: true })
    const user = setup(fake)
    await cardsTab(user)
    expect(turn()).toHaveAccessibleName('Tura 4 z 10')
    await nextTurn(user)
    expect(turn()).toHaveAccessibleName('Tura 4 z 10')
    act(() => fake.release())
    expect(turn()).toHaveAccessibleName('Tura 6 z 10')
    await nextTurn(user)
    expect(turn()).toHaveAccessibleName('Tura 7 z 10')
    expect(fake.game?.state.cards.turn).toBe(7)
  })
})

describe('The people panel', () => {
  const openPanel = (user: User) => user.click(within(header()).getByRole('button', { name: copy.sync.open }))
  const panel = () => screen.getByRole('dialog', { name: copy.sync.title })
  const closePanel = (user: User) => user.click(within(panel()).getByRole('button', { name: copy.sync.close }))

  it('on an offline phone finds the online game and joins after two taps', async () => {
    const fake = fakeServer(online(3, Date.now() - 2 * 60_000))
    const user = setup(fake)
    await openPanel(user)
    expect(within(panel()).getByText(copy.sync.found(3, '2 min temu'))).toBeInTheDocument()
    expect(within(panel()).getByText(copy.sync.joinWarning)).toBeInTheDocument()
    await user.click(within(panel()).getByRole('button', { name: copy.sync.join }))
    expect(localStorage.getItem(SYNC_MODE_KEY)).not.toBe('online')
    await user.click(within(panel()).getByRole('button', { name: copy.sync.join }))
    expect(localStorage.getItem(SYNC_MODE_KEY)).toBe('online')
    expect(screen.getByText(copy.sync.joined)).toBeInTheDocument()
    await cardsTab(user)
    expect(turn()).toHaveAccessibleName('Tura 3 z 10')
  })

  it('joins the latest online game, not the one first shown', async () => {
    const fake = fakeServer(online(3))
    const user = setup(fake)
    await openPanel(user)
    await user.click(within(panel()).getByRole('button', { name: copy.sync.join }))
    act(() => fake.replace(online(4)))
    await user.click(within(panel()).getByRole('button', { name: copy.sync.join }))
    await cardsTab(user)
    expect(turn()).toHaveAccessibleName('Tura 4 z 10')
  })

  it('offers no way into an online game that has ended', async () => {
    const ended = online(4)
    ended.state = roomReducer(ended.state, { target: 'game', action: { type: 'end' } })
    const fake = fakeServer(ended)
    const user = setup(fake)
    await openPanel(user)
    expect(within(panel()).getByText(copy.sync.ended(4))).toBeInTheDocument()
    expect(within(panel()).queryByRole('button', { name: copy.sync.join })).not.toBeInTheDocument()
  })

  it('takes Join away if the online game ends between the two taps', async () => {
    const fake = fakeServer(online(3))
    const user = setup(fake)
    await openPanel(user)
    await user.click(within(panel()).getByRole('button', { name: copy.sync.join }))
    act(() => fake.replace({ ...fake.game!, state: roomReducer(fake.game!.state, { target: 'game', action: { type: 'end' } }) }))
    expect(within(panel()).queryByRole('button', { name: copy.sync.join })).not.toBeInTheDocument()
    expect(localStorage.getItem(SYNC_MODE_KEY)).not.toBe('online')
  })

  it('says when there is no online game', async () => {
    const user = setup(fakeServer(null))
    await openPanel(user)
    expect(within(panel()).getByText(copy.sync.none)).toBeInTheDocument()
    expect(within(panel()).queryByRole('button', { name: copy.sync.join })).not.toBeInTheDocument()
  })

  it('gives up waiting for the server after CHECK_TIMEOUT_MS', async () => {
    const user = setup(fakeServer(online(2), { held: true }))
    await openPanel(user)
    expect(within(panel()).getByText(copy.sync.checking)).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(CHECK_TIMEOUT_MS))
    expect(within(panel()).getByText(copy.sync.unreachable)).toBeInTheDocument()
  })

  it('on an offline phone closes the connection when it closes', async () => {
    const fake = fakeServer(online(2))
    const user = setup(fake)
    await openPanel(user)
    expect(fake.open).toBe(true)
    await closePanel(user)
    expect(fake.open).toBe(false)
  })

  it('on a synced phone turns sync off and keeps the game, even without a connection', async () => {
    stored('online', atTurn(3))
    const fake = fakeServer(online(3))
    const user = setup(fake)
    await cardsTab(user)
    act(() => fake.setConnected(false))
    await nextTurn(user)
    expect(turn()).toHaveAccessibleName('Tura 4 z 10')
    await openPanel(user)
    await user.click(within(panel()).getByRole('button', { name: copy.sync.leave }))
    expect(localStorage.getItem(SYNC_MODE_KEY)).toBe('offline')
    expect(fake.open).toBe(false)
    expect(screen.getByText(copy.sync.left)).toBeInTheDocument()
    expect(turn()).toHaveAccessibleName('Tura 4 z 10')
    await nextTurn(user)
    expect(turn()).toHaveAccessibleName('Tura 5 z 10')
    // What waited for the connection never left this phone: Convex drops it when the client closes.
    expect(fake.game?.state.cards.turn).toBe(3)
  })

  it('lets a phone that turned sync off join again', async () => {
    stored('online', atTurn(3))
    const fake = fakeServer(online(3))
    const user = setup(fake)
    await openPanel(user)
    await user.click(within(panel()).getByRole('button', { name: copy.sync.leave }))
    act(() => fake.replace(online(5)))
    await openPanel(user)
    expect(within(panel()).getByText(copy.sync.found(5, 'przed chwilą'))).toBeInTheDocument()
    await user.click(within(panel()).getByRole('button', { name: copy.sync.join }))
    await user.click(within(panel()).getByRole('button', { name: copy.sync.join }))
    expect(localStorage.getItem(SYNC_MODE_KEY)).toBe('online')
    await cardsTab(user)
    expect(turn()).toHaveAccessibleName('Tura 5 z 10')
  })

  it('marks a lost connection on the icon only while online', async () => {
    stored('online', atTurn(2))
    const fake = fakeServer(online(2))
    const user = setup(fake)
    expect(screen.queryByTestId('sync-offline-mark')).not.toBeInTheDocument()
    act(() => fake.setConnected(false))
    expect(screen.getByTestId('sync-offline-mark')).toBeInTheDocument()
    await openPanel(user)
    await user.click(within(panel()).getByRole('button', { name: copy.sync.leave }))
    expect(screen.queryByTestId('sync-offline-mark')).not.toBeInTheDocument()
  })
})
