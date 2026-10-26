import { Hand, Play, RotateCcw, TriangleAlert, X } from 'lucide-react'
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { copy } from '../copy'
import type { CardState } from '../lib/cardGame'
import type { Card } from '../lib/cards'
import { SIDE_TEXT } from './tone'

/** How far a row must be dragged sideways to commit the swipe. */
export const SWIPE_COMMIT_PX = 80
/** Sideways movement that turns a press into a swipe (and vertical movement that cancels it). */
const SLOP_PX = 8
/** How long a press must be held to offer restoring a played card. */
export const LONG_PRESS_MS = 500

interface CardRowProps {
  card: Card
  state: CardState
  /** A reshuffle showed the card must be in one hand or the other. */
  inHand: boolean
  /** The row's action buttons are showing. */
  open: boolean
  onToggle: () => void
  onClose: () => void
  onChange: (state: CardState) => void
}

const DIM: Record<CardState, string> = { available: '', discarded: 'opacity-55', removed: 'opacity-25' }

interface Gesture {
  pointerId: number
  x: number
  y: number
  /** Decided once the pointer has moved past the slop: a sideways swipe, or a scroll the browser owns. */
  mode: 'press' | 'swipe' | 'scroll'
}

/**
 * One checklist line. Tap an available card for remove / discard buttons; swipe it left to discard
 * or right to remove; long-press a discarded or removed card to restore it.
 */
export function CardRow({ card, state, inHand, open, onToggle, onClose, onChange }: CardRowProps) {
  const [dx, setDx] = useState(0)
  const gesture = useRef<Gesture | null>(null)
  const longPress = useRef<number | undefined>(undefined)
  // The click that ends a long press or a swipe isn't a tap.
  const swallowClick = useRef(false)

  // Discarding from the discard pile or removing again means nothing, and only asterisk cards leave
  // the game: only allowed directions move.
  const canDiscard = state === 'available'
  const canRemove = state !== 'removed' && card.isPermanent

  useEffect(() => () => window.clearTimeout(longPress.current), [])

  const cancelLongPress = () => window.clearTimeout(longPress.current)

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return
    gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, mode: 'press' }
    swallowClick.current = false
    if (state !== 'available') {
      longPress.current = window.setTimeout(() => {
        gesture.current = null
        swallowClick.current = true
        navigator.vibrate?.(10)
        onToggle()
      }, LONG_PRESS_MS)
    }
  }

  function onPointerMove(event: PointerEvent) {
    const g = gesture.current
    if (!g || g.pointerId !== event.pointerId) return
    const moveX = event.clientX - g.x
    const moveY = event.clientY - g.y
    if (g.mode === 'press') {
      if (Math.abs(moveY) > SLOP_PX && Math.abs(moveY) >= Math.abs(moveX)) {
        g.mode = 'scroll'
        cancelLongPress()
        return
      }
      if (Math.abs(moveX) <= SLOP_PX) return
      g.mode = 'swipe'
      cancelLongPress()
      onClose()
      ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
    }
    if (g.mode !== 'swipe') return
    // Left discards, right removes; a direction the card can't go doesn't move.
    setDx(moveX < 0 ? (canDiscard ? moveX : 0) : canRemove ? moveX : 0)
  }

  function onPointerEnd(event: PointerEvent) {
    const g = gesture.current
    cancelLongPress()
    if (!g || g.pointerId !== event.pointerId) return
    gesture.current = null
    if (g.mode !== 'swipe') return
    swallowClick.current = true
    const moved = event.type === 'pointercancel' ? 0 : dx
    if (moved <= -SWIPE_COMMIT_PX) onChange('discarded')
    else if (moved >= SWIPE_COMMIT_PX) onChange('removed')
    setDx(0)
  }

  function onClick(event: MouseEvent) {
    if (swallowClick.current) {
      swallowClick.current = false
      return
    }
    // A plain tap on a played card does nothing — restoring takes a long press. Keyboard clicks (detail 0) open it.
    if (state === 'available' || event.detail === 0) onToggle()
  }

  const swiping = dx !== 0

  return (
    <li
      data-state={state}
      className="relative overflow-hidden border-b border-line last:border-b-0"
      onContextMenu={(event) => event.preventDefault()}
    >
      {/* What the swipe will do, revealed behind the row and following its edge. */}
      {dx < 0 && (
        <span
          aria-hidden="true"
          style={{ width: -dx }}
          className={`absolute inset-y-0 right-0 grid place-items-center ${-dx >= SWIPE_COMMIT_PX ? 'bg-gold text-on-gold' : 'bg-surface-sunken text-ink-muted'}`}
        >
          <Play className="size-5" />
        </span>
      )}
      {dx > 0 && (
        <span
          aria-hidden="true"
          style={{ width: dx }}
          className={`absolute inset-y-0 left-0 grid place-items-center ${dx >= SWIPE_COMMIT_PX ? 'bg-danger text-surface' : 'bg-surface-sunken text-danger'}`}
        >
          <X className="size-5" />
        </span>
      )}
      <div
        style={{ transform: `translateX(${dx}px)` }}
        className={`relative flex items-stretch bg-surface-raised touch-pan-y select-none ${swiping ? '' : 'transition-transform duration-200'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={onClick}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 px-2 text-left"
        >
          <span className="grid size-4 shrink-0 place-items-center">
            {state === 'discarded' && <Play className="size-3.5 text-ink-muted" aria-hidden="true" />}
            {state === 'removed' && <X className="size-4 text-danger" strokeWidth={3} aria-hidden="true" />}
            {inHand && <Hand className="size-4 text-ink-muted" aria-label={copy.cards.inHand} role="img" />}
          </span>
          <span className={`flex min-w-0 flex-1 items-center gap-1 ${DIM[state]}`}>
            <span className={`min-w-0 truncate text-sm ${card.important ? 'font-semibold' : ''}`}>{card.name}</span>
            {card.isPermanent && (
              <span className="shrink-0 font-mono text-sm text-ink-muted" title={copy.cards.permanent}>
                *<span className="sr-only">{copy.cards.permanent}</span>
              </span>
            )}
            {card.important && (
              <TriangleAlert className="size-4 shrink-0 text-gold-text" aria-label={copy.cards.important} role="img" />
            )}
          </span>
          <span className={`flex shrink-0 items-baseline gap-2 ${DIM[state]}`}>
            <span className={`w-8 text-right font-condensed text-xs font-semibold uppercase tracking-[0.06em] ${SIDE_TEXT[card.player]}`}>
              {copy.cards.sides[card.player]}
            </span>
            <span className="w-3 text-right font-mono text-sm tabular-nums" aria-label={copy.cards.ops(card.value)}>
              {card.value === 0 ? copy.cards.scoring : card.value}
            </span>
          </span>
          <span className="sr-only">, {copy.cards.state[state]}</span>
        </button>
        {open && (
          <span className="flex shrink-0 items-center gap-1 pr-1">
            {state === 'available' ? (
              <>
                {card.isPermanent && (
                  <ActionButton label={copy.cards.remove(card.name)} onClick={() => onChange('removed')} className="border-danger text-danger">
                    <X className="size-5" strokeWidth={3} aria-hidden="true" />
                  </ActionButton>
                )}
                <ActionButton label={copy.cards.discard(card.name)} onClick={() => onChange('discarded')} className="border-gold bg-gold text-on-gold">
                  <Play className="size-5" aria-hidden="true" />
                </ActionButton>
              </>
            ) : (
              <button
                type="button"
                aria-label={copy.cards.restore(card.name)}
                onClick={() => onChange('available')}
                className="flex h-9 items-center gap-1.5 rounded-counter border-2 border-go px-2 font-condensed text-xs font-semibold uppercase tracking-[0.08em] text-go"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                {copy.cards.restoreLabel}
              </button>
            )}
          </span>
        )}
      </div>
    </li>
  )
}

function ActionButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string
  onClick: () => void
  className: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`grid size-9 place-items-center rounded-counter border-2 ${className}`}
    >
      {children}
    </button>
  )
}
