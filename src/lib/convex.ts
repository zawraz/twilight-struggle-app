import { ConvexReactClient } from 'convex/react'

const url = import.meta.env.VITE_CONVEX_URL as string | undefined

/** The sync server's client; null in a build without one (tests, local dev), where games stay on the device. */
export const convex = url ? new ConvexReactClient(url) : null
