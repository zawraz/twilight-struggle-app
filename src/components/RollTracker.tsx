import { useState, type CSSProperties } from 'react'
import { copy, rolls, type TrackerCopy } from '../copy'
import { PLAYERS, type PerPlayer, type Player, type PlayerId } from '../lib/players'
import { useCooldown } from '../lib/useCooldown'
import { Section } from './Section'
import { WheelPicker } from './WheelPicker'
import { TONE } from './tone'

/** How many of the newest entries the log shows. */
export const LOG_VISIBLE = 3
/** After a submit the button shows what was added for this long; a tap meanwhile takes it back. */
export const SUBMIT_COOLDOWN_MS = 5000

interface RollTrackerProps {
  /** The section's title and every label it shows or announces. */
  text: TrackerCopy
  /** Wheel values, top to bottom. */
  values: readonly number[]
  initialValue: number
  formatValue: (value: number) => string
  summarize: (values: readonly number[]) => string
  /** Every submitted entry per player, oldest first. */
  entries: PerPlayer<readonly number[]>
  onSubmit: (player: PlayerId, value: number) => void
  /** Takes back the player's newest entry. */
  onUndo: (player: PlayerId) => void
  /** The game has ended: summaries are shown and no more entries are taken. */
  revealed: boolean
}

/**
 * Roll entry: pick a value on the shared wheel and submit it with a player's button to their muted log.
 * Each player's summary shows once the game is ended.
 */
export function RollTracker({
  text,
  values,
  initialValue,
  formatValue,
  summarize,
  entries,
  onSubmit,
  onUndo,
  revealed,
}: RollTrackerProps) {
  const [selected, setSelected] = useState(initialValue)

  return (
    // Row 1: one shared wheel, each player's button on their side of it. Rows 2–3: one shared log caption,
    // then each player's values under their button.
    // The wheel's rows take what the body has left after the caption (h-7, h-5 when short) and the log (h-5).
    <Section
      title={text.title}
      columnsClassName="grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
      bodyClassName="grid-rows-[minmax(0,1fr)_auto_auto] gap-y-0 [container-type:size] [--wheel-row:min(var(--wheel-row-max),calc((100cqh_-_48px)/3))] short:[--wheel-row:min(var(--wheel-row-max),calc((100cqh_-_40px)/3))]"
    >
      <div className="col-start-2 row-start-1 self-center">
        <WheelPicker
          values={values}
          value={selected}
          onChange={setSelected}
          label={text.wheel}
          format={formatValue}
          disabled={revealed}
        />
      </div>
      {PLAYERS.map((player, column) => (
        <PlayerColumn
          key={player.id}
          column={column}
          player={player}
          value={selected}
          entries={entries[player.id]}
          onSubmit={(v) => onSubmit(player.id, v)}
          onUndo={() => onUndo(player.id)}
          revealed={revealed}
          text={text}
          formatValue={formatValue}
          summarize={summarize}
        />
      ))}
      <span
        className={`col-span-3 row-start-2 flex h-7 items-end justify-center pb-1.5 font-stencil text-sm leading-none font-extrabold uppercase tracking-[0.04em] text-ink-muted short:h-5 short:pb-1 ${revealed ? LOCKED : 'opacity-70'}`}
      >
        {copy.lastRolls}
      </span>
    </Section>
  )
}

interface PlayerColumnProps
  extends Pick<RollTrackerProps, 'text' | 'formatValue' | 'summarize'> {
  /** 0 or 1: the ZSRR side (left of the wheel) or the USA side (right of it). */
  column: number
  player: Player
  /** The wheel's value, submitted by this player's button. */
  value: number
  entries: readonly number[]
  onSubmit: (value: number) => void
  onUndo: () => void
  revealed: boolean
}

const COLUMN = ['col-start-1', 'col-start-3']
/** How a locked part of the tracker shows once the game has ended. */
const LOCKED = 'opacity-20 grayscale'

function PlayerColumn({
  column,
  player,
  value,
  entries,
  onSubmit,
  onUndo,
  revealed,
  text,
  formatValue,
  summarize,
}: PlayerColumnProps) {
  const [cooling, startCooldown, cancelCooldown] = useCooldown(SUBMIT_COOLDOWN_MS)
  const [added, setAdded] = useState<number | null>(null)
  // What the last tap did, for screen readers.
  const [notice, setNotice] = useState('')

  const tone = TONE[player.id]
  const count = entries.length
  // Every entry counts towards the summary; the log only shows the newest few, oldest to newest (newest on the right).
  const latest = entries.map((v, i) => ({ v, i })).slice(-LOG_VISIBLE)

  const submit = () => {
    onSubmit(value)
    setAdded(value)
    setNotice(copy.added(formatValue(value)))
    startCooldown()
  }

  // A second tap before the cooldown runs out takes the roll back.
  const undo = () => {
    onUndo()
    if (added !== null) setNotice(copy.undone(formatValue(added)))
    cancelCooldown()
  }

  return (
    <>
      {/* As tall as the wheel, in thirds: the button sits level with the wheel's picked value, the name above it. */}
      <div
        className={`${COLUMN[column]} row-start-1 grid h-[calc(var(--wheel-row)*3)] min-w-0 grid-rows-[1fr_auto_1fr] justify-items-center self-center`}
      >
        {/* Name, label and value share one baseline; the row stays centred over the button. */}
        <div className="flex flex-wrap content-end items-baseline justify-center gap-x-2 self-end pb-1.5 short:pb-1 tiny:pb-0.5">
          <span className={`font-stencil text-base leading-none font-extrabold uppercase tracking-[0.04em] ${tone.text}`}>
            {player.label}
          </span>
          {revealed ? (
            <span className="flex items-baseline gap-1.5">
              <span className="font-condensed text-xs font-semibold uppercase tracking-[0.08em] text-ink">
                {text.result}
              </span>
              <output
                aria-label={text.resultFor(player.label)}
                className={`font-stencil text-3xl leading-none font-extrabold tabular-nums short:text-xl tiny:text-lg ${tone.text}`}
              >
                {summarize(entries)}
              </output>
            </span>
          ) : (
            <span className="font-mono text-xs text-ink-muted">{rolls(count)}</span>
          )}
        </div>
        <button
          type="button"
          aria-label={cooling ? text.undo(player.label) : text.submit(player.label)}
          data-cooling={cooling}
          onClick={cooling ? undo : submit}
          disabled={revealed}
          className={`relative flex h-(--wheel-item) w-(--wheel-width) shrink-0 items-center justify-center gap-1 overflow-hidden rounded-counter border-2 px-1 transition-colors ${tone.border} ${
            cooling ? tone.soft : `${tone.fill} ${revealed ? LOCKED : ''}`
          }`}
        >
          {cooling ? <UndoIcon className="size-4" /> : <CheckIcon className="size-6" />}
          {cooling && added !== null && (
            <span className="font-stencil text-xl leading-none font-extrabold tabular-nums">{formatValue(added)}</span>
          )}
          {cooling && (
            <span
              aria-hidden="true"
              style={{ animationDuration: `${SUBMIT_COOLDOWN_MS}ms` }}
              className={`absolute inset-x-0 bottom-0 h-1 origin-left animate-drain motion-reduce:hidden ${tone.bar}`}
            />
          )}
        </button>
        <span role="status" className="sr-only">
          {notice}
        </span>
      </div>
      {/* Once the game has ended the log is history: greyed out like the locked controls. */}
      <div
        className={`${COLUMN[column]} row-start-3 flex h-5 min-w-0 items-center justify-center whitespace-nowrap text-ink-muted transition-opacity ${revealed ? LOCKED : ''}`}
      >
        {count === 0 && <span className="font-mono text-xs opacity-70">{copy.noRolls}</span>}
        {/* Centred under the button. Too narrow for every value: the oldest is clipped on the left, the newest stays in view. */}
        <ol
          aria-label={text.log(player.label)}
          className="flex min-w-0 max-w-full justify-end gap-0.5 overflow-hidden font-mono text-xs leading-5"
        >
          {latest.map(({ v, i }) => {
            const isNew = cooling && i === count - 1
            return (
              // Keyed by position in the whole log, so each new entry mounts afresh and flashes,
              // even when it repeats the previous value.
              <li
                key={i}
                data-new={isNew}
                style={tone.flashVars as CSSProperties}
                className={`shrink-0 rounded-counter px-1 transition-opacity ${isNew ? 'animate-log-flash' : 'opacity-70'}`}
              >
                {formatValue(v)}
              </li>
            )
          })}
        </ol>
      </div>
    </>
  )
}

export function UndoIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="square"
      />
    </svg>
  )
}

function CheckIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M4.5 12.5l5 5 10-11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
    </svg>
  )
}
