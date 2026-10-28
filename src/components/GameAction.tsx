import { Flag, Plus } from 'lucide-react'
import { copy } from '../copy'
import { useConfirmTap } from '../lib/useConfirmTap'
import { ConfirmCaption } from './ConfirmCaption'

interface GameActionProps {
  ended: boolean
  onEnd: () => void
  onNewGame: () => void
}

const BUTTON = 'grid size-10 shrink-0 place-items-center rounded-counter border-2 transition-colors'

/**
 * The header's one action. While the game runs it is a quiet flag to end it, turning red only
 * when armed (irreversible, so it takes a confirming second tap); once it has ended, a green plus for a new game.
 * Each shape names its action, so the colour never reads as the game's state.
 */
export function GameAction({ ended, onEnd, onNewGame }: GameActionProps) {
  return ended ? (
    <button type="button" aria-label={copy.newGame} onClick={onNewGame} className={`${BUTTON} border-go bg-go text-surface`}>
      <Plus className="size-5" strokeWidth={2.5} aria-hidden="true" />
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
        className={`${BUTTON} ${armed ? 'border-danger bg-danger text-surface' : 'border-line-strong text-ink-muted'}`}
      >
        <Flag className="size-5" aria-hidden="true" />
      </button>
    </div>
  )
}
