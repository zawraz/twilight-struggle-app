import { copy } from '../copy'
import type { Player } from '../lib/players'
import { useConfirmTap } from '../lib/useConfirmTap'
import { ConfirmCaption } from './ConfirmCaption'
import { TONE } from './tone'

interface OpsCounterProps {
  player: Player
  count: number
  onIncrement: () => void
  onDecrement: () => void
  /** The game has ended: the count is final. */
  locked?: boolean
}

export function OpsCounter({ player, count, onIncrement, onDecrement, locked = false }: OpsCounterProps) {
  // Playing a card on the Karty tab keeps the count, so a tap here is a correction: both take a confirming second tap.
  const minus = useConfirmTap(onDecrement)
  const plus = useConfirmTap(onIncrement)

  const handleMinus = () => {
    plus.disarm()
    minus.tap()
  }

  const handlePlus = () => {
    minus.disarm()
    plus.tap()
  }

  const tone = TONE[player.id]

  return (
    <div className="flex flex-col items-center justify-center gap-1 short-landscape:flex-row short-landscape:gap-3">
      <span className={`font-stencil text-base leading-none font-extrabold uppercase tracking-[0.04em] ${tone.text}`}>
        {player.label}
      </span>
      {/* As wide as a roll section's wheel and button (gap included), so the buttons line up with theirs. */}
      <div className="flex w-[calc(var(--wheel-width)*2_+_var(--spacing)*1.5)] items-center justify-between gap-2 min-[360px]:w-[calc(var(--wheel-width)*2_+_var(--spacing)*3)] short-landscape:w-auto short-landscape:flex-1">
        <div className="relative">
          {minus.armed && <ConfirmCaption />}
          <button
            type="button"
            aria-label={copy.fourOps.remove(player.label)}
            data-armed={minus.armed}
            disabled={locked || count === 0}
            onClick={handleMinus}
            className={`grid size-(--wheel-item) place-items-center rounded-counter short-landscape:size-10 border-2 transition-colors ${locked ? 'opacity-20 grayscale' : 'disabled:opacity-40'} ${tone.border} ${
              minus.armed ? tone.soft : tone.fill
            }`}
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <path d="M5 12h14" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
            </svg>
          </button>
        </div>
        <output
          aria-label={copy.fourOps.count(player.label)}
          className="min-w-[2ch] text-center font-stencil text-4xl font-extrabold tabular-nums text-ink"
        >
          {count}
        </output>
        <div className="relative">
          {plus.armed && <ConfirmCaption />}
          <button
            type="button"
            aria-label={copy.fourOps.add(player.label)}
            data-armed={plus.armed}
            onClick={handlePlus}
            disabled={locked}
            className={`grid size-(--wheel-item) place-items-center rounded-counter short-landscape:size-10 border-2 transition-colors ${locked ? 'opacity-20 grayscale' : 'disabled:opacity-40'} ${tone.border} ${
              plus.armed ? tone.soft : tone.fill
            }`}
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <path d="M5 12h14M12 5v14" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
