import { copy } from '../copy'
import { EVENT_PICKS, type EventCard } from '../lib/cardGame'

/** Over the list while an event's picker is open. No Cancel: the event has been played. */
export function EventPicker({ event, count, onConfirm }: { event: EventCard; count: number; onConfirm: () => void }) {
  return (
    <div
      role="group"
      aria-label={copy.cards.pickTitle[event]}
      className="flex items-center gap-2 rounded-card border-2 border-gold bg-surface-raised p-2"
    >
      <span className="min-w-0 flex-1 text-sm font-semibold">{copy.cards.pickTitle[event]}</span>
      <span className="shrink-0 font-mono text-sm tabular-nums text-ink-muted">{copy.cards.picked(count, EVENT_PICKS[event])}</span>
      <button
        type="button"
        onClick={onConfirm}
        className="h-9 shrink-0 rounded-counter border-2 border-gold bg-gold px-3 font-condensed text-xs font-semibold uppercase tracking-[0.08em] text-on-gold"
      >
        {copy.cards.ok}
      </button>
    </div>
  )
}
