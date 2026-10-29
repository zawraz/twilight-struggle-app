import { Check, Hand, Pin, Play, RotateCcw, TriangleAlert, X } from 'lucide-react'
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { copy } from '../copy'
import { staysInPlay, type CardState } from '../lib/cardGame'
import type { Card } from '../lib/cards'
import { SIDE_NAME_TEXT, SIDE_TEXT } from './tone'

/** How far a row must be dragged sideways to commit the swipe. */
export const SWIPE_COMMIT_PX = 80
/** Sideways movement that turns a press into a swipe (and vertical movement that cancels it). */
export const SLOP_PX = 8
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
  /** An event's picker is open: the row is a checkbox, and nothing else moves it. */
  pick?: { checked: boolean; onToggle: () => void }
  /** A thicker line under the row: the next card down has another ops value, is out of the hand, or is already played. */
  divider?: RowDivider
  /** Off, a sideways swipe leaves the row alone and goes to the list around it. */
  swipe?: boolean
}

export type RowDivider = 'value' | 'hand' | 'played'

const DIVIDER: Record<RowDivider, string> = {
  value: 'border-b-2 border-line-strong/60',
  hand: 'border-b-2 border-go/60',
  played: 'border-b-2 border-danger/60',
}

const DIM: Record<CardState, string> = { available: '', in_play: '', discarded: 'opacity-55', removed: 'opacity-25' }

interface Gesture {
  pointerId: number
  x: number
  y: number
  /** Decided once the pointer has moved past the slop: a sideways swipe, or a scroll the browser owns. */
  mode: 'press' | 'swipe' | 'scroll'
}

/**
 * One checklist line. Tap an available card for remove / discard buttons; swipe it left to discard
 * or right to remove; long-press a discarded or removed card to restore it. Shuttle Diplomacy swipes
 * right into play instead, and left from there to the discard pile.
 */
export function CardRow({
  card,
  state,
  inHand,
  open,
  onToggle,
  onClose,
  onChange,
  pick,
  divider,
  swipe = true,
}: CardRowProps) {
  const [dx, setDx] = useState(0)
  const gesture = useRef<Gesture | null>(null)
  const longPress = useRef<number | undefined>(undefined)
  // The click that ends a long press or a swipe isn't a tap.
  const swallowClick = useRef(false)

  // Discarding from the discard pile or removing again means nothing, and only asterisk cards leave
  // the game: only allowed directions move.
  const live = state === 'available' || state === 'in_play'
  const canDiscard = live
  const canPutInPlay = state === 'available' && staysInPlay(card.id)
  const canRemove = state !== 'removed' && card.isPermanent
  const canSwipeRight = canPutInPlay || canRemove

  useEffect(() => () => window.clearTimeout(longPress.current), [])

  const cancelLongPress = () => window.clearTimeout(longPress.current)

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0 || pick) return
    gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, mode: 'press' }
    swallowClick.current = false
    if (!live) {
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
      cancelLongPress()
      if (!swipe) {
        // The list's swipe, not the row's: and not a tap either.
        g.mode = 'scroll'
        swallowClick.current = true
        return
      }
      g.mode = 'swipe'
      onClose()
      ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
    }
    if (g.mode !== 'swipe') return
    // Left discards, right removes or puts in play; a direction the card can't go doesn't move.
    setDx(moveX < 0 ? (canDiscard ? moveX : 0) : canSwipeRight ? moveX : 0)
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
    else if (moved >= SWIPE_COMMIT_PX) onChange(canPutInPlay ? 'in_play' : 'removed')
    setDx(0)
  }

  function onClick(event: MouseEvent) {
    if (pick) {
      pick.onToggle()
      return
    }
    if (swallowClick.current) {
      swallowClick.current = false
      return
    }
    // A plain tap on a played card does nothing — restoring takes a long press. Keyboard clicks (detail 0) open it.
    if (live || event.detail === 0) onToggle()
  }

  const swiping = dx !== 0

  return (
    <li
      data-state={state}
      data-divider={divider}
      className={`relative overflow-hidden last:border-b-0 ${divider ? DIVIDER[divider] : 'border-b border-line'}`}
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
      {dx > 0 &&
        (canPutInPlay ? (
          <span
            aria-hidden="true"
            style={{ width: dx }}
            className={`absolute inset-y-0 left-0 grid place-items-center ${dx >= SWIPE_COMMIT_PX ? 'bg-go text-surface' : 'bg-surface-sunken text-go'}`}
          >
            <Pin className="size-5" />
          </span>
        ) : (
          <span
            aria-hidden="true"
            style={{ width: dx }}
            className={`absolute inset-y-0 left-0 grid place-items-center ${dx >= SWIPE_COMMIT_PX ? 'bg-danger text-surface' : 'bg-surface-sunken text-danger'}`}
          >
            <X className="size-5" />
          </span>
        ))}
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
          {...(pick
            ? { role: 'checkbox', 'aria-checked': pick.checked, 'aria-label': copy.cards.pick(card.name) }
            : { 'aria-expanded': open })}
          onClick={onClick}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 px-2 text-left"
        >
          {pick ? (
            <span
              className={`grid size-4 shrink-0 place-items-center rounded-sm border-2 ${pick.checked ? 'border-gold bg-gold text-on-gold' : 'border-line-strong'}`}
            >
              {pick.checked && <Check className="size-3" strokeWidth={3} aria-hidden="true" />}
            </span>
          ) : (
            <span className="grid size-4 shrink-0 place-items-center">
              {state === 'in_play' && <Pin className="size-4 text-go" strokeWidth={2.5} aria-hidden="true" />}
              {state === 'discarded' && <Play className="size-3.5 text-ink-muted" aria-hidden="true" />}
              {state === 'removed' && <X className="size-4 text-danger" strokeWidth={3} aria-hidden="true" />}
              {inHand && <Hand className="size-4 text-ink-muted" aria-label={copy.cards.inHand} role="img" />}
            </span>
          )}
          <span className={`flex min-w-0 flex-1 items-center gap-1 ${DIM[state]}`}>
            <span className={`min-w-0 truncate text-sm ${SIDE_NAME_TEXT[card.player]}`}>{card.name}</span>
            {card.isPermanent && (
              <span className="shrink-0 font-mono text-sm text-ink-muted" title={copy.cards.permanent}>
                *<span className="sr-only">{copy.cards.permanent}</span>
              </span>
            )}
            {/* Pushed right, so the warnings line up in a column beside the side label. */}
            {card.important && (
              <TriangleAlert className="ml-auto size-4 shrink-0 text-gold-text" aria-label={copy.cards.important} role="img" />
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
            {live ? (
              <>
                <ActionButton label={copy.cards.discard(card.name)} onClick={() => onChange('discarded')} className="border-gold bg-gold text-on-gold">
                  <Play className="size-5" aria-hidden="true" />
                </ActionButton>
                {canPutInPlay && (
                  <ActionButton label={copy.cards.putInPlay(card.name)} onClick={() => onChange('in_play')} className="border-go text-go">
                    <Pin className="size-5" aria-hidden="true" />
                  </ActionButton>
                )}
                {state === 'available' && card.isPermanent && (
                  <ActionButton label={copy.cards.remove(card.name)} onClick={() => onChange('removed')} className="border-danger text-danger">
                    <X className="size-5" strokeWidth={3} aria-hidden="true" />
                  </ActionButton>
                )}
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
      className={`grid h-9 w-12 place-items-center rounded-counter border-2 ${className}`}
    >
      {children}
    </button>
  )
}
