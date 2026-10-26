import { copy } from '../copy'
import { useConfirmTap } from '../lib/useConfirmTap'
import { ConfirmCaption } from './ConfirmCaption'

interface GameActionProps {
  ended: boolean
  onEnd: () => void
  onNewGame: () => void
}

const BUTTON = 'h-8 min-w-20 rounded-counter border-2 px-3 font-condensed text-xs font-semibold uppercase tracking-[0.08em]'
const IDLE = 'border-ink bg-ink text-surface'

/**
 * The header's one action: End while the game runs (irreversible, so it takes a
 * confirming second tap), New Game once it has ended.
 */
export function GameAction({ ended, onEnd, onNewGame }: GameActionProps) {
  return ended ? (
    <button type="button" onClick={onNewGame} className={`${BUTTON} ${IDLE}`}>
      {copy.newGame}
    </button>
  ) : (
    <EndButton onEnd={onEnd} />
  )
}

function EndButton({ onEnd }: { onEnd: () => void }) {
  const { armed, tap } = useConfirmTap(onEnd)
  return (
    <div className="relative shrink-0">
      {armed && <ConfirmCaption placement="left" />}
      <button
        type="button"
        data-armed={armed}
        onClick={tap}
        className={`${BUTTON} transition-colors ${armed ? 'border-danger text-danger' : IDLE}`}
      >
        {copy.end}
      </button>
    </div>
  )
}
