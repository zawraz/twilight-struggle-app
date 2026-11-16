import { ChevronUp } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { copy } from '../copy'

/** The net bonuses the sheet has a tab for, lowest first. */
const BONUSES = [-4, -3, -2, -1, 0, 1, 2, 3, 4] as const
/** The tab the sheet opens on: no bonus either way. */
const START = BONUSES.indexOf(0)
const MAX_OPS = 4
const MAX_SUCCESSES = 5

/** Chance of each number of successes one op scores: one die plus the bonus against the other, the margin it wins by. */
function perOp(bonus: number) {
  const odds = Array<number>(6 + Math.max(0, bonus)).fill(0)
  for (let own = 1; own <= 6; own++)
    for (let other = 1; other <= 6; other++) odds[Math.max(0, own - other + bonus)] += 1 / 36
  return odds
}

/** The chances of two independent counts' sum, from each one's chances. */
function combine(a: number[], b: number[]) {
  const sum = Array<number>(a.length + b.length - 1).fill(0)
  a.forEach((p, i) => b.forEach((q, j) => (sum[i + j] += p * q)))
  return sum
}

/** Chance (0–1) of at least N successes, by net bonus, then by the card's ops (1–4), then N (1–5). */
const PRESSURE_ODDS = BONUSES.map((bonus) => {
  const one = perOp(bonus)
  let total = [1]
  return Array.from({ length: MAX_OPS }, () => {
    total = combine(total, one)
    return Array.from({ length: MAX_SUCCESSES }, (_, n) => total.slice(n + 1).reduce((sum, p) => sum + p, 0))
  })
})

/** "58 %": a whole percent, spaced as Polish writes it; "-" for odds that round to nothing. */
function percent(chance: number) {
  const whole = Math.round(chance * 100)
  return whole === 0 ? '-' : `${whole} %`
}

/** A row of the odds, marker and numbers alike: one height, so the two sides line up. */
const ROW = 'h-7 items-center border-b border-line last:border-b-0'

/** How far down (px) a drag must pull the sheet to close it. */
const CLOSE_DRAG = 80

/** The footer's Wywieranie presji button and the odds it slides up: a tab per net bonus, swiped between. */
export function PressureSheet() {
  const [open, setOpen] = useState(false)
  // Still on screen: open, or sliding away (it leaves the page once it has).
  const [mounted, setMounted] = useState(false)
  // How far a finger has dragged the sheet down, while it does.
  const [drag, setDrag] = useState<number | null>(null)
  const [active, setActive] = useState(START)
  const activeRef = useRef(START)
  activeRef.current = active
  const start = useRef(0)
  const sheet = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const pages = useRef<HTMLDivElement>(null)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const titleId = useId()
  const idPrefix = useId()

  // Where no slide plays (reduced motion), nothing ends one: put the sheet away regardless.
  useEffect(() => {
    if (open || !mounted) return
    const timer = setTimeout(() => setMounted(false), 400)
    return () => clearTimeout(timer)
  }, [open, mounted])

  useEffect(() => {
    if (!open) return
    sheet.current?.focus()
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Each time it slides up, the sheet opens on the tab it was last left on.
  useLayoutEffect(() => {
    if (!mounted || !pages.current) return
    pages.current.scrollLeft = active * pages.current.clientWidth
    // Only on mounting: from then on the scroll drives the tab.
  }, [mounted])

  // A resize changes the pages' width: keep the shown one lined up.
  useEffect(() => {
    const el = pages.current
    if (!mounted || !el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      el.scrollLeft = activeRef.current * el.clientWidth
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [mounted])

  function show() {
    setMounted(true)
    setOpen(true)
  }

  function close() {
    setOpen(false)
    setDrag(null)
    opener.current?.focus()
  }

  /** A tapped tab's page, shown at once: a glide there would lag behind the tap. */
  function select(index: number) {
    setActive(index)
    const el = pages.current
    if (el) el.scrollLeft = index * el.clientWidth
  }

  /** A swipe picks the tab of the page it has scrolled to. */
  function onScroll() {
    const el = pages.current
    if (!el || el.clientWidth === 0) return
    setActive(Math.min(BONUSES.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))))
  }

  function onTabKey(event: KeyboardEvent, index: number) {
    const next = {
      ArrowRight: Math.min(BONUSES.length - 1, index + 1),
      ArrowLeft: Math.max(0, index - 1),
      Home: 0,
      End: BONUSES.length - 1,
    }[event.key]
    if (next === undefined) return
    event.preventDefault()
    select(next)
    tabs.current[next]?.focus()
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
    <div>
      <button
        ref={opener}
        type="button"
        aria-expanded={open}
        onClick={show}
        className="flex h-12.5 w-full items-center justify-center gap-2 rounded-counter border-2 border-line bg-surface-sunken font-stencil text-lg leading-none font-extrabold uppercase tracking-[0.04em] text-ink-muted"
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
            style={open && drag ? { transform: `translateY(${drag}px)` } : undefined}
            className={`fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85%] max-w-3xl flex-col gap-3 overflow-y-auto rounded-t-xl border-x border-t border-line bg-surface-raised px-4 pb-[max(16px,env(safe-area-inset-bottom))] outline-none ${drag === null ? 'transition-transform duration-300 ease-out' : ''} starting:translate-y-full ${open ? 'translate-y-0' : 'translate-y-full'}`}
          >
            {/* The grip: dragged down, it puts the sheet away. The tabs and tables below scroll instead. */}
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="-mx-4 flex touch-none flex-col gap-3 px-4 pt-2"
            >
              <div aria-hidden="true" className="mx-auto h-1.5 w-10 shrink-0 rounded-full bg-line-strong" />
              <h2 id={titleId} className="text-center font-stencil text-lg leading-none font-extrabold uppercase tracking-[0.04em] text-ink-muted">
                {copy.pressure.title}
              </h2>
            </div>

            <div role="tablist" aria-label={copy.pressure.bonusLabel} className="flex">
              {BONUSES.map((bonus, index) => {
                const selected = index === active
                return (
                  <button
                    key={bonus}
                    ref={(el) => {
                      tabs.current[index] = el
                    }}
                    type="button"
                    role="tab"
                    id={`${idPrefix}-tab-${index}`}
                    aria-controls={`${idPrefix}-panel-${index}`}
                    aria-label={copy.pressure.bonus(bonus)}
                    aria-selected={selected}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => select(index)}
                    onKeyDown={(event) => onTabKey(event, index)}
                    className={`flex h-12 flex-1 items-center justify-center border-y-2 border-l-2 touch-manipulation font-mono text-sm font-semibold tabular-nums first:rounded-l-counter last:rounded-r-counter last:border-r-2 ${
                      selected ? 'border-gold bg-surface-sunken text-gold-text outline-2 -outline-offset-2 outline-gold' : 'border-line bg-surface-sunken text-ink-muted'
                    } ${index > 0 && index - 1 === active ? 'border-l-transparent' : ''}`}
                  >
                    {copy.pressure.signed(bonus)}
                  </button>
                )
              })}
            </div>

            {/* The headers stay put; only the numbers between them slide, a page per tab. They are drawn
                for the eye only: each page carries its own headers for screen readers. */}
            <div className="grid grid-cols-[2.5rem_1fr] font-mono text-sm tabular-nums">
              <div aria-hidden="true" className="col-span-2 grid grid-cols-subgrid border-b border-line-strong font-condensed font-semibold text-ink-muted">
                <span />
                <div className="grid grid-cols-4">
                  {PRESSURE_ODDS[0].map((_, ops) => (
                    <span key={ops} className="py-1 text-right">
                      {copy.pressure.ops(ops + 1)}
                    </span>
                  ))}
                </div>
              </div>
              <div aria-hidden="true" className="font-semibold text-ink-muted">
                {PRESSURE_ODDS[0][0].map((_, row) => (
                  <div key={row} className={`flex ${ROW}`}>
                    ≥{row + 1}
                  </div>
                ))}
              </div>

              {/* A swipe snaps to the next or previous page. Relative, so the pages' screen-reader-only
                  headers sit inside it instead of stretching the sheet sideways. */}
              <div ref={pages} onScroll={onScroll} className="no-scrollbar relative flex min-w-0 snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
                {PRESSURE_ODDS.map((byOps, index) => (
                  <div
                    key={BONUSES[index]}
                    role="tabpanel"
                    id={`${idPrefix}-panel-${index}`}
                    aria-labelledby={`${idPrefix}-tab-${index}`}
                    aria-hidden={index !== active}
                    inert={index !== active}
                    className="w-full shrink-0 snap-center snap-always"
                  >
                    <div role="table" aria-labelledby={`${idPrefix}-tab-${index}`}>
                      <div role="row" className="sr-only">
                        <span role="columnheader">{copy.pressure.successes}</span>
                        {byOps.map((_, ops) => (
                          <span key={ops} role="columnheader">
                            {copy.pressure.ops(ops + 1)}
                          </span>
                        ))}
                      </div>
                      {byOps[0].map((_, row) => (
                        <div key={row} role="row" className={`${ROW} grid grid-cols-4`}>
                          <span role="rowheader" className="sr-only">
                            ≥{row + 1}
                          </span>
                          {byOps.map((odds, ops) => (
                            <span key={ops} role="cell" className="text-right text-ink">
                              {percent(odds[row])}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
