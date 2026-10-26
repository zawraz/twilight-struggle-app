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
