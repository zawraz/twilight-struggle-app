import { useEffect, useId, useRef, type KeyboardEvent } from 'react'
import { TONE } from './tone'

/** Row height when the page has no layout to measure (tests); on screen it follows --wheel-row. */
export const ITEM_HEIGHT = 32
const VISIBLE_ITEMS = 3
/** Wait for the scroll (and its snap) to settle before committing a value. */
export const SETTLE_MS = 80

interface WheelPickerProps {
  values: readonly number[]
  value: number
  onChange: (value: number) => void
  label: string
  format?: (value: number) => string
  /** Locked: shown heavily greyed out and takes no input. */
  disabled?: boolean
}

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * A vertical, scroll-snapping value wheel shared by both players. Scroll, tap an option, or use the arrow keys.
 * Its frame is red on the ZSRR half and blue on the USA half, split like the Iron Curtain under the header.
 */
export function WheelPicker({ values, value, onChange, label, format = String, disabled = false }: WheelPickerProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const settleTimer = useRef<number | undefined>(undefined)
  const mounted = useRef(false)
  const baseId = useId()
  const index = Math.max(0, values.indexOf(value))

  // Index the wheel is scrolling to on its own (after a tap or key press).
  // Scroll positions on the way there are not the user's choice and are ignored.
  const targetIndex = useRef<number | null>(null)
  // The value just came from the wheel's own scroll position: it is already there (snap aligns the rest),
  // and steering it would fight a finger that is still dragging.
  const fromScroll = useRef(false)

  // The row height is set in CSS and changes with the screen size.
  const itemHeight = () => (listRef.current?.firstElementChild as HTMLElement | null)?.offsetHeight || ITEM_HEIGHT

  // Keep the wheel's position in step with the selected value.
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const top = index * itemHeight()
    const smooth = mounted.current && !prefersReducedMotion()
    mounted.current = true
    if (fromScroll.current || Math.abs(el.scrollTop - top) < 1) {
      fromScroll.current = false
      targetIndex.current = null
      return
    }
    targetIndex.current = smooth ? index : null
    if (typeof el.scrollTo === 'function') el.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' })
    else el.scrollTop = top
  }, [index])

  // A rotation or resize can change the row height: snap back onto the selected row.
  useEffect(() => {
    const realign = () => {
      const el = listRef.current
      if (el) el.scrollTop = index * itemHeight()
    }
    window.addEventListener('resize', realign)
    return () => window.removeEventListener('resize', realign)
  }, [index])

  useEffect(() => () => window.clearTimeout(settleTimer.current), [])

  const select = (i: number, scrolled = false) => {
    window.clearTimeout(settleTimer.current)
    if (disabled) return
    const next = values[Math.min(values.length - 1, Math.max(0, i))]
    if (next === value) return
    fromScroll.current = scrolled
    onChange(next)
  }

  const handleScroll = () => {
    window.clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(() => {
      const el = listRef.current
      if (!el) return
      const settled = Math.round(el.scrollTop / itemHeight())
      if (targetIndex.current !== null) {
        if (settled === targetIndex.current) targetIndex.current = null
        return
      }
      select(settled, true)
    }, SETTLE_MS)
  }

  // The user took hold of the wheel: their scrolling wins over any pending target.
  const handleUserScrollStart = () => {
    targetIndex.current = null
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowUp: index - 1,
      ArrowDown: index + 1,
      Home: 0,
      End: values.length - 1,
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    select(moves[event.key])
  }

  return (
    <div
      className={`relative w-(--wheel-wide) shrink-0 transition-opacity ${disabled ? 'pointer-events-none opacity-20 grayscale' : ''}`}
      style={{ height: `calc(var(--wheel-row) * ${VISIBLE_ITEMS})` }}>
      {/* The halves leave the header strip's gap (gap-1) between them. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 h-(--wheel-row) -translate-y-1/2">
        <span className="absolute inset-0 rounded-counter bg-surface-sunken" />
        <span
          className={`absolute inset-y-0 left-0 right-[calc(50%_+_var(--spacing)/2)] rounded-l-counter border-2 border-r-0 ${TONE.ussr.border}`}
        />
        <span
          className={`absolute inset-y-0 right-0 left-[calc(50%_+_var(--spacing)/2)] rounded-r-counter border-2 border-l-0 ${TONE.us.border}`}
        />
      </div>
      <div
        ref={listRef}
        role="listbox"
        aria-label={label}
        aria-activedescendant={`${baseId}-${index}`}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        onTouchStart={handleUserScrollStart}
        onWheel={handleUserScrollStart}
        className={`no-scrollbar relative h-full snap-y snap-mandatory overscroll-contain rounded-counter ${disabled ? 'overflow-y-hidden' : 'overflow-y-scroll'}`}
        style={{
          paddingBlock: 'var(--wheel-row)',
          maskImage: 'linear-gradient(transparent, #000 35%, #000 65%, transparent)',
        }}
      >
        {values.map((v, i) => (
          <div
            key={v}
            id={`${baseId}-${i}`}
            role="option"
            aria-selected={i === index}
            onClick={() => select(i)}
            className={`flex h-(--wheel-row) snap-center items-center justify-center font-stencil font-extrabold tabular-nums select-none ${
              i === index
                ? 'text-[length:calc(var(--wheel-row)*0.75)] text-ink'
                : 'text-[length:calc(var(--wheel-row)*0.56)] text-ink-muted'
            }`}
          >
            {format(v)}
          </div>
        ))}
      </div>
    </div>
  )
}
