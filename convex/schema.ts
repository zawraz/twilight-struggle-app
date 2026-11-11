import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { cardsState, gameState, moves } from './validators'

export default defineSchema({
  // The one shared game: at most one document.
  games: defineTable({ game: gameState, cards: cardsState, moves, updatedAt: v.number() }),
})
