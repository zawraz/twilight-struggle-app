import { useState, type CSSProperties } from 'react'
import { copy, rolls, type TrackerCopy } from '../copy'
import { PLAYERS, type PerPlayer, type Player, type PlayerId } from '../lib/players'
import { rest, TAP_LOCK_MS, useCooldown } from '../lib/useCooldown'
import { Section } from './Section'
import { WheelPicker } from './WheelPicker'
import { TONE } from './tone'

/** How many of the newest entries the log shows. */
export const LOG_VISIBLE = 3

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
  /** No game is running (ended, or none started yet): no more entries are taken, the controls greyed out. */
  stopped: boolean
  /** The game has ended with something recorded: summaries are shown in the buttons' place. Implies stopped. */
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
  stopped,
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
          disabled={stopped}
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
          stopped={stopped}
          revealed={revealed}
          text={text}
          formatValue={formatValue}
          summarize={summarize}
        />
      ))}
      <span
        className={`col-span-3 row-start-2 flex h-7 items-end justify-center pb-1.5 font-stencil text-sm leading-none font-extrabold uppercase tracking-[0.04em] text-ink-muted short:h-5 short:pb-1 ${stopped ? LOCKED : 'opacity-70'}`}
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
  stopped: boolean
  revealed: boolean
}

const COLUMN = ['col-start-1', 'col-start-3']
/** How a locked part of the tracker shows while no game is running. */
const LOCKED = 'opacity-20 grayscale'

function PlayerColumn({
  column,
  player,
  value,
  entries,
  onSubmit,
  stopped,
  revealed,
  text,
  formatValue,
  summarize,
}: PlayerColumnProps) {
  // Just submitted: the button rests for a moment, so a double tap doesn't log the roll twice. The
  // new entry's flash runs on the same clock, fading out just as the button comes back.
  const [resting, startRest] = useCooldown(TAP_LOCK_MS)
  // What the last tap did, for screen readers.
  const [notice, setNotice] = useState('')

  const tone = TONE[player.id]
  const count = entries.length
  // Every entry counts towards the summary; the log only shows the newest few, oldest to newest (newest on the right).
  const latest = entries.map((v, i) => ({ v, i })).slice(-LOG_VISIBLE)

  const submit = () => {
    onSubmit(value)
    setNotice(copy.added(formatValue(value)))
    startRest()
  }

  return (
    <>
      {/* As tall as the wheel, in thirds: the button sits level with the wheel's picked value, the name above it. */}
      <div
        className={`${COLUMN[column]} row-start-1 grid h-[calc(var(--wheel-row)*3)] min-w-0 grid-rows-[1fr_auto_1fr] justify-items-center self-center`}
      >
        {/* Centred over the button: the name, and under it the roll count; once the game has ended the result's label
            takes the count's place. The second line keeps one height, so nothing moves on End. */}
        <div className="flex flex-col items-center gap-1 self-end pb-1.5 short:pb-1 tiny:pb-0.5">
          <span className={`font-stencil text-base leading-none font-extrabold uppercase tracking-[0.04em] ${tone.text}`}>
            {player.label}
          </span>
          {revealed ? (
            <span className="h-5 font-stencil text-sm leading-5 font-extrabold uppercase tracking-[0.04em] text-ink">
              {text.result}
            </span>
          ) : (
            <span className="h-5 font-mono text-xs leading-5 text-ink-muted">{rolls(count)}</span>
          )}
        </div>
        {/* Once the game has ended no more rolls are taken: the result stands in the button's place, as large. */}
        {revealed ? (
          <output
            aria-label={text.resultFor(player.label)}
            className={`flex h-(--wheel-item) items-center justify-center font-stencil text-[length:calc(var(--wheel-item)*0.8)] leading-none font-extrabold tabular-nums whitespace-nowrap ${tone.text}`}
          >
            {summarize(entries)}
          </output>
        ) : (
          <button
            type="button"
            aria-label={text.submit(player.label)}
            onClick={submit}
            // With no game running it stays greyed out like the wheel; otherwise it only rests after a tap.
            disabled={stopped || resting}
            style={rest(resting && !stopped).style}
            className={`flex h-(--wheel-item) w-(--wheel-width) shrink-0 items-center justify-center rounded-counter border-2 px-1 transition-colors ${stopped ? LOCKED : 'disabled:opacity-40'} ${tone.border} ${tone.fill} ${rest(resting && !stopped).className}`}
          >
            <CheckIcon className="size-6" />
          </button>
        )}
        <span role="status" className="sr-only">
          {notice}
        </span>
      </div>
      {/* With no game running the log is history: greyed out like the locked controls. */}
      <div
        className={`${COLUMN[column]} row-start-3 flex h-5 min-w-0 items-center justify-center whitespace-nowrap text-ink-muted transition-opacity ${stopped ? LOCKED : ''}`}
      >
        {count === 0 && <span className="font-mono text-xs opacity-70">{copy.noRolls}</span>}
        {/* Centred under the button. Too narrow for every value: the oldest is clipped on the left, the newest stays in view. */}
        <ol
          aria-label={text.log(player.label)}
          className="flex min-w-0 max-w-full justify-end gap-0.5 overflow-hidden font-mono text-xs leading-5"
        >
          {latest.map(({ v, i }) => {
            const isNew = resting && i === count - 1
            return (
              // Keyed by position in the whole log, so each new entry mounts afresh and flashes,
              // even when it repeats the previous value.
              <li
                key={i}
                data-new={isNew}
                style={{ ...tone.flashVars, animationDuration: `${TAP_LOCK_MS}ms` } as CSSProperties}
                className={`shrink-0 rounded-counter px-1 opacity-70 ${isNew ? 'animate-log-flash' : ''}`}
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

function CheckIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M4.5 12.5l5 5 10-11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
    </svg>
  )
}
