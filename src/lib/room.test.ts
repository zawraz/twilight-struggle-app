import { describe, expect, it } from 'vitest'
import { CODE_LENGTH, isRoomState, makeRoomCode, newRoom, normalizeRoomCode, roomReducer } from './room'

describe('roomReducer', () => {
  it('sends each action to its own part of the game', () => {
    const afterRoll = roomReducer(newRoom(), { target: 'game', action: { type: 'addRoll', track: 'dice', player: 'us', value: 6 } })
    expect(afterRoll.game.rolls.dice.us).toEqual([6])
    expect(afterRoll.cards).toEqual(newRoom().cards)

    const afterTurn = roomReducer(afterRoll, { target: 'cards', action: { type: 'nextTurn' } })
    expect(afterTurn.cards.turn).toBe(2)
    expect(afterTurn.game).toBe(afterRoll.game)
  })

  it('leaves a state the validator rejects when the action is nonsense', () => {
    const next = roomReducer(newRoom(), { target: 'game', action: { type: 'nope' } as never })
    expect(isRoomState(next)).toBe(false)
  })
})

describe('isRoomState', () => {
  it('accepts a new room and a game that went through JSON, as the server stores it', () => {
    const played = roomReducer(newRoom(), { target: 'cards', action: { type: 'setCardState', id: 43, state: 'discarded' } })
    expect(isRoomState(newRoom())).toBe(true)
    expect(isRoomState(JSON.parse(JSON.stringify(played)))).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isRoomState(null)).toBe(false)
    expect(isRoomState({ game: newRoom().game })).toBe(false)
  })
})

describe('room codes', () => {
  it('makes codes that read back as themselves', () => {
    for (let i = 0; i < 50; i++) {
      const code = makeRoomCode()
      expect(code).toHaveLength(CODE_LENGTH)
      expect(normalizeRoomCode(code)).toBe(code)
    }
  })

  it('takes a typed code in any case, with stray spaces', () => {
    expect(normalizeRoomCode(' xk4pa ')).toBe('XK4PA')
  })

  it('refuses codes of the wrong length or with look-alike characters', () => {
    expect(normalizeRoomCode('XK4P')).toBeNull()
    expect(normalizeRoomCode('XK4PAB')).toBeNull()
    expect(normalizeRoomCode('XK0PA')).toBeNull()
    expect(normalizeRoomCode('')).toBeNull()
  })
})
