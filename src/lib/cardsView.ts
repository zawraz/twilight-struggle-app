import { CARD_STATES, type CardState } from './cardGame'
import { CARD_SIDES, PHASES, type CardSide, type Phase } from './cards'

export const VIEW_STORAGE_KEY = 'ts-companion:cards-view:v1'

export interface Filters {
  player: CardSide[]
  phase: Phase[]
  state: CardState[]
}

export const NO_FILTERS: Filters = { player: [], phase: [], state: [] }

/** How the Karty tab shows the list: the filter panel's choices, kept across app restarts and new games. */
export interface CardsView {
  filters: Filters
  /** Played cards at the bottom of a single-screen list. */
  playedLast: boolean
  /** The list split over two screens, available and played. */
  multiScreen: boolean
  /** On two screens, a sideways swipe moves between them instead of changing a card. */
  swipeScreens: boolean
  /** On two screens, the played cards are dimmed. */
  dimPlayed: boolean
}

export const DEFAULT_VIEW: CardsView = {
  filters: NO_FILTERS,
  playedLast: true,
  multiScreen: true,
  swipeScreens: false,
  dimPlayed: true,
}

const pickList = <T>(value: unknown, allowed: readonly T[]): T[] | null =>
  Array.isArray(value) && value.every((v) => allowed.includes(v)) ? [...new Set(value as T[])] : null

const pickBoolean = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback)

/** The saved view, each choice falling back to its default when missing or unusable. */
export function loadView(storage: Storage | undefined = globalThis.localStorage): CardsView {
  try {
    const raw = storage?.getItem(VIEW_STORAGE_KEY)
    if (raw) {
      const stored: unknown = JSON.parse(raw)
      if (typeof stored === 'object' && stored !== null) {
        const s = stored as Record<string, unknown>
        const f = (typeof s.filters === 'object' && s.filters !== null ? s.filters : {}) as Record<string, unknown>
        return {
          filters: {
            player: pickList(f.player, CARD_SIDES) ?? [],
            phase: pickList(f.phase, PHASES) ?? [],
            state: pickList(f.state, CARD_STATES) ?? [],
          },
          playedLast: pickBoolean(s.playedLast, DEFAULT_VIEW.playedLast),
          multiScreen: pickBoolean(s.multiScreen, DEFAULT_VIEW.multiScreen),
          swipeScreens: pickBoolean(s.swipeScreens, DEFAULT_VIEW.swipeScreens),
          dimPlayed: pickBoolean(s.dimPlayed, DEFAULT_VIEW.dimPlayed),
        }
      }
    }
  } catch {
    // Private mode, blocked storage or a corrupt entry: the defaults.
  }
  return DEFAULT_VIEW
}

export function saveView(view: CardsView, storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(VIEW_STORAGE_KEY, JSON.stringify(view))
  } catch {
    // Storage full or unavailable: the choices last until the app closes.
  }
}
