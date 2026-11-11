import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // The one shared game. At most one document; `game`, `cards` and `moves` are checked with the app's own validators.
  games: defineTable({ game: v.any(), cards: v.any(), moves: v.any(), updatedAt: v.number() }),
})
