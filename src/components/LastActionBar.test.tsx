import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { copy } from '../copy'
import { newGame } from '../lib/game'
import type { Move } from '../lib/room'
import { LastActionBar } from './LastActionBar'

const bar = () => screen.getByRole('region', { name: copy.cards.lastAction })
const props = { undoable: true, onUndo: () => {} }

describe('LastActionBar', () => {
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
})
