import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // One shared game per room code; `game` and `cards` are checked with the app's own validators.
  rooms: defineTable({ code: v.string(), game: v.any(), cards: v.any() }).index('by_code', ['code']),
})
