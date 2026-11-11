import { useRef, type KeyboardEvent, type ReactNode } from 'react'

export interface Tab<Id extends string> {
  id: Id
  /** Not shown: names the icon for screen readers and as a tooltip. */
  label: string
  icon: ReactNode
  /** Greyed out and passed over, for a view with nothing to show. */
  disabled?: boolean
}

/**
 * Each size's height, width and border, and the outline that rings the selected tab as thick as the
 * border: a slim bar takes the thinnest border to leave its icons the room. Every tab draws its left
 * border, so the tabs stay divided even while none of them is selected.
 */
const SIZE = {
  slim: { height: 'h-6', width: 'w-18', border: 'border-y border-l last:border-r', ring: 'outline -outline-offset-1' },
  regular: { height: 'h-10', width: 'w-18', border: 'border-y-2 border-l-2 last:border-r-2', ring: 'outline-2 -outline-offset-2' },
  tall: { height: 'h-12.5', width: 'w-18', border: 'border-y-2 border-l-2 last:border-r-2', ring: 'outline-2 -outline-offset-2' },
  /** The header's views, tapped all game long: as tall as the header's other buttons. */
  header: {
    height: 'h-12',
    width: 'w-18',
    border: 'border-y-2 border-l-2 last:border-r-2',
    ring: 'outline-2 -outline-offset-2',
  },
} as const

interface TabBarProps<Id extends string> {
  tabs: readonly Tab<Id>[]
  /** Null while none of the tabs' views is up: a tap on any of them opens its own. */
  active: Id | null
  onSelect: (id: Id) => void
  /** Id prefix shared with the panels: tab `${idPrefix}-tab-${id}` controls `${idPrefix}-panel-${id}`. */
  idPrefix: string
  className?: string
  /** Stretches the tabs to share the bar's width. */
  stretch?: boolean
  /** Tall for a bar at the foot of the screen, slim for one that only shows where the swipes have got to, header for the header's. */
  size?: keyof typeof SIZE
}

/**
 * The header's views, as icons joined into one segmented pill. A tap anywhere on the pill moves on:
 * tapping the selected tab selects the next one, so with two tabs any tap toggles.
 * Arrow keys, Home and End move between tabs, as in any tablist; disabled tabs are passed over.
 */
export function TabBar<Id extends string>({
  tabs,
  active,
  onSelect,
  idPrefix,
  className = '',
  stretch = false,
  size = 'regular',
}: TabBarProps<Id>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const { height, width, border, ring } = SIZE[size]

  /** The nearest enabled tab `by` away from `index`, round the ends. */
  function step(index: number, by: 1 | -1) {
    let next = index
    do next = (next + by + tabs.length) % tabs.length
    while (tabs[next].disabled && next !== index)
    return next
  }

  function onKeyDown(event: KeyboardEvent, index: number) {
    const next = {
      ArrowRight: step(index, 1),
      ArrowLeft: step(index, -1),
      Home: step(tabs.length - 1, 1),
      End: step(0, -1),
    }[event.key]
    if (next === undefined) return
    event.preventDefault()
    onSelect(tabs[next].id)
    refs.current[next]?.focus()
  }

  return (
    <div role="tablist" className={`flex ${className}`}>
      {tabs.map((tab, index) => {
        const selected = tab.id === active
        // Beside the selected tab its outline is the edge: the divider there would show beside it.
        const afterSelected = index > 0 && tabs[index - 1].id === active
        // Outlined, not filled: a tab has no right border of its own (the next tab's left one divides
        // them), so the selected one is ringed by an outline drawn over its edge, all the way round.
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[index] = el
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.id}`}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            aria-label={tab.label}
            title={tab.label}
            aria-selected={selected}
            tabIndex={selected || (active === null && index === 0) ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => onSelect(selected ? tabs[step(index, 1)].id : tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`flex ${height} items-center justify-center gap-1 ${border} ${stretch ? 'flex-1' : width} transition-colors first:rounded-l-counter last:rounded-r-counter disabled:opacity-30 ${
              selected ? `border-gold bg-surface-sunken text-gold-text ${ring} outline-gold` : 'border-line bg-surface-sunken text-ink-muted'
            } ${afterSelected ? 'border-l-transparent' : ''}`}
          >
            {tab.icon}
          </button>
        )
      })}
    </div>
  )
}
