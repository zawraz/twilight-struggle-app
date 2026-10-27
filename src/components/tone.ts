import type { CardSide } from '../lib/cards'
import type { PlayerId } from '../lib/players'

// Literal class names per side, so Tailwind can see them.
export const TONE = {
  ussr: {
    text: 'text-ussr',
    border: 'border-ussr',
    fill: 'bg-ussr text-on-ussr',
    soft: 'bg-ussr-soft text-ussr',
    bar: 'bg-ussr',
    flashVars: { '--flash': 'var(--ussr)', '--on-flash': 'var(--on-ussr)' },
  },
  us: {
    text: 'text-us',
    border: 'border-us',
    fill: 'bg-us text-on-us',
    soft: 'bg-us-soft text-us',
    bar: 'bg-us',
    flashVars: { '--flash': 'var(--us)', '--on-flash': 'var(--on-us)' },
  },
} as const satisfies Record<PlayerId, Record<string, string | Record<string, string>>>

/** A card's side as text colour: red ZSRR, blue USA, grey neutral. */
export const SIDE_TEXT: Record<CardSide, string> = { ussr: TONE.ussr.text, us: TONE.us.text, neutral: 'text-ink-muted' }

/** A card's name as text colour: ink tinted red for ZSRR, blue for USA, plain for neutral. */
export const SIDE_NAME_TEXT: Record<CardSide, string> = { ussr: 'text-ussr-ink', us: 'text-us-ink', neutral: '' }
