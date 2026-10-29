import { useRef, type KeyboardEvent, type ReactNode } from 'react'

export interface Tab<Id extends string> {
  id: Id
  /** Not shown: names the icon for screen readers and as a tooltip. */
  label: string
  icon: ReactNode
  /** Greyed out and passed over, for a view with nothing to show. */
  disabled?: boolean
}

/** Each size's height and border: a slim bar takes the thinnest border to leave its icons the room. */
const SIZE = {
  slim: { height: 'h-6', border: 'border-y first:border-l last:border-r' },
  regular: { height: 'h-10', border: 'border-y-2 first:border-l-2 last:border-r-2' },
  tall: { height: 'h-12.5', border: 'border-y-2 first:border-l-2 last:border-r-2' },
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
  /** Tall for a bar at the foot of the screen, slim for one that only shows where the swipes have got to. */
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
  const { height, border } = SIZE[size]

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
            className={`flex ${height} items-center justify-center gap-1 ${border} ${stretch ? 'flex-1' : 'w-18'} transition-colors first:rounded-l-counter last:rounded-r-counter disabled:opacity-30 ${
              selected ? 'border-gold bg-gold text-on-gold' : 'border-line bg-surface-sunken text-ink-muted'
            }`}
          >
            {tab.icon}
          </button>
        )
      })}
    </div>
  )
}
