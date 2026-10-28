import { Power } from 'lucide-react'
import { copy } from '../copy'
import { useConfirmTap } from '../lib/useConfirmTap'
import { ConfirmCaption } from './ConfirmCaption'

interface GameActionProps {
  ended: boolean
  onEnd: () => void
  onNewGame: () => void
}

const BUTTON = 'grid size-10 shrink-0 place-items-center rounded-counter border-2 transition-colors'
const ICON = <Power className="size-5" aria-hidden="true" />

/**
 * The header's one action, a power button: red End while the game runs
 * (irreversible, so it takes a confirming second tap), green New Game once it has ended.
 */
export function GameAction({ ended, onEnd, onNewGame }: GameActionProps) {
  return ended ? (
    <button type="button" aria-label={copy.newGame} onClick={onNewGame} className={`${BUTTON} border-go bg-go text-surface`}>
      {ICON}
    </button>
  ) : (
    <EndButton onEnd={onEnd} />
  )
}

function EndButton({ onEnd }: { onEnd: () => void }) {
  const { armed, tap } = useConfirmTap(onEnd)
  return (
    <div className="relative shrink-0">
      {armed && <ConfirmCaption placement="right" />}
      <button
        type="button"
        aria-label={copy.end}
        data-armed={armed}
        onClick={tap}
        className={`${BUTTON} border-danger bg-danger text-surface ${armed ? 'ring-2 ring-danger ring-offset-2 ring-offset-surface' : ''}`}
      >
        {ICON}
      </button>
    </div>
  )
}
