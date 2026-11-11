import { useEffect, useId, useRef } from 'react'
import { copy } from '../copy'
import type { SyncMode } from '../lib/useRoom'

interface NewGameDialogProps {
  onChoose: (mode: SyncMode) => void
  onCancel: () => void
}

const CHOICES: { mode: SyncMode; label: string; hint: string }[] = [
  { mode: 'offline', label: copy.newGameDialog.offline, hint: copy.newGameDialog.offlineHint },
  { mode: 'online', label: copy.newGameDialog.online, hint: copy.newGameDialog.onlineHint },
]

/** New Game's question: a game on this phone alone, or the one both phones share. */
export function NewGameDialog({ onChoose, onCancel }: NewGameDialogProps) {
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
      className="fixed inset-0 z-40 grid place-items-center bg-surface-sunken/80 p-4"
      onClick={(event) => event.target === event.currentTarget && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full max-w-sm flex-col gap-3 rounded-card border-2 border-gold bg-surface-raised p-4"
      >
        <h2 id={titleId} className="font-condensed text-sm font-semibold uppercase tracking-[0.08em] text-gold-text">
          {copy.newGameDialog.title}
        </h2>
        {CHOICES.map((choice, i) => (
          <button
            key={choice.mode}
            ref={i === 0 ? first : undefined}
            type="button"
            onClick={() => onChoose(choice.mode)}
            className="flex flex-col items-start gap-0.5 rounded-counter border-2 border-line-strong px-3 py-2 text-left"
          >
            <span className="font-condensed text-base font-semibold uppercase tracking-[0.08em] text-ink">{choice.label}</span>
            <span className="text-sm text-ink-muted">{choice.hint}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-counter border-2 border-line-strong font-condensed text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted"
        >
          {copy.newGameDialog.cancel}
        </button>
      </div>
    </div>
  )
}
