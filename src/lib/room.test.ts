import { describe, expect, it } from 'vitest'
import { ASK_NOT, cardsReducer, TEHRAN } from './cardGame'
import { CARDS } from './cards'
import { canUndo, CODE_LENGTH, isRoomState, makeRoomCode, newRoom, normalizeRoomCode, roomReducer, withMoves, type RoomAction, type RoomState } from './room'

const idOf = (name: string) => CARDS.find((c) => c.name === name)!.id
const NATO = idOf('NATO')
const BLOCKADE = idOf('Blokada')
const run = (state: RoomState, ...actions: RoomAction[]) => actions.reduce(roomReducer, state)
const atTurn5 = () => run(newRoom(), ...Array.from({ length: 4 }, (): RoomAction => ({ target: 'cards', action: { type: 'nextTurn' } })))

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

const last = (state: RoomState) => state.moves.at(-1)
const undo: RoomAction = { target: 'undoLast' }
const rollOf = (value: number): RoomAction => ({ target: 'game', action: { type: 'addRoll', track: 'success', player: 'us', value } })

describe('roomReducer: card moves', () => {
  it('remembers a play and takes it back, 4 Ops count included', () => {
    const played = run(newRoom(), { target: 'play', id: NATO, state: 'removed', by: 'ussr' })
    expect(played.game.fourOps.ussr).toBe(1)
    expect(last(played)).toMatchObject({ type: 'card', id: NATO, state: 'removed', by: 'ussr' })
    expect(isRoomState(JSON.parse(JSON.stringify(played)))).toBe(true)

    const undone = roomReducer(played, undo)
    expect(undone.cards).toEqual(newRoom().cards)
    expect(undone.game.fourOps.ussr).toBe(0)
    expect(undone.moves).toEqual([])
  })

  it('counts only 4 Ops cards, and nothing once the game has ended', () => {
    expect(run(newRoom(), { target: 'play', id: BLOCKADE, state: 'discarded', by: 'us' }).game.fourOps.us).toBe(0)
    const ended = run(newRoom(), { target: 'game', action: { type: 'end' } }, { target: 'play', id: NATO, state: 'removed', by: 'us' })
    expect(ended.game.fourOps.us).toBe(0)
    expect(last(ended)).toMatchObject({ by: null })
  })

  it('ignores a play that changes nothing', () => {
    const played = run(newRoom(), { target: 'play', id: BLOCKADE, state: 'discarded', by: null })
    expect(roomReducer(played, { target: 'play', id: BLOCKADE, state: 'in_play', by: null })).toBe(played)
  })

  it('a turn is a move too, so a card played before it is taken back after it', () => {
    const played = run(newRoom(), { target: 'play', id: BLOCKADE, state: 'discarded', by: null })
    const turned = roomReducer(played, { target: 'cards', action: { type: 'nextTurn' } })
    expect(last(turned)).toEqual({ type: 'turn', turn: 2, armed: true })
    const back = run(turned, undo, undo)
    expect(back.cards).toEqual(newRoom().cards)
    expect(roomReducer(played, { target: 'cards', action: { type: 'newGame' } }).moves).toEqual([])
  })

  it('going back with the turn button takes the turn out, and the moves made on it can no longer be undone', () => {
    const turned = run(newRoom(), { target: 'cards', action: { type: 'nextTurn' } }, rollOf(1))
    const back = roomReducer(turned, { target: 'cards', action: { type: 'previousTurn' } })
    expect(back.moves).toEqual([{ type: 'roll', track: 'success', player: 'us', value: 1, armed: false }])
    expect(canUndo(back)).toBe(false)
  })

  it('an event and its play are one move, and Ask Not counts its 4 Ops discards for the USA', () => {
    const start = atTurn5()
    const resolved = run(start, { target: 'play', id: ASK_NOT, state: 'removed', by: null }, { target: 'resolve', picked: [NATO, BLOCKADE] })
    expect(resolved.game.fourOps.us).toBe(1)
    expect(resolved.moves).toHaveLength(start.moves.length)
    expect(last(resolved)).toMatchObject({ type: 'event', id: ASK_NOT, picked: [NATO, BLOCKADE], usFourOps: 1 })

    const undone = roomReducer(resolved, undo)
    expect(undone.cards).toEqual(start.cards)
    expect(undone.game.fourOps.us).toBe(0)
  })

  it('an event whose play was not seen resolves with nothing to take back', () => {
    const start = { ...atTurn5(), moves: [] }
    const playedLocally = { ...start, cards: cardsReducer(start.cards, { type: 'setCardState', id: TEHRAN, state: 'removed' }) }
    const resolved = roomReducer(playedLocally, { target: 'resolve', picked: [] })
    expect(last(resolved)).toMatchObject({ type: 'event', id: TEHRAN, before: null })
    expect(canUndo(resolved)).toBe(false)
  })
})

describe('roomReducer: rolls and 4 Ops counts', () => {
  it('takes a roll back by removing it', () => {
    const rolled = run(newRoom(), rollOf(-2))
    expect(rolled.moves).toEqual([{ type: 'roll', track: 'success', player: 'us', value: -2, armed: true }])
    expect(isRoomState(JSON.parse(JSON.stringify(rolled)))).toBe(true)
    expect(roomReducer(rolled, undo).game.rolls.success.us).toEqual([])
  })

  it("forgets a roll its own undo button took back, wherever it lies", () => {
    const rolled = run(newRoom(), rollOf(2), { target: 'game', action: { type: 'incrementFourOps', player: 'ussr' } })
    const taken = roomReducer(rolled, { target: 'game', action: { type: 'undoRoll', track: 'success', player: 'us' } })
    expect(taken.moves).toEqual([{ type: 'fourOps', player: 'ussr', by: 1, armed: true }])
  })

  it('takes a hand-moved 4 Ops count back, and ignores a decrement at zero', () => {
    const lowered = run(
      newRoom(),
      { target: 'game', action: { type: 'incrementFourOps', player: 'us' } },
      { target: 'game', action: { type: 'decrementFourOps', player: 'us' } },
    )
    expect(last(lowered)).toMatchObject({ type: 'fourOps', player: 'us', by: -1 })
    expect(roomReducer(lowered, undo).game.fourOps.us).toBe(1)
    expect(roomReducer(lowered, { target: 'game', action: { type: 'decrementFourOps', player: 'us' } })).toBe(lowered)
  })

  it('cannot take a roll back once the game has ended', () => {
    const ended = run(newRoom(), rollOf(1), { target: 'game', action: { type: 'end' } })
    expect(canUndo(ended)).toBe(false)
    expect(roomReducer(ended, undo)).toBe(ended)
  })
})

describe('roomReducer: the last three moves', () => {
  it('keeps three: two to take back, then the third only shown', () => {
    const rolled = run(newRoom(), rollOf(1), rollOf(2), rollOf(3), rollOf(4))
    expect(rolled.moves.map((m) => (m.type === 'roll' ? m.value : null))).toEqual([2, 3, 4])

    const once = roomReducer(rolled, undo)
    const twice = roomReducer(once, undo)
    expect(twice.game.rolls.success.us).toEqual([1, 2])
    expect(twice.moves).toEqual([{ type: 'roll', track: 'success', player: 'us', value: 2, armed: false }])
    expect(canUndo(twice)).toBe(false)
    expect(roomReducer(twice, undo)).toBe(twice)
  })

  it('a move after an undo gives two to take back again', () => {
    const state = run(newRoom(), rollOf(1), rollOf(2), rollOf(3), undo, rollOf(5))
    expect(run(state, undo, undo).game.rolls.success.us).toEqual([1])
    expect(canUndo(run(state, undo, undo))).toBe(false)
  })

  it('drops the snapshot of a card out of reach of undo', () => {
    const state = run(newRoom(), { target: 'play', id: BLOCKADE, state: 'discarded', by: null }, rollOf(1), rollOf(2))
    expect(state.moves[0]).toMatchObject({ type: 'card', before: null })
  })
})

describe('isRoomState', () => {
  it('takes a room stored before the moves were kept, once given an empty list', () => {
    const { game, cards } = newRoom()
    expect(isRoomState({ game, cards })).toBe(false)
    expect(isRoomState(withMoves({ game, cards }))).toBe(true)
  })

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
