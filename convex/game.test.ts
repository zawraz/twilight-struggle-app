/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { newRoom } from '../src/lib/room'
import { api } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')
const setup = () => convexTest(schema, modules)

describe('the online game', () => {
  it('is null before anyone starts one', async () => {
    expect(await setup().query(api.game.get, {})).toBeNull()
  })

  it('starts fresh, and starting again replaces it: there is only ever one', async () => {
    const t = setup()
    await t.mutation(api.game.start, {})
    await t.mutation(api.game.dispatch, { action: { target: 'cards', action: { type: 'nextTurn' } } })
    await t.mutation(api.game.start, {})
    expect((await t.query(api.game.get, {}))?.state).toEqual(newRoom())
    expect(await t.run((ctx) => ctx.db.query('games').collect())).toHaveLength(1)
  })

  it('applies an action through the app reducer and marks when it changed', async () => {
    const t = setup()
    await t.mutation(api.game.start, {})
    const before = (await t.query(api.game.get, {}))!.updatedAt
    await new Promise((resolve) => setTimeout(resolve, 2))
    await t.mutation(api.game.dispatch, { action: { target: 'cards', action: { type: 'nextTurn' } } })
    const after = (await t.query(api.game.get, {}))!
    expect(after.state.cards.turn).toBe(2)
    expect(after.state.moves.at(-1)).toMatchObject({ type: 'turn', turn: 2 })
    expect(after.updatedAt).toBeGreaterThan(before)
  })

  it('refuses a change when there is no online game', async () => {
    await expect(setup().mutation(api.game.dispatch, { action: { target: 'undoLast' } })).rejects.toThrow('No online game')
  })

  it('refuses a malformed action before running it', async () => {
    const t = setup()
    await t.mutation(api.game.start, {})
    await expect(
      t.mutation(api.game.dispatch, { action: { target: 'cards', action: { type: 'teleport' } } } as never),
    ).rejects.toThrow(/Validator/)
  })

  it('stores only games that match the schema', async () => {
    const t = setup()
    await expect(
      t.run((ctx) => ctx.db.insert('games', { game: 1, cards: {}, moves: 'x', updatedAt: 0 } as never)),
    ).rejects.toThrow()
  })
})
