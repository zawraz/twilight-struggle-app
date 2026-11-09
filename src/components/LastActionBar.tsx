import { ChevronRight, Crosshair, Dices, Layers, RotateCcw, Undo2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { copy } from '../copy'
import { ASK_NOT, TEHRAN } from '../lib/cardGame'
import { CARDS } from '../lib/cards'
import { PLAYERS, type PlayerId } from '../lib/players'
import type { Move } from '../lib/room'
import { formatSigned } from '../lib/stats'
import { CardStateIcon } from './CardRow'
import { TONE } from './tone'

const nameOf = (id: number) => CARDS.find((card) => card.id === id)?.name ?? ''
const sideOf = (player: PlayerId) => PLAYERS.find((p) => p.id === player)!.label
const formatRoll = (last: Extract<Move, { type: 'roll' }>) =>
  last.track === 'success' ? formatSigned(last.value) : String(last.value)

/** What an event's picker did, as it reads after the card's name. */
function eventDetail(last: Extract<Move, { type: 'event' }>): string {
  const n = last.picked.length
  if (last.id === TEHRAN) return copy.cards.tehran(n, last.back)
  if (last.id === ASK_NOT) return last.back > 0 ? copy.cards.drewReshuffled(n, last.back) : copy.cards.drewWithout(n)
  return n > 0 ? copy.cards.toHand(nameOf(last.picked[0])) : copy.cards.nothingTaken
}

/** The whole last action in words: what a screen reader hears and what the undo button names. */
export function describeLast(last: Move): string {
  switch (last.type) {
    case 'turn':
      return `${copy.cards.nextTurn}: ${copy.cards.turnOf(last.turn)}`
    case 'roll':
      return `${copy[last.track].wheel}: ${sideOf(last.player)} ${formatRoll(last)}`
    case 'fourOps':
      return `${copy.fourOps.title}: ${sideOf(last.player)} ${formatSigned(last.by)}`
    case 'event':
      return `${nameOf(last.id)}: ${eventDetail(last)}`
    case 'card': {
      const text = copy.cards.changed(nameOf(last.id), copy.cards.state[last.state])
      return last.by ? copy.fourOps.playedBy(text, sideOf(last.by)) : text
    }
  }
}

const muted = (text: string) => <span className="text-ink-muted"> · {text}</span>
const side = (player: PlayerId) => <span className={TONE[player].text}> · {sideOf(player)}</span>

/** The icon and the words the strip shows for a last action. */
function shown(last: Move): { icon: ReactNode; text: ReactNode } {
  switch (last.type) {
    case 'turn':
      return {
        icon: <ChevronRight className="size-4 text-ink-muted" />,
        text: (
          <>
            {copy.cards.nextTurn}
            <span className="font-mono"> {last.turn}</span>
          </>
        ),
      }
    case 'roll':
      return {
        icon: last.track === 'dice' ? <Dices className="size-4 text-ink-muted" /> : <Crosshair className="size-4 text-ink-muted" />,
        text: (
          <>
            {copy[last.track].wheel}
            {side(last.player)}
            <span className="font-mono"> {formatRoll(last)}</span>
          </>
        ),
      }
    case 'fourOps':
      return {
        icon: <Layers className="size-4 text-ink-muted" />,
        text: (
          <>
            {copy.fourOps.title}
            {side(last.player)}
            <span className="font-mono"> {formatSigned(last.by)}</span>
          </>
        ),
      }
    case 'event':
      return {
        icon: <CardStateIcon state="removed" />,
        text: (
          <>
            {nameOf(last.id)}
            {muted(eventDetail(last))}
          </>
        ),
      }
    case 'card':
      return {
        icon: last.state === 'available' ? <RotateCcw className="size-3.5 text-ink-muted" /> : <CardStateIcon state={last.state} />,
        text: (
          <>
            {nameOf(last.id)}
            {last.by && side(last.by)}
          </>
        ),
      }
  }
}

interface LastActionBarProps {
  last: Move | null
  /** Whether the last move can still be taken back; the third one back is only shown. */
  undoable: boolean
  onUndo: () => void
}

/** The last move in the room, from either device, for as long as it stays the last one. */
export function LastActionBar({ last, undoable, onUndo }: LastActionBarProps) {
  const view = last && shown(last)
  return (
    <section aria-label={copy.cards.lastAction} className="flex h-6 min-w-0 items-center gap-2">
      <h2 className="shrink-0 font-condensed text-xs font-semibold uppercase tracking-[0.08em] text-gold-text">
        {copy.cards.lastAction}:
      </h2>
      <p
        role="status"
        aria-label={last ? describeLast(last) : copy.cards.noLastAction}
        className="flex min-w-0 flex-1 items-center gap-1.5"
      >
        {view ? (
          <>
            <span aria-hidden="true" className="grid size-4 shrink-0 place-items-center">
              {view.icon}
            </span>
            <span aria-hidden="true" className="min-w-0 truncate text-sm text-ink">
              {view.text}
            </span>
          </>
        ) : (
          <span aria-hidden="true" className="text-sm text-ink-muted">
            {copy.cards.noLastAction}
          </span>
        )}
      </p>
      {last && undoable && (
        <button
          type="button"
          onClick={onUndo}
          aria-label={copy.cards.undoLast(describeLast(last))}
          className="flex h-5 shrink-0 items-center gap-1 rounded-counter border border-gold px-1.5 font-condensed text-xs font-semibold uppercase tracking-[0.08em] text-gold-text"
        >
          <Undo2 className="size-3" aria-hidden="true" />
          {copy.undo}
        </button>
      )}
    </section>
  )
}
