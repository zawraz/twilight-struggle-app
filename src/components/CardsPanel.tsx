import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronLeft, ChevronRight, Layers, Play, SlidersHorizontal, X } from 'lucide-react'
import { useRef, useState, type Dispatch, type ReactNode } from 'react'
import { copy } from '../copy'
import {
  ASK_NOT,
  CARD_STATES,
  cardsReducer,
  cardsInPlay,
  cardState,
  discardedIds,
  entersWithReshuffle,
  EVENT_PICKS,
  FIRST_TURN,
  isInHand,
  LAST_TURN,
  pickableIds,
  TEHRAN,
  type CardsAction,
  type CardsState,
  type CardState,
} from '../lib/cardGame'
import { CARD_SIDES, CARD_VALUES, PHASES, phaseStarted, type CardSide, type Phase } from '../lib/cards'
import type { Toast } from '../lib/useToast'
import { CardRow } from './CardRow'
import { EventPicker } from './EventPicker'
import { SIDE_TEXT } from './tone'

/** Each count's mark, matching the marks on the card rows. */
const STATE_ICON: Record<CardState, ReactNode> = {
  available: <Layers className="size-4 text-ink-muted" aria-hidden="true" />,
  discarded: <Play className="size-3.5 text-ink-muted" aria-hidden="true" />,
  removed: <X className="size-4 text-danger" strokeWidth={3} aria-hidden="true" />,
}

interface Filters {
  player: CardSide[]
  phase: Phase[]
  state: CardState[]
  value: number[]
}

const NO_FILTERS: Filters = { player: [], phase: [], state: [], value: [] }

interface CardsPanelProps {
  cards: CardsState
  dispatch: Dispatch<CardsAction>
  /** Shows what just happened over the header, with a way to take it back. */
  notify: (toast: Toast) => void
  /** A turn change or a played event makes the last toast's undo stale. */
  onToastStale: () => void
}

/** The Karty tab: the turn, card counts, filters and the checklist itself. */
export function CardsPanel({ cards, dispatch, notify, onToastStale }: CardsPanelProps) {
  const [openId, setOpenId] = useState<number | null>(null)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [filtersShown, setFiltersShown] = useState(false)
  const [playedLast, setPlayedLast] = useState(true)
  const [handFirst, setHandFirst] = useState(true)
  const [picks, setPicks] = useState<number[]>([])
  // The game from just before the event card was played: what its toast's undo puts back.
  const eventStart = useRef<CardsState | null>(null)
  const pending = cards.pending
  const pickable = pickableIds(cards)
  // By ops value, so a phase that joins mixes in with the rest; within a value, checklist order.
  // Each checklist section is already by value, so a single phase reads exactly as on paper.
  const inPlay = [...cardsInPlay(cards.turn)].sort((a, b) => a.value - b.value || a.order - b.order)
  const startedPhases = PHASES.filter((phase) => phaseStarted(phase, cards.turn))
  // A phase chip left on while going back past its start would hide every card without showing why.
  const phaseFilter = filters.phase.filter((phase) => startedPhases.includes(phase))
  const activeFilters = filters.player.length + phaseFilter.length + filters.state.length + filters.value.length

  const matches = <T,>(selected: readonly T[], value: T) => selected.length === 0 || selected.includes(value)
  // A picker needs every card it can pick, whatever the filters say.
  const visible = pending !== null ? inPlay.filter((card) => pickable.includes(card.id)) : inPlay.filter(
    (card) =>
      matches(filters.player, card.player) &&
      matches(phaseFilter, card.phase) &&
      matches(filters.state, cardState(cards, card.id)) &&
      matches(filters.value, card.value),
  )
  // Stable sort: cards in hand, then the rest available, then played ones, each in checklist order.
  const rank = (id: number) =>
    (playedLast && cardState(cards, id) !== 'available' ? 2 : 0) + (handFirst && !isInHand(cards, id) ? 1 : 0)
  const shown = [...visible].sort((a, b) => rank(a.id) - rank(b.id))

  function nextTurn() {
    // Going back the turn is what takes its reshuffle back.
    if (entersWithReshuffle(cards)) {
      const back = discardedIds(cards).length
      notify({ text: back > 0 ? copy.cards.reshuffled(back) : copy.cards.deckRanOut, undo: previousTurn })
    } else onToastStale()
    setOpenId(null)
    dispatch({ type: 'nextTurn' })
  }

  function previousTurn() {
    setOpenId(null)
    onToastStale()
    dispatch({ type: 'previousTurn' })
  }

  function change(id: number, name: string, state: CardState) {
    setOpenId(null)
    if (cardsReducer(cards, { type: 'setCardState', id, state }).pending !== null) {
      // An event card: its toast comes once its picker is done.
      eventStart.current = cards
      setPicks([])
      onToastStale()
      dispatch({ type: 'setCardState', id, state })
      return
    }
    notify({
      text: copy.cards.changed(name, copy.cards.state[state]),
      // The whole game back, so a card in hand gets its mark back too.
      undo: () => dispatch({ type: 'restore', state: cards }),
    })
    dispatch({ type: 'setCardState', id, state })
  }

  function togglePick(id: number) {
    setPicks((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : prev.length < EVENT_PICKS[pending!] ? [...prev, id] : prev,
    )
  }

  function confirmPicks() {
    const start = eventStart.current
    const n = picks.length
    let text: string
    if (pending === TEHRAN) {
      text = copy.cards.tehran(n, cards.eventReturned.length)
    } else if (pending === ASK_NOT) {
      text = cards.deck < n ? copy.cards.drewReshuffled(n, discardedIds(cards).length + n) : copy.cards.drewWithout(n)
    } else {
      const taken = inPlay.find((card) => card.id === picks[0])
      text = taken ? copy.cards.toHand(taken.name) : copy.cards.nothingTaken
    }
    dispatch({ type: 'resolveEvent', picked: picks })
    setPicks([])
    eventStart.current = null
    // After a reload there is no snapshot to go back to.
    notify(start ? { text, undo: () => dispatch({ type: 'restore', state: start }) } : { text })
  }

  const toggle = <K extends keyof Filters>(group: K, value: Filters[K][number]) =>
    setFilters((prev) => {
      const selected = prev[group] as Filters[K][number][]
      return {
        ...prev,
        [group]: selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
      }
    })

  return (
    <div className="grid min-h-0 grid-rows-[auto_auto_1fr] gap-2">
      <section aria-label={copy.cards.turn} className="flex flex-col gap-2 rounded-card border border-line bg-surface-raised p-2">
        <div className="flex items-center gap-2">
          <IconButton label={copy.cards.previousTurn} onClick={previousTurn} disabled={cards.turn <= FIRST_TURN || pending !== null}>
            <ChevronLeft className="size-5" aria-hidden="true" />
          </IconButton>
          <div className="flex items-baseline gap-1.5" aria-label={copy.cards.turnOf(cards.turn)} role="status">
            <span className="font-condensed text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
              {copy.cards.turn}
            </span>
            <span className="w-7 text-center font-stencil text-3xl leading-none font-extrabold tabular-nums">{cards.turn}</span>
          </div>
          <IconButton label={copy.cards.nextTurn} onClick={nextTurn} disabled={cards.turn >= LAST_TURN || pending !== null}>
            <ChevronRight className="size-5" aria-hidden="true" />
          </IconButton>
          <div className="ml-auto flex items-baseline gap-1.5" aria-label={copy.cards.deckCount(cards.deck)} role="status">
            <span className="font-condensed text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
              {copy.cards.deck}
            </span>
            <span className="min-w-7 text-center font-stencil text-3xl leading-none font-extrabold tabular-nums">{cards.deck}</span>
          </div>
        </div>
        <div role="group" aria-label={copy.cards.counts} className="flex justify-between gap-2 px-1">
          {CARD_STATES.map((state) => {
            const count = (side: CardSide) =>
              inPlay.filter((card) => card.player === side && cardState(cards, card.id) === state).length
            const [ussr, us, neutral] = CARD_SIDES.map(count)
            return (
              <div
                key={state}
                role="img"
                className="flex items-center gap-1.5"
                aria-label={copy.cards.countFor(copy.cards.states[state], ussr, us, neutral)}
              >
                {STATE_ICON[state]}
                <span className="font-mono text-sm tabular-nums">
                  <span className={SIDE_TEXT.ussr}>{ussr}</span>
                  <span className="text-line-strong">|</span>
                  <span className={SIDE_TEXT.us}>{us}</span>
                  <span className="text-line-strong">|</span>
                  <span className={SIDE_TEXT.neutral}>{neutral}</span>
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {pending !== null ? (
        <EventPicker event={pending} count={picks.length} onConfirm={confirmPicks} />
      ) : (
        <div className="flex flex-col gap-2">
          {/* One line at phone width: the order chips show short labels. */}
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <Chip pressed={filtersShown} onClick={() => setFiltersShown((s) => !s)}>
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {copy.cards.filters}
              {activeFilters > 0 && <span className="font-mono tabular-nums">({activeFilters})</span>}
            </Chip>
            <Chip pressed={playedLast} onClick={() => setPlayedLast((s) => !s)} label={copy.cards.playedLast}>
              <ArrowDownWideNarrow className="size-4" aria-hidden="true" />
              {copy.cards.playedLastShort}
            </Chip>
            <Chip pressed={handFirst} onClick={() => setHandFirst((s) => !s)} label={copy.cards.handFirst}>
              <ArrowUpNarrowWide className="size-4" aria-hidden="true" />
              {copy.cards.handFirstShort}
            </Chip>
            {activeFilters > 0 && (
              <button
                type="button"
                onClick={() => setFilters(NO_FILTERS)}
                className="ml-auto px-1 font-condensed text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted underline"
              >
                {copy.cards.clearFilters}
              </button>
            )}
          </div>
          {filtersShown && (
            <div className="grid gap-1.5 rounded-card border border-line bg-surface-raised p-2">
              <ChipGroup label={copy.cards.filterGroups.player}>
                {CARD_SIDES.map((side) => (
                  <Chip key={side} pressed={filters.player.includes(side)} onClick={() => toggle('player', side)}>
                    <span className={filters.player.includes(side) ? '' : SIDE_TEXT[side]}>{copy.cards.sides[side]}</span>
                  </Chip>
                ))}
              </ChipGroup>
              {startedPhases.length > 1 && (
                <ChipGroup label={copy.cards.filterGroups.phase}>
                  {startedPhases.map((phase) => (
                    <Chip key={phase} pressed={filters.phase.includes(phase)} onClick={() => toggle('phase', phase)}>
                      {copy.cards.phases[phase]}
                    </Chip>
                  ))}
                </ChipGroup>
              )}
              <ChipGroup label={copy.cards.filterGroups.state}>
                {CARD_STATES.map((state) => (
                  <Chip key={state} pressed={filters.state.includes(state)} onClick={() => toggle('state', state)}>
                    {copy.cards.states[state]}
                  </Chip>
                ))}
              </ChipGroup>
              <ChipGroup label={copy.cards.filterGroups.value}>
                {CARD_VALUES.map((value) => (
                  <Chip
                    key={value}
                    pressed={filters.value.includes(value)}
                    onClick={() => toggle('value', value)}
                    label={copy.cards.ops(value)}
                  >
                    {value === 0 ? copy.cards.scoring : value}
                  </Chip>
                ))}
              </ChipGroup>
            </div>
          )}
        </div>
      )}

      <ul
        aria-label={copy.cards.list}
        className="min-h-0 overflow-y-auto overscroll-contain rounded-card border border-line bg-surface-raised"
      >
        {shown.map((card) => (
          <CardRow
            key={card.id}
            card={card}
            state={cardState(cards, card.id)}
            inHand={isInHand(cards, card.id)}
            open={openId === card.id}
            onToggle={() => setOpenId((id) => (id === card.id ? null : card.id))}
            onClose={() => setOpenId(null)}
            onChange={(state) => change(card.id, card.name, state)}
            pick={pending !== null ? { checked: picks.includes(card.id), onToggle: () => togglePick(card.id) } : undefined}
          />
        ))}
        {shown.length === 0 && (
          <li className="p-4 text-center font-condensed text-sm uppercase tracking-[0.08em] text-ink-muted">
            {copy.cards.noMatches}
          </li>
        )}
      </ul>
    </div>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-9 place-items-center rounded-counter border-2 border-line-strong text-ink disabled:opacity-30"
    >
      {children}
    </button>
  )
}

function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="w-12 font-condensed text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{label}</span>
      {children}
    </div>
  )
}

function Chip({
  pressed,
  onClick,
  label,
  children,
}: {
  pressed: boolean
  onClick: () => void
  label?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
      className={`flex h-8 min-w-8 items-center justify-center gap-1 rounded-counter border-2 px-2 font-condensed text-xs font-semibold uppercase tracking-[0.06em] transition-colors ${
        pressed ? 'border-gold bg-gold text-on-gold' : 'border-line bg-surface-sunken text-ink-muted'
      }`}
    >
      {children}
    </button>
  )
}
