import { useId, type ReactNode } from 'react'

interface SectionProps {
  title: string
  children: ReactNode
  className?: string
  /** The body grid's columns: two, one per player, unless given. */
  columnsClassName?: string
  /** Extra classes for the body grid. */
  bodyClassName?: string
  /** Centre the body in the whole card, not just under the title: a title-high gap balances it below. */
  balanced?: boolean
}

const TITLE = 'font-stencil text-lg leading-none font-extrabold uppercase tracking-[0.04em]'

export function Section({
  title,
  children,
  className = '',
  columnsClassName = 'grid-cols-2',
  bodyClassName = '',
  balanced = false,
}: SectionProps) {
  const headingId = useId()
  return (
    <section
      aria-labelledby={headingId}
      className={`flex min-h-0 flex-col gap-2 rounded-card border border-line bg-surface-raised p-3 tiny:gap-1 tiny:p-2 ${className}`}
    >
      <h2 id={headingId} className={`text-center text-ink-muted ${TITLE}`}>
        {title}
      </h2>
      <div className={`grid min-h-0 flex-1 ${columnsClassName} gap-3 ${bodyClassName}`}>{children}</div>
      {balanced && <div aria-hidden="true" className={`h-[1lh] shrink-0 short-landscape:hidden ${TITLE}`} />}
    </section>
  )
}
