import { useRef, type KeyboardEvent, type ReactNode } from 'react'

export interface Tab<Id extends string> {
  id: Id
  /** Not shown: names the icon for screen readers and as a tooltip. */
  label: string
  icon: ReactNode
}

interface TabBarProps<Id extends string> {
  tabs: readonly Tab<Id>[]
  active: Id
  onSelect: (id: Id) => void
  /** Id prefix shared with the panels: tab `${idPrefix}-tab-${id}` controls `${idPrefix}-panel-${id}`. */
  idPrefix: string
  className?: string
  /** Stretches the tabs to share the bar's width. */
  stretch?: boolean
}

/**
 * The header's views, as icons joined into one segmented pill. A tap anywhere on the pill moves on:
 * tapping the selected tab selects the next one, so with two tabs any tap toggles.
 * Arrow keys, Home and End move between tabs, as in any tablist.
 */
export function TabBar<Id extends string>({
  tabs,
  active,
  onSelect,
  idPrefix,
  className = '',
  stretch = false,
}: TabBarProps<Id>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(event: KeyboardEvent, index: number) {
    const last = tabs.length - 1
    const next = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
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
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(selected ? tabs[(index + 1) % tabs.length].id : tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`flex h-10 items-center justify-center gap-1 border-y-2 ${stretch ? 'flex-1' : 'w-18'} transition-colors first:rounded-l-counter first:border-l-2 last:rounded-r-counter last:border-r-2 ${
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
