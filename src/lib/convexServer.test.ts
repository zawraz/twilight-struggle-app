import { describe, expect, it, vi } from 'vitest'

const made: unknown[][] = []
vi.mock('convex/react', () => ({
  ConvexReactClient: class {
    constructor(...args: unknown[]) {
      made.push(args)
    }
    watchQuery() {
      return { onUpdate: () => () => {}, localQueryResult: () => undefined }
    }
    subscribeToConnectionState() {
      return () => {}
    }
    connectionState() {
      return { isWebSocketConnected: false }
    }
    close() {
      return Promise.resolve()
    }
  },
}))

const { convexServer } = await import('./convexServer')

describe('convexServer', () => {
  it('makes no client until something watches', () => {
    made.length = 0
    convexServer('https://example.convex.cloud')
    expect(made).toHaveLength(0)
  })

  it('never asks "Leave site?": a closed client must not hold the page with unsent changes', () => {
    made.length = 0
    const stop = convexServer('https://example.convex.cloud').watch({ onGame: () => {}, onConnected: () => {} })
    stop()
    expect(made[0]?.[1]).toMatchObject({ unsavedChangesWarning: false })
  })
})
