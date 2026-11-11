import { v } from 'convex/values'
import { isRoomState, newRoom, roomReducer, type RoomAction, type RoomState } from '../src/lib/room'
import { mutation, query, type QueryCtx } from './_generated/server'

/** The one online game's document, or null before anyone has started one. */
const current = (ctx: QueryCtx) => ctx.db.query('games').first()

/** The online game and when it last changed, or null when there is none. */
export const get = query({
  args: {},
  handler: async (ctx): Promise<{ state: RoomState; updatedAt: number } | null> => {
    const doc = await current(ctx)
    return doc && { state: { game: doc.game, cards: doc.cards, moves: doc.moves }, updatedAt: doc.updatedAt }
  },
})

/** Replaces the online game with a fresh one, built here: a phone never sends a whole game. */
export const start = mutation({
  args: {},
  handler: async (ctx) => {
    const fresh = { ...newRoom(), updatedAt: Date.now() }
    const doc = await current(ctx)
    if (doc) await ctx.db.replace(doc._id, fresh)
    else await ctx.db.insert('games', fresh)
  },
})

/** Applies one action to the online game. Actions run one at a time, so taps on two phones never clash. */
export const dispatch = mutation({
  args: { action: v.any() },
  handler: async (ctx, { action }) => {
    const doc = await current(ctx)
    if (!doc) throw new Error('No online game')
    let next: RoomState
    try {
      next = roomReducer({ game: doc.game, cards: doc.cards, moves: doc.moves }, action as RoomAction)
    } catch {
      throw new Error('Invalid action')
    }
    if (!isRoomState(next)) throw new Error('Invalid action')
    await ctx.db.patch(doc._id, { game: next.game, cards: next.cards, moves: next.moves, updatedAt: Date.now() })
  },
})
