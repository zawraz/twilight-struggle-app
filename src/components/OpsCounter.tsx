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
  const minus = useConfirmTap(onDecrement)

  const handlePlus = () => {
    minus.disarm()
    onIncrement()
  }

  const tone = TONE[player.id]

  return (
    <div className="flex flex-col items-center gap-1 short-landscape:flex-row short-landscape:gap-3">
      <span className={`font-condensed text-xs font-semibold uppercase tracking-[0.08em] ${tone.text}`}>
        {player.label}
      </span>
      <div className="flex w-full items-center justify-between gap-2 short-landscape:w-auto short-landscape:flex-1">
        <div className="relative">
          {minus.armed && <ConfirmCaption />}
          <button
            type="button"
            aria-label={copy.fourOps.remove(player.label)}
            data-armed={minus.armed}
            disabled={locked || count === 0}
            onClick={minus.tap}
            className={`grid size-12 place-items-center rounded-counter short-landscape:size-10 border-2 transition-colors disabled:opacity-40 ${
              minus.armed ? 'border-danger text-danger' : 'border-line-strong text-ink'
            }`}
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <path d="M5 12h14" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
            </svg>
          </button>
        </div>
        <output
          aria-label={copy.fourOps.count(player.label)}
          className={`min-w-[2ch] text-center font-stencil text-4xl font-extrabold tabular-nums ${tone.text}`}
        >
          {count}
        </output>
        <button
          type="button"
          aria-label={copy.fourOps.add(player.label)}
          onClick={handlePlus}
          disabled={locked}
          className="grid size-12 place-items-center rounded-counter short-landscape:size-10 border-2 border-line-strong text-ink disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
            <path d="M5 12h14M12 5v14" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
          </svg>
        </button>
      </div>
    </div>
  )
}
