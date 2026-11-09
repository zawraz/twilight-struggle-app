import { v } from 'convex/values'
import { isRoomState, normalizeRoomCode, roomReducer, type RoomAction, type RoomState } from '../src/lib/room'
import { mutation, query, type QueryCtx } from './_generated/server'

const findRoom = (ctx: QueryCtx, code: string) =>
  ctx.db
    .query('rooms')
    .withIndex('by_code', (q) => q.eq('code', code))
    .unique()

function checkCode(code: string): string {
  const normalized = normalizeRoomCode(code)
  if (normalized !== code) throw new Error(`Invalid room code: ${code}`)
  return code
}

/** The room's game, or null when no room has this code yet. */
export const get = query({
  args: { code: v.string() },
  handler: async (ctx, { code }): Promise<RoomState | null> => {
    const room = await findRoom(ctx, code)
    return room && { game: room.game, cards: room.cards }
  },
})

/** Opens a room with this game unless it already exists; true when it was created. */
export const ensure = mutation({
  args: { code: v.string(), state: v.any() },
  handler: async (ctx, { code, state }) => {
    checkCode(code)
    if (!isRoomState(state)) throw new Error('Invalid game state')
    if (await findRoom(ctx, code)) return false
    await ctx.db.insert('rooms', { code, game: state.game, cards: state.cards })
    return true
  },
})

/** Applies one action to the room. Actions run one at a time, so taps on two devices never clash. */
export const dispatch = mutation({
  args: { code: v.string(), action: v.any() },
  handler: async (ctx, { code, action }) => {
    const room = await findRoom(ctx, checkCode(code))
    if (!room) throw new Error(`No room ${code}`)
    let next: RoomState
    try {
      next = roomReducer({ game: room.game, cards: room.cards }, action as RoomAction)
    } catch {
      throw new Error('Invalid action')
    }
    if (!isRoomState(next)) throw new Error('Invalid action')
    await ctx.db.patch(room._id, { game: next.game, cards: next.cards })
  },
})
