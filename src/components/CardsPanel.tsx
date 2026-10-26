import { ArrowDownWideNarrow, ChevronLeft, ChevronRight, Shuffle, SlidersHorizontal, Undo2 } from 'lucide-react'
import { useEffect, useState, type Dispatch, type ReactNode } from 'react'
import { copy } from '../copy'
import {
  CARD_STATES,
  cardsInPlay,
  cardState,
  discardedIds,
  FIRST_TURN,
  LAST_TURN,
  RESHUFFLE_TURNS,
  type CardsAction,
  type CardsState,
  type CardState,
} from '../lib/cardGame'
import { CARD_SIDES, CARD_VALUES, PHASES, phaseStarted, type CardSide, type Phase } from '../lib/cards'
import { useConfirmTap } from '../lib/useConfirmTap'
import { useCooldown } from '../lib/useCooldown'
import { CardRow } from './CardRow'
import { ConfirmCaption } from './ConfirmCaption'
import { SIDE_TEXT } from './tone'

/** After a manual reshuffle the button offers to take it back for this long. */
export const RESHUFFLE_UNDO_MS = 5000
/** How long a turn or reshuffle message stays on screen. */
export const NOTICE_MS = 5000

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
}

/** The Karty tab: the turn, card counts, filters and the checklist itself. */
export function CardsPanel({ cards, dispatch }: CardsPanelProps) {
  const [openId, setOpenId] = useState<number | null>(null)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [filtersShown, setFiltersShown] = useState(false)
  const [playedLast, setPlayedLast] = useState(false)
  const [notice, setNotice] = useState('')
  // Bumped with every notice, so a repeated message still restarts its timer.
  const [noticeRun, setNoticeRun] = useState(0)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice, noticeRun])

  const announce = (text: string) => {
    setNotice(text)
    setNoticeRun((r) => r + 1)
  }

  // By ops value, so a phase that joins mixes in with the rest; within a value, checklist order.
  // Each checklist section is already by value, so a single phase reads exactly as on paper.
  const inPlay = [...cardsInPlay(cards.turn)].sort((a, b) => a.value - b.value || a.order - b.order)
  const startedPhases = PHASES.filter((phase) => phaseStarted(phase, cards.turn))
  // A phase chip left on while going back past its start would hide every card without showing why.
  const phaseFilter = filters.phase.filter((phase) => startedPhases.includes(phase))
  const activeFilters = filters.player.length + phaseFilter.length + filters.state.length + filters.value.length

  const matches = <T,>(selected: readonly T[], value: T) => selected.length === 0 || selected.includes(value)
  const visible = inPlay.filter(
    (card) =>
      matches(filters.player, card.player) &&
      matches(phaseFilter, card.phase) &&
      matches(filters.state, cardState(cards, card.id)) &&
      matches(filters.value, card.value),
  )
  // Stable sort: available cards first, played ones after, each in checklist order.
  const shown = playedLast
    ? [...visible].sort(
        (a, b) => Number(cardState(cards, a.id) !== 'available') - Number(cardState(cards, b.id) !== 'available'),
      )
    : visible

  function nextTurn() {
    const entering = cards.turn + 1
    if (RESHUFFLE_TURNS.includes(entering)) announce(copy.cards.reshuffled(discardedIds(cards).length))
    setOpenId(null)
    dispatch({ type: 'nextTurn' })
  }

  function previousTurn() {
    setOpenId(null)
    setNotice('')
    dispatch({ type: 'previousTurn' })
  }

  function change(id: number, name: string, state: CardState) {
    setOpenId(null)
    announce(copy.cards.changed(name, copy.cards.state[state]))
    dispatch({ type: 'setCardState', id, state })
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
          <IconButton label={copy.cards.previousTurn} onClick={previousTurn} disabled={cards.turn <= FIRST_TURN}>
            <ChevronLeft className="size-5" aria-hidden="true" />
          </IconButton>
          <div className="flex items-baseline gap-1.5" aria-label={copy.cards.turnOf(cards.turn)} role="status">
            <span className="font-condensed text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
              {copy.cards.turn}
            </span>
            <span className="w-7 text-center font-stencil text-3xl leading-none font-extrabold tabular-nums">{cards.turn}</span>
          </div>
          <IconButton label={copy.cards.nextTurn} onClick={nextTurn} disabled={cards.turn >= LAST_TURN}>
            <ChevronRight className="size-5" aria-hidden="true" />
          </IconButton>
          <ReshuffleButton cards={cards} dispatch={dispatch} announce={announce} />
        </div>
        <dl aria-label={copy.cards.counts} className="grid grid-cols-3 gap-1">
          {CARD_STATES.map((state) => {
            const count = (side: CardSide) =>
              inPlay.filter((card) => card.player === side && cardState(cards, card.id) === state).length
            const [ussr, us, neutral] = CARD_SIDES.map(count)
            return (
              <div key={state} className="flex flex-col" aria-label={copy.cards.countFor(copy.cards.states[state], ussr, us, neutral)}>
                <dt className="font-condensed text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  {copy.cards.states[state]}
                </dt>
                <dd className="font-mono text-sm tabular-nums" aria-hidden="true">
                  <span className={SIDE_TEXT.ussr}>{ussr}</span>
                  <span className="text-line-strong">|</span>
                  <span className={SIDE_TEXT.us}>{us}</span>
                  <span className="text-line-strong">|</span>
                  <span className={SIDE_TEXT.neutral}>{neutral}</span>
                </dd>
              </div>
            )
          })}
        </dl>
        <p role="status" className="min-h-4 font-condensed text-xs leading-4 font-semibold uppercase tracking-[0.06em] text-gold-text">
          {notice}
        </p>
      </section>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip pressed={filtersShown} onClick={() => setFiltersShown((s) => !s)}>
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            {copy.cards.filters}
            {activeFilters > 0 && <span className="font-mono tabular-nums">({activeFilters})</span>}
          </Chip>
          <Chip pressed={playedLast} onClick={() => setPlayedLast((s) => !s)}>
            <ArrowDownWideNarrow className="size-4" aria-hidden="true" />
            {copy.cards.playedLast}
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

      <ul
        aria-label={copy.cards.list}
        className="min-h-0 overflow-y-auto overscroll-contain rounded-card border border-line bg-surface-raised"
      >
        {shown.map((card) => (
          <CardRow
            key={card.id}
            card={card}
            state={cardState(cards, card.id)}
            open={openId === card.id}
            onToggle={() => setOpenId((id) => (id === card.id ? null : card.id))}
            onClose={() => setOpenId(null)}
            onChange={(state) => change(card.id, card.name, state)}
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

/** Przetasuj takes a confirming second tap; afterwards it offers to take the reshuffle back for a while. */
function ReshuffleButton({
  cards,
  dispatch,
  announce,
}: {
  cards: CardsState
  dispatch: Dispatch<CardsAction>
  announce: (text: string) => void
}) {
  const [returned, setReturned] = useState<number[]>([])
  const [cooling, startCooldown, cancelCooldown] = useCooldown(RESHUFFLE_UNDO_MS)
  const { armed, tap } = useConfirmTap(() => {
    const ids = discardedIds(cards)
    if (ids.length === 0) {
      announce(copy.cards.nothingToReshuffle)
      return
    }
    dispatch({ type: 'reshuffle' })
    setReturned(ids)
    announce(copy.cards.reshuffled(ids.length))
    startCooldown()
  })

  const undo = () => {
    dispatch({ type: 'undoReshuffle', ids: returned })
    cancelCooldown()
    announce('')
  }

  return (
    <div className="relative ml-auto shrink-0">
      {armed && <ConfirmCaption placement="left" />}
      <button
        type="button"
        data-armed={armed}
        onClick={cooling ? undo : tap}
        className={`relative flex h-9 items-center gap-1.5 overflow-hidden rounded-counter border-2 px-2.5 font-condensed text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${
          cooling
            ? 'border-gold bg-surface-sunken text-gold-text'
            : armed
              ? 'border-danger text-danger'
              : 'border-line-strong text-ink'
        }`}
      >
        {cooling ? <Undo2 className="size-4" aria-hidden="true" /> : <Shuffle className="size-4" aria-hidden="true" />}
        {cooling ? copy.cards.undoReshuffle : copy.cards.reshuffle}
        {cooling && (
          <span
            aria-hidden="true"
            style={{ animationDuration: `${RESHUFFLE_UNDO_MS}ms` }}
            className="absolute inset-x-0 bottom-0 h-1 origin-left animate-drain bg-gold motion-reduce:hidden"
          />
        )}
      </button>
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
