import { ChevronUp } from 'lucide-react'
import { useEffect, useId, useRef, useState, type PointerEvent } from 'react'
import { copy } from '../copy'

/** Chance (%) of at least N successes, by net bonus, then by the card's ops (1–4), then N (1–5). */
export const PRESSURE_ODDS = [
  {
    bonus: 1,
    byOps: [
      [58.33, 41.67, 27.78, 16.67, 8.33],
      [82.64, 68.75, 54.4, 40.51, 27.93],
      [92.77, 84.09, 73.38, 61.34, 48.8],
      [96.99, 92.16, 84.34, 76.44, 68.52],
    ],
  },
  {
    bonus: 2,
    byOps: [
      [72.22, 58.33, 41.67, 27.78, 16.67],
      [92.28, 84.57, 73.38, 61.03, 48.23],
      [97.86, 94.64, 89.18, 81.84, 72.77],
      [99.4, 98.21, 95.89, 92.26, 88.01],
    ],
  },
] as const

/** "58 %": a whole percent, spaced as Polish writes it. */
const percent = (value: number) => `${Math.round(value)} %`

/** How far down (px) a drag must pull the sheet to close it. */
const CLOSE_DRAG = 80

/** The footer's Wywieranie presji button and the odds table it slides up. */
export function PressureSheet() {
  const [open, setOpen] = useState(false)
  // Still on screen: open, or sliding away (it leaves the page once it has).
  const [mounted, setMounted] = useState(false)
  // How far a finger has dragged the sheet down, while it does.
  const [drag, setDrag] = useState<number | null>(null)
  const start = useRef(0)
  const sheet = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  // Where no slide plays (reduced motion), nothing ends one: put the sheet away regardless.
  useEffect(() => {
    if (open || !mounted) return
    const timer = setTimeout(() => setMounted(false), 400)
    return () => clearTimeout(timer)
  }, [open, mounted])

  useEffect(() => {
    if (!open) return
    sheet.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function show() {
    setMounted(true)
    setOpen(true)
  }

  function close() {
    setOpen(false)
    setDrag(null)
    opener.current?.focus()
  }

  function onPointerDown(event: PointerEvent) {
    start.current = event.clientY
    setDrag(0)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function onPointerMove(event: PointerEvent) {
    if (drag === null) return
    setDrag(Math.max(0, event.clientY - start.current))
  }
  function onPointerUp() {
    if (drag === null) return
    if (drag > CLOSE_DRAG) close()
    else setDrag(null)
  }

  return (
    <footer>
      <button
        ref={opener}
        type="button"
        aria-expanded={open}
        onClick={show}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-card border border-line bg-surface-raised font-stencil text-lg leading-none font-extrabold uppercase tracking-[0.04em] text-ink-muted"
      >
        <ChevronUp className="size-5" aria-hidden="true" />
        {copy.pressure.title}
      </button>

      {mounted && (
        <>
      {/* The backdrop: a tap on it puts the sheet away. */}
      <div
        aria-hidden="true"
        onClick={close}
        className={`fixed inset-0 z-40 bg-surface-sunken/80 transition-opacity duration-300 starting:opacity-0 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        inert={!open}
        onTransitionEnd={(event) => event.target === event.currentTarget && !open && setMounted(false)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={open && drag ? { transform: `translateY(${drag}px)` } : undefined}
        className={`fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85%] max-w-3xl touch-none flex-col gap-3 overflow-y-auto rounded-t-xl border-x border-t border-line bg-surface-raised px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] outline-none ${drag === null ? 'transition-transform duration-300 ease-out' : ''} starting:translate-y-full ${open ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div aria-hidden="true" className="mx-auto h-1.5 w-10 shrink-0 rounded-full bg-line-strong" />
        <h2 id={titleId} className="text-center font-stencil text-lg leading-none font-extrabold uppercase tracking-[0.04em] text-ink-muted">
          {copy.pressure.title}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {PRESSURE_ODDS.map(({ bonus, byOps }) => (
            <table key={bonus} className="w-full border-collapse font-mono text-sm tabular-nums">
              <caption className="pb-1 font-condensed text-sm font-semibold uppercase tracking-[0.08em] text-gold-text">
                {copy.pressure.bonus(bonus)}
              </caption>
              <thead>
                <tr className="border-b border-line-strong font-condensed text-ink-muted">
                  <th scope="col" className="w-8 py-1 text-left font-semibold">
                    <span className="sr-only">{copy.pressure.successes}</span>
                  </th>
                  {byOps.map((_, i) => (
                    <th key={i} scope="col" className="py-1 text-right font-semibold">
                      {copy.pressure.ops(i + 1)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byOps[0].map((_, row) => (
                  <tr key={row} className="border-b border-line last:border-b-0">
                    <th scope="row" className="py-1 text-left font-semibold text-ink-muted">
                      {row + 1}:
                    </th>
                    {byOps.map((odds, i) => (
                      <td key={i} className="py-1 text-right text-ink">
                        {percent(odds[row])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      </div>
        </>
      )}
    </footer>
  )
}
