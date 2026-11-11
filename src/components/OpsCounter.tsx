import { copy } from '../copy'
import type { Player } from '../lib/players'
import { TAP_LOCK_MS, useCooldown } from '../lib/useCooldown'
import { TONE } from './tone'

interface OpsCounterProps {
  player: Player
  count: number
  onIncrement: () => void
  onDecrement: () => void
  /** The game has ended: the count is final and its buttons are gone. */
  locked?: boolean
}

export function OpsCounter({ player, count, onIncrement, onDecrement, locked = false }: OpsCounterProps) {
  // A tap acts at once (the undo bar takes it back), then the button rests for a moment against a double tap.
  const [minusLocked, lockMinus] = useCooldown(TAP_LOCK_MS)
  const [plusLocked, lockPlus] = useCooldown(TAP_LOCK_MS)

  const handleMinus = () => {
    onDecrement()
    lockMinus()
  }

  const handlePlus = () => {
    onIncrement()
    lockPlus()
  }

  const tone = TONE[player.id]

  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <span className={`font-stencil text-base leading-none font-extrabold uppercase tracking-[0.04em] ${tone.text}`}>
        {player.label}
      </span>
      {/* As wide as a roll section's wheel and button (gap included), so the buttons line up with theirs.
          Once the game has ended the count is final: the buttons go, and it stands alone in the middle. */}
      <div
        className={`flex h-(--wheel-item) w-[calc(var(--wheel-width)*2_+_var(--spacing)*1.5)] items-center gap-2 min-[360px]:w-[calc(var(--wheel-width)*2_+_var(--spacing)*3)] ${
          locked ? 'justify-center' : 'justify-between'
        }`}
      >
        {!locked && (
          <div className="relative">
            <button
              type="button"
              aria-label={copy.fourOps.remove(player.label)}
              disabled={count === 0 || minusLocked}
              onClick={handleMinus}
              className={`grid size-(--wheel-item) place-items-center rounded-counter border-2 transition-colors disabled:opacity-40 ${tone.border} ${tone.fill}`}
            >
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                <path d="M5 12h14" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
              </svg>
            </button>
          </div>
        )}
        <output
          aria-label={copy.fourOps.count(player.label)}
          className="min-w-[2ch] text-center font-stencil text-4xl font-extrabold tabular-nums text-ink"
        >
          {count}
        </output>
        {!locked && (
          <div className="relative">
            <button
              type="button"
              aria-label={copy.fourOps.add(player.label)}
              disabled={plusLocked}
              onClick={handlePlus}
              className={`grid size-(--wheel-item) place-items-center rounded-counter border-2 transition-colors disabled:opacity-40 ${tone.border} ${tone.fill}`}
            >
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                <path d="M5 12h14M12 5v14" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
