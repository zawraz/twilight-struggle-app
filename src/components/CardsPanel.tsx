import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronRight, Layers, Pin, Play, SlidersHorizontal, X } from 'lucide-react'
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
  isInHand,
  LAST_TURN,
  pickableIds,
  SHUTTLE_DIPLOMACY,
  TEHRAN,
  type CardsAction,
  type CardsState,
  type CardState,
} from '../lib/cardGame'
import { CARD_SIDES, CARD_VALUES, PHASES, phaseStarted, type CardSide, type Phase } from '../lib/cards'
import { PLAYERS, type PlayerId } from '../lib/players'
import { useCooldown } from '../lib/useCooldown'
import type { Toast } from '../lib/useToast'
import { CardRow, type RowDivider } from './CardRow'
import { EventPicker } from './EventPicker'
import { PlayerPicker } from './PlayerPicker'
import { SUBMIT_COOLDOWN_MS, UndoIcon } from './RollTracker'
import { SIDE_TEXT } from './tone'

/** Each count's mark, matching the marks on the card rows. */
const STATE_ICON: Record<CardState, ReactNode> = {
  available: <Layers className="size-4 text-ink-muted" aria-hidden="true" />,
  in_play: <Pin className="size-4 text-go" strokeWidth={2.5} aria-hidden="true" />,
  discarded: <Play className="size-3.5 text-ink-muted" aria-hidden="true" />,
  removed: <X className="size-4 text-danger" strokeWidth={3} aria-hidden="true" />,
}

/** The state filter a card answers to: a card in play counts as available. */
const filterState = (state: CardState): CardState => (state === 'in_play' ? 'available' : state)

/** With played cards at the bottom: available first, then the played ones. A card in play is pinned above both. */
const PLAYED_RANK: Record<CardState, number> = { available: 0, in_play: 0, discarded: 1, removed: 1 }

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
  /** Moves a side's Dziennik count of 4 Ops cards; null once the game has ended and the count is final. */
  onFourOps: ((player: PlayerId, by: 1 | -1) => void) | null
}

interface Play {
  id: number
  name: string
  state: CardState
}

/** The Karty tab: the turn, card counts, filters and the checklist itself. */
export function CardsPanel({ cards, dispatch, notify, onToastStale, onFourOps }: CardsPanelProps) {
  const [openId, setOpenId] = useState<number | null>(null)
  // A 4 Ops card waiting to hear who played it.
  const [asking, setAsking] = useState<Play | null>(null)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [filtersShown, setFiltersShown] = useState(false)
  const [playedLast, setPlayedLast] = useState(true)
  const [handFirst, setHandFirst] = useState(true)
  const [picks, setPicks] = useState<number[]>([])
  // Right after a new turn its button takes the turn back for a while.
  const [turnCooling, startTurnCooldown, cancelTurnCooldown] = useCooldown(SUBMIT_COOLDOWN_MS)
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
      // Shuttle Diplomacy in play is still to be played on, so Dostępne keeps it.
      matches(filters.state, filterState(cardState(cards, card.id))) &&
      matches(filters.value, card.value),
  )
  // Stable sort: a card in play pinned on top whatever the order chips say, then cards in hand,
  // then the rest available, then played ones, each in checklist order.
  const rank = (id: number) =>
    cardState(cards, id) === 'in_play'
      ? -1
      : (playedLast ? PLAYED_RANK[cardState(cards, id)] * 2 : 0) + (handFirst && !isInHand(cards, id) ? 1 : 0)
  const shown = [...visible].sort((a, b) => rank(a.id) - rank(b.id))
  // The list falls into the blocks the order puts together: the card in play, the hand, the rest,
  // and the played cards. A thicker line closes each block and, in the hand and the rest, each ops value;
  // a green one closes the hand, a red one where the played cards begin. With the order chips off their cards join the rest.
  const block = (id: number) => {
    const state = cardState(cards, id)
    if (state === 'in_play') return 'in_play'
    if (playedLast && state !== 'available') return 'played'
    if (handFirst && isInHand(cards, id)) return 'hand'
    return 'rest'
  }
  const divider = (i: number): RowDivider | undefined => {
    const [card, next] = [shown[i], shown[i + 1]]
    if (next === undefined) return undefined
    const [here, below] = [block(card.id), block(next.id)]
    if (here !== below) return below === 'played' ? 'played' : here === 'hand' ? 'hand' : 'value'
    return here !== 'played' && next.value !== card.value ? 'value' : undefined
  }

  function nextTurn() {
    // Going back the turn is what takes its reshuffle back.
    if (entersWithReshuffle(cards)) {
      const back = discardedIds(cards).length
      notify({ text: back > 0 ? copy.cards.reshuffled(back) : copy.cards.deckRanOut, undo: previousTurn })
    } else onToastStale()
    setOpenId(null)
    startTurnCooldown()
    dispatch({ type: 'nextTurn' })
  }

  function previousTurn() {
    setOpenId(null)
    cancelTurnCooldown()
    onToastStale()
    dispatch({ type: 'previousTurn' })
  }

  function change(id: number, name: string, state: CardState) {
    setOpenId(null)
    // Once a card is played on the new turn, the turn is under way.
    cancelTurnCooldown()
    const card = inPlay.find((c) => c.id === id)
    if (state !== 'available' && card?.value === 4 && onFourOps) {
      setAsking({ id, name, state })
      return
    }
    play(id, name, state)
  }

  function playedBy(player: PlayerId) {
    const { id, name, state } = asking!
    setAsking(null)
    onFourOps!(player, 1)
    play(id, name, state, player)
  }

  function play(id: number, name: string, state: CardState, by?: PlayerId) {
    if (cardsReducer(cards, { type: 'setCardState', id, state }).pending !== null) {
      // An event card: its toast comes once its picker is done.
      eventStart.current = cards
      setPicks([])
      onToastStale()
      dispatch({ type: 'setCardState', id, state })
      return
    }
    const text = copy.cards.changed(name, copy.cards.state[state])
    notify({
      text: by ? copy.fourOps.playedBy(text, PLAYERS.find((p) => p.id === by)!.label) : text,
      // The whole game back, so a card in hand gets its mark back too; a 4 Ops card takes its count with it.
      undo: () => {
        dispatch({ type: 'restore', state: cards })
        if (by) onFourOps?.(by, -1)
      },
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
    <div className={`grid min-h-0 gap-2 ${pending !== null ? 'grid-rows-[auto_auto_1fr]' : 'grid-rows-[auto_1fr]'}`}>
      <section aria-label={copy.cards.turn} className="flex flex-col gap-2 rounded-card border border-line bg-surface-raised p-2">
        {/* Mirrored around the counts: the filters and the deck on the left, the turn and its button on the right.
            The outer columns share the space left over equally, so the counts sit dead centre.
            The deck and turn numbers carry their labels on top, to keep the row narrow; the labels hang
            above the numbers so the numbers, not number and label together, centre on the row. */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex items-center gap-3 justify-self-start">
            <button
              type="button"
              aria-label={copy.cards.filters}
              aria-pressed={filtersShown}
              onClick={() => setFiltersShown((s) => !s)}
              disabled={pending !== null}
              className={`relative grid size-9 shrink-0 place-items-center rounded-counter border-2 transition-colors disabled:opacity-30 ${
                filtersShown ? 'border-gold bg-gold text-on-gold' : 'border-line-strong text-ink'
              }`}
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {activeFilters > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full border border-surface-raised bg-gold font-mono text-[10px] leading-none font-bold text-on-gold tabular-nums"
                >
                  {activeFilters}
                </span>
              )}
            </button>
            <div className="relative" aria-label={copy.cards.deckCount(cards.deck)} role="status">
              <span className="absolute bottom-full left-1/2 mb-0.5 -translate-x-1/2 font-condensed text-[10px] leading-3 font-semibold uppercase tracking-[0.08em] text-ink-muted">
                {copy.cards.deck}
              </span>
              <span className="block min-w-[2ch] text-center font-stencil text-3xl leading-none font-extrabold tabular-nums">{cards.deck}</span>
            </div>
          </div>
          {/* Stacked, to fit between the deck and the turn; one grid, so each side's numbers line up right-aligned.
              Each number gets room for two digits and the Shuttle Diplomacy pin always has its place, so nothing shifts. */}
          <div
            role="group"
            aria-label={copy.cards.counts}
            className="grid justify-self-center grid-cols-[auto_auto_auto_auto_auto_auto_auto] font-mono text-xs leading-4 tabular-nums"
          >
            {CARD_STATES.map((state) => {
              const count = (side: CardSide) =>
                inPlay.filter((card) => card.player === side && cardState(cards, card.id) === state).length
              const [ussr, us, neutral] = CARD_SIDES.map(count)
              // The card in play sits beside the discard pile it goes to next.
              const shuttle = state === 'discarded' && cardState(cards, SHUTTLE_DIPLOMACY) === 'in_play'
              const label = copy.cards.countFor(copy.cards.states[state], ussr, us, neutral)
              return (
                <div
                  key={state}
                  role="img"
                  className="col-span-7 grid h-4 grid-cols-subgrid items-center text-right"
                  aria-label={shuttle ? copy.cards.withInPlay(label) : label}
                >
                  <span className="mr-2.5 grid w-4 place-items-center">{STATE_ICON[state]}</span>
                  <span className={`w-[2ch] ${SIDE_TEXT.ussr}`}>{ussr}</span>
                  <span className="px-1 text-line-strong">|</span>
                  <span className={`w-[2ch] ${SIDE_TEXT.us}`}>{us}</span>
                  <span className="px-1 text-line-strong">|</span>
                  <span className={`w-[2ch] ${SIDE_TEXT.neutral}`}>{neutral}</span>
                  <span className="ml-2.5 grid w-4 place-items-center">{shuttle && STATE_ICON.in_play}</span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-3 justify-self-end">
            <div className="relative" aria-label={copy.cards.turnOf(cards.turn)} role="status">
              <span className="absolute bottom-full left-1/2 mb-0.5 -translate-x-1/2 font-condensed text-[10px] leading-3 font-semibold uppercase tracking-[0.08em] text-ink-muted">
                {copy.cards.turn}
              </span>
              <span className="block min-w-[2ch] text-center font-stencil text-3xl leading-none font-extrabold tabular-nums">{cards.turn}</span>
            </div>
            <button
              type="button"
              aria-label={turnCooling ? copy.cards.undoTurn : copy.cards.nextTurn}
              data-cooling={turnCooling}
              onClick={turnCooling ? previousTurn : nextTurn}
              disabled={!turnCooling && (cards.turn >= LAST_TURN || pending !== null)}
              className={`relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-counter border-2 transition-colors disabled:opacity-30 ${
                turnCooling ? 'border-gold text-gold-text' : 'border-line-strong text-ink'
              }`}
            >
              {turnCooling ? <UndoIcon className="size-4" /> : <ChevronRight className="size-5" aria-hidden="true" />}
              {turnCooling && (
                <span
                  aria-hidden="true"
                  style={{ animationDuration: `${SUBMIT_COOLDOWN_MS}ms` }}
                  className="absolute inset-x-0 bottom-0 h-1 origin-left animate-drain bg-gold motion-reduce:hidden"
                />
              )}
            </button>
          </div>
        </div>
        {filtersShown && pending === null && (
          <div className="grid gap-1.5 border-t border-line pt-2">
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
                  {state === 'available' && cardState(cards, SHUTTLE_DIPLOMACY) === 'in_play' && (
                    <Pin
                      className={`size-3.5 ${filters.state.includes(state) ? '' : 'text-go'}`}
                      strokeWidth={2.5}
                      aria-label={copy.cards.withShuttle}
                      role="img"
                    />
                  )}
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
            <ChipGroup label={copy.cards.filterGroups.order}>
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
            </ChipGroup>
          </div>
        )}
      </section>

      {pending !== null && <EventPicker event={pending} count={picks.length} onConfirm={confirmPicks} />}

      <ul
        aria-label={copy.cards.list}
        className="min-h-0 overflow-y-auto overscroll-contain rounded-card border border-line bg-surface-raised"
      >
        {shown.map((card, i) => (
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
            divider={divider(i)}
          />
        ))}
        {shown.length === 0 && (
          <li className="p-4 text-center font-condensed text-sm uppercase tracking-[0.08em] text-ink-muted">
            {copy.cards.noMatches}
          </li>
        )}
      </ul>

      {asking && <PlayerPicker cardName={asking.name} onPick={playedBy} onCancel={() => setAsking(null)} />}
    </div>
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
