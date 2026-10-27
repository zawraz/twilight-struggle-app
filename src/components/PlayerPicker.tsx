import { useEffect, useId, useRef } from 'react'
import { copy } from '../copy'
import { PLAYERS, type PlayerId } from '../lib/players'
import { TONE } from './tone'

interface PlayerPickerProps {
  /** The card being played, named in the question. */
  cardName: string
  onPick: (player: PlayerId) => void
  /** The card isn't played after all. */
  onCancel: () => void
}

/** Asks which side played a 4 Ops card, so the Dziennik count can follow. */
export function PlayerPicker({ cardName, onPick, onCancel }: PlayerPickerProps) {
  const titleId = useId()
  const first = useRef<HTMLButtonElement>(null)

  // The latest handler, so a re-render doesn't move focus back to the first button.
  const cancel = useRef(onCancel)
  cancel.current = onCancel

  useEffect(() => {
    first.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      className="fixed inset-0 z-20 grid place-items-center bg-surface-sunken/80 p-4"
      onClick={(event) => event.target === event.currentTarget && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full max-w-sm flex-col gap-3 rounded-card border-2 border-gold bg-surface-raised p-4"
      >
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="font-condensed text-sm font-semibold uppercase tracking-[0.08em] text-gold-text">
            {copy.fourOps.whoPlayed}
          </h2>
          <p className="truncate text-sm">{cardName}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {PLAYERS.map((player, i) => (
            <button
              key={player.id}
              ref={i === 0 ? first : undefined}
              type="button"
              onClick={() => onPick(player.id)}
              className={`h-12 rounded-counter font-condensed text-sm font-semibold uppercase tracking-[0.08em] ${TONE[player.id].fill}`}
            >
              {player.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-counter border-2 border-line-strong font-condensed text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted"
        >
          {copy.cancel}
        </button>
      </div>
    </div>
  )
}
