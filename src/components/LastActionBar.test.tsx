import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { copy } from '../copy'
import { newGame } from '../lib/game'
import type { Move } from '../lib/room'
import { playMoveSound } from '../lib/sound'
import { LastActionBar } from './LastActionBar'

vi.mock('../lib/sound', () => ({ playMoveSound: vi.fn() }))

const bar = () => screen.getByRole('region', { name: copy.cards.lastAction })
const props = { undoable: true, onUndo: () => {} }

describe('LastActionBar', () => {
  beforeEach(() => {
    vi.mocked(playMoveSound).mockClear()
  })

  it('flashes an online move once: the server copy, keys in another order, is the same move', () => {
    const before = newGame()
    // This phone's optimistic copy, as the app builds it.
    const move: Move = { type: 'roll', track: 'dice', player: 'us', value: 4, armed: true }
    const game = { ...before, rolls: { ...before.rolls, dice: { ussr: [], us: [4] } } }
    // The server's answer: the same, its keys sorted the way Convex returns them.
    const serverMove = { armed: true, player: 'us', track: 'dice', type: 'roll', value: 4 } as Move
    const serverGame = {
      fourOps: { us: 0, ussr: 0 },
      rolls: { dice: { us: [4], ussr: [] }, success: { us: [], ussr: [] } },
    }

    const { rerender } = render(<LastActionBar moves={[]} game={before} {...props} />)
    rerender(<LastActionBar moves={[move]} game={game} {...props} />)
    const flashed = bar()
    expect(flashed).toHaveAttribute('data-flash', 'true')
    rerender(<LastActionBar moves={[serverMove]} game={serverGame} {...props} />)
    expect(bar()).toBe(flashed) // not mounted afresh: no second flash
  })

  it('sounds once per new move: a roll, a discard, a removal, a new turn, nothing for a card put back', () => {
    const game = newGame()
    const roll: Move = { type: 'roll', track: 'dice', player: 'us', value: 4, armed: true }
    const played: Move = { type: 'card', id: 1, state: 'discarded', by: null, before: null }
    const removed: Move = { type: 'card', id: 2, state: 'removed', by: null, before: null }
    const putBack: Move = { type: 'card', id: 1, state: 'available', by: null, before: null }
    const turn: Move = { type: 'turn', turn: 2, armed: true }

    const { rerender } = render(<LastActionBar moves={[]} game={game} {...props} />)
    expect(playMoveSound).not.toHaveBeenCalled()
    rerender(<LastActionBar moves={[roll]} game={game} {...props} />)
    expect(playMoveSound).toHaveBeenLastCalledWith('roll')
    rerender(<LastActionBar moves={[roll, played]} game={game} {...props} />)
    expect(playMoveSound).toHaveBeenLastCalledWith('discard')
    rerender(<LastActionBar moves={[roll, played, removed]} game={game} {...props} />)
    expect(playMoveSound).toHaveBeenLastCalledWith('remove')
    rerender(<LastActionBar moves={[played, removed, turn]} game={game} {...props} />)
    expect(playMoveSound).toHaveBeenLastCalledWith('turn')
    rerender(<LastActionBar moves={[played, removed, putBack]} game={game} {...props} />)
    rerender(<LastActionBar moves={[played, removed]} game={game} {...props} />) // taken back
    expect(playMoveSound).toHaveBeenCalledTimes(4)
  })
})
