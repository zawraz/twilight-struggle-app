import { copy } from '../copy'

export type PlayerId = 'ussr' | 'us'

export interface Player {
  id: PlayerId
  label: string
}

// USSR on the left, US on the right everywhere in the app.
export const PLAYERS: readonly Player[] = [
  { id: 'ussr', label: copy.sides.ussr },
  { id: 'us', label: copy.sides.us },
]

export type PerPlayer<T> = Record<PlayerId, T>

export function perPlayer<T>(make: () => T): PerPlayer<T> {
  return { ussr: make(), us: make() }
}
