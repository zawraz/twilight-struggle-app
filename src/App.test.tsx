import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import indexHtml from '../index.html?raw'
import App from './App'
import { SUBMIT_COOLDOWN_MS } from './components/RollTracker'
import { ITEM_HEIGHT, SETTLE_MS } from './components/WheelPicker'
import { copy } from './copy'
import { STORAGE_KEY } from './lib/game'
import { CONFIRM_TIMEOUT_MS } from './lib/useConfirmTap'

type User = ReturnType<typeof userEvent.setup>

const MINUS = '−'
const section = (name: string) => screen.getByRole('region', { name })
const header = () => screen.getByRole('banner')

function setup() {
  // Fake timers that still follow real time, so cooldowns can be skipped on demand.
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const view = render(<App />)
  return { user, ...view }
}

/** Tap a checkmark button, then wait out its cooldown so it can be tapped again. */
async function submitRoll(user: User, button: HTMLElement) {
  await user.click(button)
  act(() => vi.advanceTimersByTime(SUBMIT_COOLDOWN_MS))
}

/** End takes two taps: one to arm, one to confirm. */
async function endGame(user: User) {
  await user.click(within(header()).getByRole('button', { name: 'Zakończ grę' }))
  await user.click(within(header()).getByRole('button', { name: 'Zakończ grę' }))
}

/** + takes two taps too: one to arm, one to confirm. */
async function addFourOps(user: User, player: string) {
  await user.click(screen.getByRole('button', { name: copy.fourOps.add(player) }))
  await user.click(screen.getByRole('button', { name: copy.fourOps.add(player) }))
}

async function startNewGame(user: User) {
  await user.click(within(header()).getByRole('button', { name: 'Nowa gra' }))
}

afterEach(() => {
  vi.useRealTimers()
})

describe('4 Ops Cards', () => {
  const count = (player: string) => screen.getByRole('status', { name: copy.fourOps.count(player) })
  const plus = (player: string) => screen.getByRole('button', { name: copy.fourOps.add(player) })
  const minus = (player: string) => screen.getByRole('button', { name: copy.fourOps.remove(player) })

  it('starts at 0 for both players', () => {
    setup()
    expect(count('ZSRR')).toHaveTextContent('0')
    expect(count('USA')).toHaveTextContent('0')
  })

  it('increments with + and keeps players independent', async () => {
    const { user } = setup()
    await addFourOps(user, 'ZSRR')
    await addFourOps(user, 'ZSRR')
    await addFourOps(user, 'USA')
    expect(count('ZSRR')).toHaveTextContent('2')
    expect(count('USA')).toHaveTextContent('1')
  })

  it('disables − at 0', () => {
    setup()
    expect(minus('ZSRR')).toBeDisabled()
  })

  it('asks for confirmation on the first − tap and decrements on the second', async () => {
    const { user } = setup()
    await addFourOps(user, 'USA')
    await addFourOps(user, 'USA')

    await user.click(minus('USA'))
    expect(count('USA')).toHaveTextContent('2')
    expect(minus('USA')).toHaveAttribute('data-armed', 'true')
    expect(minus('USA')).toHaveClass('text-danger')
    expect(within(section(copy.fourOps.title)).getByText('Potwierdź?')).toBeVisible()

    await user.click(minus('USA'))
    expect(count('USA')).toHaveTextContent('1')
    expect(minus('USA')).toHaveAttribute('data-armed', 'false')
    expect(screen.queryByText('Potwierdź?')).not.toBeInTheDocument()
  })

  it('only arms the − of the player who tapped it', async () => {
    const { user } = setup()
    await addFourOps(user, 'ZSRR')
    await addFourOps(user, 'USA')
    await user.click(minus('ZSRR'))
    expect(minus('ZSRR')).toHaveAttribute('data-armed', 'true')
    expect(minus('USA')).toHaveAttribute('data-armed', 'false')
  })

  it('asks for confirmation on the first + tap and increments on the second', async () => {
    const { user } = setup()
    await user.click(plus('ZSRR'))
    expect(count('ZSRR')).toHaveTextContent('0')
    expect(plus('ZSRR')).toHaveAttribute('data-armed', 'true')
    expect(within(section(copy.fourOps.title)).getByText('Potwierdź?')).toBeVisible()

    await user.click(plus('ZSRR'))
    expect(count('ZSRR')).toHaveTextContent('1')
    expect(plus('ZSRR')).toHaveAttribute('data-armed', 'false')
  })

  it('swaps a pending − for a pending + and back', async () => {
    const { user } = setup()
    await addFourOps(user, 'ZSRR')
    await user.click(minus('ZSRR'))
    await user.click(plus('ZSRR'))
    expect(minus('ZSRR')).toHaveAttribute('data-armed', 'false')
    expect(plus('ZSRR')).toHaveAttribute('data-armed', 'true')
    expect(count('ZSRR')).toHaveTextContent('1')

    await user.click(minus('ZSRR'))
    expect(plus('ZSRR')).toHaveAttribute('data-armed', 'false')
    expect(minus('ZSRR')).toHaveAttribute('data-armed', 'true')
    expect(count('ZSRR')).toHaveTextContent('1')
  })

  it('cancels a pending − after a timeout', () => {
    vi.useFakeTimers()
    render(<App />)
    fireEvent.click(plus('ZSRR'))
    fireEvent.click(plus('ZSRR'))
    fireEvent.click(minus('ZSRR'))
    expect(minus('ZSRR')).toHaveAttribute('data-armed', 'true')

    act(() => vi.advanceTimersByTime(CONFIRM_TIMEOUT_MS))
    expect(minus('ZSRR')).toHaveAttribute('data-armed', 'false')
    expect(count('ZSRR')).toHaveTextContent('1')
  })
})

describe('wheel picker', () => {
  const wheel = () => screen.getByRole('listbox', { name: copy.success.wheel('ZSRR') })
  const selected = () => within(wheel()).getByRole('option', { selected: true })

  it('selects an option when tapped', async () => {
    const { user } = setup()
    expect(selected()).toHaveTextContent('+1')
    await user.click(within(wheel()).getByRole('option', { name: '+4' }))
    expect(selected()).toHaveTextContent('+4')
  })

  it('moves with the arrow keys and stops at the ends', async () => {
    const { user } = setup()
    act(() => wheel().focus())
    await user.keyboard('{ArrowDown}')
    expect(selected()).toHaveTextContent(`${MINUS}1`)
    await user.keyboard('{Home}{ArrowUp}')
    expect(selected()).toHaveTextContent('+5')
    await user.keyboard('{End}{ArrowDown}')
    expect(selected()).toHaveTextContent(`${MINUS}5`)
  })

  it('selects the value the wheel settles on after scrolling', () => {
    vi.useFakeTimers()
    render(<App />)
    const list = wheel()
    // Values top to bottom: +5 +4 +3 +2 +1 −1 −2 −3 …; index 7 is −3.
    Object.defineProperty(list, 'scrollTop', { configurable: true, value: 7 * ITEM_HEIGHT })
    fireEvent.scroll(list)
    expect(selected()).toHaveTextContent('+1')

    act(() => vi.advanceTimersByTime(SETTLE_MS))
    expect(selected()).toHaveTextContent(`${MINUS}3`)
  })

  it('keeps a tapped option when a scroll was still settling', () => {
    vi.useFakeTimers()
    render(<App />)
    const list = wheel()
    let scrollTop = 0
    Object.defineProperty(list, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (v: number) => {
        scrollTop = v
      },
    })
    list.scrollTo = () => {} // smooth scroll: the position does not jump at once
    scrollTop = 7 * ITEM_HEIGHT
    fireEvent.scroll(list) // settle pending on −3
    fireEvent.click(within(list).getByRole('option', { name: '+4' }))

    act(() => vi.advanceTimersByTime(SETTLE_MS * 2))
    expect(selected()).toHaveTextContent('+4')
  })

  it('ignores scroll positions passed on the way to a tapped option', () => {
    vi.useFakeTimers()
    render(<App />)
    const list = wheel()
    let scrollTop = 4 * ITEM_HEIGHT // resting on +1
    Object.defineProperty(list, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (v: number) => {
        scrollTop = v
      },
    })
    list.scrollTo = () => {} // smooth scroll: the browser moves scrollTop over time
    fireEvent.click(within(list).getByRole('option', { name: '+5' }))
    expect(selected()).toHaveTextContent('+5')

    scrollTop = 2 * ITEM_HEIGHT // mid-animation, passing +3
    fireEvent.scroll(list)
    act(() => vi.advanceTimersByTime(SETTLE_MS))
    expect(selected()).toHaveTextContent('+5')

    scrollTop = 0 // arrived at +5
    fireEvent.scroll(list)
    act(() => vi.advanceTimersByTime(SETTLE_MS))
    expect(selected()).toHaveTextContent('+5')
  })

  it('follows a drag that pauses between rows and then moves on', () => {
    vi.useFakeTimers()
    render(<App />)
    const list = wheel()
    let scrollTop = 4 * ITEM_HEIGHT // resting on +1
    Object.defineProperty(list, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (v: number) => {
        scrollTop = v
      },
    })
    list.scrollTo = () => {} // the finger holds the wheel: a programmatic scroll does not move it
    fireEvent.touchStart(list)

    scrollTop = 2 * ITEM_HEIGHT + 5 // the finger pauses just past +3
    fireEvent.scroll(list)
    act(() => vi.advanceTimersByTime(SETTLE_MS))
    expect(selected()).toHaveTextContent('+3')

    scrollTop = 7 * ITEM_HEIGHT // and drags on to −3 before letting go
    fireEvent.scroll(list)
    act(() => vi.advanceTimersByTime(SETTLE_MS))
    expect(selected()).toHaveTextContent(`${MINUS}3`)
  })
})

describe('Success Rolls', () => {
  const pick = (user: User, player: string, label: string) =>
    user.click(
      within(screen.getByRole('listbox', { name: copy.success.wheel(player) })).getByRole('option', { name: label }),
    )
  const confirm = (player: string) => screen.getByRole('button', { name: copy.success.submit(player) })
  const undo = (player: string) => screen.getByRole('button', { name: copy.success.undo(player) })
  const log = (player: string) => screen.getByRole('list', { name: copy.success.log(player) })
  const logged = (player: string) => within(log(player)).queryAllByRole('listitem').map((li) => li.textContent)

  it('offers only −5…+5 without 0', () => {
    setup()
    const options = within(screen.getByRole('listbox', { name: copy.success.wheel('USA') }))
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(options).toEqual(['+5', '+4', '+3', '+2', '+1', ...[1, 2, 3, 4, 5].map((n) => `${MINUS}${n}`)])
  })

  it('turns the checkmark into an undo button for 5 seconds, showing the value just added', async () => {
    const { user } = setup()
    await pick(user, 'ZSRR', '+3')
    await user.click(confirm('ZSRR'))

    expect(undo('ZSRR')).toBeEnabled()
    expect(undo('ZSRR')).toHaveAttribute('data-cooling', 'true')
    expect(undo('ZSRR')).toHaveTextContent('+3')
    expect(screen.getByText('Dodano +3')).toBeInTheDocument()
    expect(confirm('USA')).toBeEnabled() // the other side is unaffected

    act(() => vi.advanceTimersByTime(1500))
    expect(undo('ZSRR')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(SUBMIT_COOLDOWN_MS - 1500))
    expect(screen.queryByRole('button', { name: copy.success.undo('ZSRR') })).not.toBeInTheDocument()
    expect(confirm('ZSRR')).toHaveAttribute('data-cooling', 'false')
    expect(confirm('ZSRR')).toHaveTextContent('')
    expect(logged('ZSRR')).toEqual(['+3'])
  })

  it('takes the roll back when tapped again within 5 seconds', async () => {
    const { user } = setup()
    await pick(user, 'ZSRR', '+3')
    await submitRoll(user, confirm('ZSRR'))
    await pick(user, 'ZSRR', `${MINUS}2`)
    await user.click(confirm('ZSRR'))
    expect(logged('ZSRR')).toEqual(['+3', `${MINUS}2`])

    act(() => vi.advanceTimersByTime(1500))
    await user.click(undo('ZSRR'))

    expect(logged('ZSRR')).toEqual(['+3']) // only the newest roll is taken back
    expect(within(section(copy.success.title)).getByText('1 rzut')).toBeInTheDocument()
    expect(screen.getByText(`Cofnięto ${MINUS}2`)).toBeInTheDocument()
    expect(confirm('ZSRR')).toHaveAttribute('data-cooling', 'false') // ready for the next roll at once
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).rolls.success.ussr).toEqual([3])

    await submitRoll(user, confirm('ZSRR'))
    await endGame(user)
    expect(screen.getByRole('status', { name: copy.success.resultFor('ZSRR') })).toHaveTextContent('+1')
  })

  it('cannot undo once the 5 seconds are over: the tap adds a new roll', async () => {
    const { user } = setup()
    await submitRoll(user, confirm('ZSRR'))
    await user.click(confirm('ZSRR'))
    expect(logged('ZSRR')).toEqual(['+1', '+1'])
  })

  it('flashes each new log entry, even when the value repeats', async () => {
    const { user } = setup()
    await user.click(confirm('ZSRR')) // +1
    const first = within(log('ZSRR')).getByRole('listitem')
    expect(first).toHaveAttribute('data-new', 'true')

    act(() => vi.advanceTimersByTime(SUBMIT_COOLDOWN_MS))
    expect(first).toHaveAttribute('data-new', 'false')

    await user.click(confirm('ZSRR')) // +1 again
    const [older, newest] = within(log('ZSRR')).getAllByRole('listitem')
    expect(newest).not.toBe(first) // a fresh element, so its flash animation runs again
    expect(newest).toHaveTextContent('+1')
    expect(newest).toHaveAttribute('data-new', 'true')
    expect(older).toBe(first)
    expect(older).toHaveAttribute('data-new', 'false')
  })

  it('logs confirmed rolls but keeps the sum hidden until End', async () => {
    const { user } = setup()
    await pick(user, 'ZSRR', '+3')
    await submitRoll(user, confirm('ZSRR'))
    await pick(user, 'ZSRR', `${MINUS}5`)
    await submitRoll(user, confirm('ZSRR'))

    const entries = within(log('ZSRR')).getAllByRole('listitem').map((li) => li.textContent)
    expect(entries).toEqual(['+3', `${MINUS}5`]) // newest on the right
    expect(within(section(copy.success.title)).getByText('2 rzuty')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: copy.success.resultFor('ZSRR') })).not.toBeInTheDocument()
  })

  it('says there are no rolls yet before the first one', () => {
    setup()
    expect(within(section(copy.success.title)).getAllByText('Brak rzutów')).toHaveLength(2)
  })

  it('shows only the last 3 rolls in the log but counts them all', async () => {
    const { user } = setup()
    for (const label of ['+5', '+4', '+3', '+2', `${MINUS}1`]) {
      await pick(user, 'ZSRR', label)
      await submitRoll(user, confirm('ZSRR'))
    }

    const entries = within(log('ZSRR')).getAllByRole('listitem').map((li) => li.textContent)
    expect(entries).toEqual(['+3', '+2', `${MINUS}1`]) // oldest of the last 3 on the left, newest on the right
    expect(within(section(copy.success.title)).getByText('Ostatnie 3 rzuty:')).toBeInTheDocument()
    expect(within(section(copy.success.title)).getByText('5 rzutów')).toBeInTheDocument()

    await endGame(user)
    expect(screen.getByRole('status', { name: copy.success.resultFor('ZSRR') })).toHaveTextContent('+13')
  })

  it('reveals each player sum on End', async () => {
    const { user } = setup()
    await pick(user, 'ZSRR', '+3')
    await submitRoll(user, confirm('ZSRR'))
    await pick(user, 'ZSRR', `${MINUS}1`)
    await submitRoll(user, confirm('ZSRR'))
    await pick(user, 'USA', `${MINUS}4`)
    await submitRoll(user, confirm('USA'))

    await endGame(user)
    expect(screen.getByRole('status', { name: copy.success.resultFor('ZSRR') })).toHaveTextContent('+2')
    expect(screen.getByRole('status', { name: copy.success.resultFor('USA') })).toHaveTextContent(`${MINUS}4`)
  })
})

describe('Dice EV', () => {
  const pick = (user: User, player: string, label: string) =>
    user.click(within(screen.getByRole('listbox', { name: copy.dice.wheel(player) })).getByRole('option', { name: label }))
  const add = (player: string) => screen.getByRole('button', { name: copy.dice.submit(player) })

  it('offers 6 to 1, highest on top', () => {
    setup()
    const options = within(screen.getByRole('listbox', { name: copy.dice.wheel('ZSRR') }))
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(options).toEqual(['6', '5', '4', '3', '2', '1'])
  })

  it('uses the same checkmark button as Success Rolls, with no text', () => {
    setup()
    const buttons = [
      add('ZSRR'),
      add('USA'),
      screen.getByRole('button', { name: copy.success.submit('ZSRR') }),
      screen.getByRole('button', { name: copy.success.submit('USA') }),
    ]
    for (const button of buttons) {
      expect(button).toHaveTextContent('')
      expect(button.querySelector('svg')).toBeInTheDocument()
    }
    expect(add('ZSRR').className.replaceAll('ussr', 'X')).toBe(
      screen.getByRole('button', { name: copy.success.submit('ZSRR') }).className.replaceAll('ussr', 'X'),
    )
  })

  it('offers to undo for 5 seconds after adding', async () => {
    const { user } = setup()
    await pick(user, 'USA', '5')
    await user.click(add('USA'))
    const undo = screen.getByRole('button', { name: copy.dice.undo('USA') })
    expect(undo).toHaveTextContent('5')

    await user.click(undo)
    expect(within(screen.getByRole('list', { name: copy.dice.log('USA') })).queryAllByRole('listitem')).toHaveLength(0)
    expect(within(section(copy.dice.title)).getAllByText('Brak rzutów')).toHaveLength(2)
    expect(add('USA')).toBeEnabled()
  })

  it('stores added rolls and reveals the average on End', async () => {
    const { user } = setup()
    await pick(user, 'USA', '6')
    await submitRoll(user, add('USA'))
    await pick(user, 'USA', '3')
    await submitRoll(user, add('USA'))
    await submitRoll(user, add('USA')) // 3 again
    expect(screen.queryByRole('status', { name: copy.dice.resultFor('USA') })).not.toBeInTheDocument()

    await endGame(user)
    expect(screen.getByRole('status', { name: copy.dice.resultFor('USA') })).toHaveTextContent('4,00')
    expect(screen.getByRole('status', { name: copy.dice.resultFor('ZSRR') })).toHaveTextContent('—')
  })

  it('keeps Dice EV separate from Success Rolls', async () => {
    const { user } = setup()
    await submitRoll(user, add('ZSRR'))
    await endGame(user)
    expect(screen.getByRole('status', { name: copy.success.resultFor('ZSRR') })).toHaveTextContent('0')
  })
})

describe('header: End and New Game', () => {
  const opsCount = (player: string) => screen.getByRole('status', { name: copy.fourOps.count(player) })

  async function playSomeRounds(user: User) {
    await addFourOps(user, 'ZSRR')
    await addFourOps(user, 'ZSRR')
    await submitRoll(user, screen.getByRole('button', { name: copy.success.submit('USA') })) // +1
    await submitRoll(user, screen.getByRole('button', { name: copy.dice.submit('USA') })) // 1
  }

  it('names the app and holds the End button', () => {
    setup()
    expect(within(header()).getByRole('heading', { level: 1 })).toHaveTextContent(/^Twilight Struggle$/)
    expect(screen.getAllByRole('button', { name: 'Zakończ grę' })).toHaveLength(1)
    expect(within(header()).getByRole('button', { name: 'Zakończ grę' })).toBeInTheDocument()
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
  })

  it('asks for confirmation before ending', async () => {
    const { user } = setup()
    await playSomeRounds(user)
    const end = within(header()).getByRole('button', { name: 'Zakończ grę' })

    expect(end).not.toHaveClass('bg-danger')
    await user.click(end)
    expect(end).toHaveAttribute('data-armed', 'true')
    expect(end).toHaveClass('bg-danger')
    expect(within(header()).getByText('Potwierdź?')).toBeVisible()
    expect(screen.queryByRole('status', { name: copy.success.resultFor('USA') })).not.toBeInTheDocument()

    await user.click(end)
    expect(screen.getByRole('status', { name: copy.success.resultFor('USA') })).toHaveTextContent('+1')
    expect(screen.getByRole('status', { name: copy.dice.resultFor('USA') })).toHaveTextContent('1,00')
  })

  it('cancels a pending End after a timeout', () => {
    vi.useFakeTimers()
    render(<App />)
    fireEvent.click(within(header()).getByRole('button', { name: 'Zakończ grę' }))
    act(() => vi.advanceTimersByTime(CONFIRM_TIMEOUT_MS))
    expect(within(header()).getByRole('button', { name: 'Zakończ grę' })).toHaveAttribute('data-armed', 'false')

    fireEvent.click(within(header()).getByRole('button', { name: 'Zakończ grę' }))
    expect(screen.queryByRole('status', { name: copy.success.resultFor('USA') })).not.toBeInTheDocument()
  })

  it('swaps End for New Game and locks the trackers', async () => {
    const { user } = setup()
    await playSomeRounds(user)
    await endGame(user)

    expect(within(header()).queryByRole('button', { name: 'Zakończ grę' })).not.toBeInTheDocument()
    expect(within(header()).getByRole('button', { name: 'Nowa gra' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: copy.fourOps.add('ZSRR') })).toBeDisabled()
    expect(screen.getByRole('button', { name: copy.fourOps.remove('ZSRR') })).toBeDisabled()
    expect(screen.getByRole('button', { name: copy.success.submit('USA') })).toBeDisabled()
    expect(screen.getByRole('button', { name: copy.dice.submit('USA') })).toBeDisabled()
    // The wheels lock too: greyed out, and a tap on another value does nothing.
    const wheel = screen.getByRole('listbox', { name: copy.dice.wheel('USA') })
    expect(wheel).toHaveAttribute('aria-disabled', 'true')
    await user.click(within(wheel).getByRole('option', { name: '4' }))
    expect(within(wheel).getByRole('option', { selected: true })).toHaveTextContent('1')
    // The four-ops counts and each summary stay at full strength.
    expect(opsCount('ZSRR')).toHaveTextContent('2')
    expect(screen.getByRole('status', { name: copy.success.resultFor('USA') })).toHaveTextContent('+1')
  })

  it('resets everything on a single New Game tap', async () => {
    const { user } = setup()
    await playSomeRounds(user)
    await endGame(user)
    expect(opsCount('ZSRR')).toHaveTextContent('2')

    await user.click(within(header()).getByRole('button', { name: 'Nowa gra' }))
    expect(screen.queryByText('Potwierdź?')).not.toBeInTheDocument()
    await user.click(within(header()).getByRole('tab', { name: 'Dziennik' }))
    expect(opsCount('ZSRR')).toHaveTextContent('0')
    expect(screen.getAllByText('Brak rzutów')).toHaveLength(4)
    expect(screen.queryByRole('status', { name: copy.success.resultFor('USA') })).not.toBeInTheDocument()
    expect(within(header()).getByRole('button', { name: 'Zakończ grę' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: copy.fourOps.add('ZSRR') })).toBeEnabled()
  })
})

describe('header: End and New Game switch tabs', () => {
  const selected = () => within(header()).getByRole('tab', { selected: true })

  it('ending moves to Dziennik, a new game to Karty', async () => {
    const { user } = setup()
    await user.click(within(header()).getByRole('tab', { name: 'Karty' }))
    await endGame(user)
    expect(selected()).toHaveAccessibleName('Dziennik')

    await user.click(within(header()).getByRole('button', { name: 'Nowa gra' }))
    expect(selected()).toHaveAccessibleName('Karty')
  })
})

describe('header tabs', () => {
  const tab = (name: string) => within(header()).getByRole('tab', { name })

  it('opens on Dziennik with the game log', () => {
    setup()
    expect(within(header()).getAllByRole('tab').map((t) => t.getAttribute('aria-label'))).toEqual(['Karty', 'Dziennik'])
    expect(tab('Karty')).toHaveTextContent('') // icon only

    expect(tab('Dziennik')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: 'Dziennik' })).toContainElement(section(copy.fourOps.title))
  })

  it('switches to Karty and hides the log', async () => {
    const { user } = setup()
    await user.click(tab('Karty'))
    expect(tab('Karty')).toHaveAttribute('aria-selected', 'true')
    expect(tab('Dziennik')).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tabpanel', { name: 'Karty' })).toBeVisible()
    expect(screen.queryByRole('region', { name: copy.fourOps.title })).not.toBeInTheDocument()
  })

  it('toggles when the selected tab is tapped', async () => {
    const { user } = setup()
    await user.click(tab('Dziennik'))
    expect(tab('Karty')).toHaveAttribute('aria-selected', 'true')
    await user.click(tab('Karty'))
    expect(tab('Dziennik')).toHaveAttribute('aria-selected', 'true')
  })

  it('keeps the log as it was after a round trip', async () => {
    const { user } = setup()
    const wheel = () => screen.getByRole('listbox', { name: copy.success.wheel('ZSRR') })
    await user.click(within(wheel()).getByRole('option', { name: '+4' }))
    await user.click(tab('Karty'))
    await user.click(tab('Dziennik'))
    expect(within(wheel()).getByRole('option', { selected: true })).toHaveTextContent('+4')
  })

  it('moves between tabs with the arrow keys', async () => {
    const { user } = setup()
    act(() => tab('Dziennik').focus())
    await user.keyboard('{ArrowLeft}')
    expect(tab('Karty')).toHaveFocus()
    expect(tab('Karty')).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{ArrowLeft}')
    expect(tab('Dziennik')).toHaveFocus()
  })
})

describe('Polish interface', () => {
  it('shows every label in Polish', async () => {
    const { user } = setup()
    for (const text of ['Karty 4 PO', 'Rzuty na sukces', 'EV rzutów']) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Zakończ grę' })).toBeInTheDocument()
    // The card list (in the hidden Karty panel) has side labels of its own.
    const log = within(screen.getByRole('tabpanel', { name: 'Dziennik' }))
    expect(log.getAllByText('ZSRR')).toHaveLength(3)
    expect(log.getAllByText('USA')).toHaveLength(3)
    expect(screen.getAllByText('0 rzutów')).toHaveLength(4)
    expect(screen.getAllByText('Brak rzutów')).toHaveLength(4)
    expect(screen.getAllByText('Ostatnie 3 rzuty:')).toHaveLength(2) // one caption shared by both players

    await submitRoll(user, screen.getByRole('button', { name: copy.dice.submit('USA') }))
    expect(screen.getAllByText('Brak rzutów')).toHaveLength(3)
    await endGame(user)
    expect(screen.getAllByText('Suma')).toHaveLength(2)
    expect(screen.getAllByText('Średnia')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Nowa gra' })).toBeInTheDocument()
  })

  it('declares the page language as Polish', () => {
    expect(indexHtml).toContain('<html lang="pl">')
  })
})

describe('saved progress', () => {
  it('restores the game after a reload', async () => {
    const { user, unmount } = setup()
    await addFourOps(user, 'USA')
    await user.click(
      within(screen.getByRole('listbox', { name: copy.success.wheel('ZSRR') })).getByRole('option', { name: '+4' }),
    )
    await submitRoll(user, screen.getByRole('button', { name: copy.success.submit('ZSRR') }))
    unmount()

    setup()
    expect(screen.getByRole('status', { name: copy.fourOps.count('USA') })).toHaveTextContent('1')
    expect(within(screen.getByRole('list', { name: copy.success.log('ZSRR') })).getByRole('listitem')).toHaveTextContent(
      '+4',
    )
  })

  it('restores an ended game with its results and New Game', async () => {
    const { user, unmount } = setup()
    await submitRoll(user, screen.getByRole('button', { name: copy.dice.submit('ZSRR') }))
    await endGame(user)
    unmount()

    setup()
    expect(screen.getByRole('status', { name: copy.dice.resultFor('ZSRR') })).toHaveTextContent('1,00')
    expect(within(header()).getByRole('button', { name: 'Nowa gra' })).toBeInTheDocument()
  })

  it('stays fresh after New Game and a reload', async () => {
    const { user, unmount } = setup()
    await addFourOps(user, 'USA')
    await endGame(user)
    await startNewGame(user)
    unmount()

    setup()
    expect(screen.getByRole('status', { name: copy.fourOps.count('USA') })).toHaveTextContent('0')
    expect(within(header()).getByRole('button', { name: 'Zakończ grę' })).toBeInTheDocument()
  })

  it('starts fresh when the saved game is unreadable', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    setup()
    expect(screen.getByRole('status', { name: copy.fourOps.count('ZSRR') })).toHaveTextContent('0')
  })
})

