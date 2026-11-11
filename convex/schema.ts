import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // One shared game per room code; `game`, `cards` and `moves` are checked with the app's own validators.
  // Rooms opened before the moves were kept have none; `last` is left over from a test build, unused.
  rooms: defineTable({
    code: v.string(),
    game: v.any(),
    cards: v.any(),
    moves: v.optional(v.any()),
    last: v.optional(v.any()),
  }).index('by_code', ['code']),
  // The one shared game. At most one document; `game`, `cards` and `moves` are checked with the app's own validators.
  games: defineTable({ game: v.any(), cards: v.any(), moves: v.any(), updatedAt: v.number() }),
})
