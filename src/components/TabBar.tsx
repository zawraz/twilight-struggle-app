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
}

/** The header's views, as icons. Arrow keys, Home and End move between tabs, as in any tablist. */
export function TabBar<Id extends string>({ tabs, active, onSelect, idPrefix, className = '' }: TabBarProps<Id>) {
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
            onClick={() => onSelect(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`grid size-8 place-items-center rounded-counter border-2 transition-colors ${
              selected ? 'border-gold text-ink' : 'border-transparent text-ink-muted'
            }`}
          >
            {tab.icon}
          </button>
        )
      })}
    </div>
  )
}
