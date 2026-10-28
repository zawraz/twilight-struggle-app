import { useId, type ReactNode } from 'react'

interface SectionProps {
  title: string
  children: ReactNode
  className?: string
  /** Extra classes for the two-column body grid. */
  bodyClassName?: string
}

export function Section({ title, children, className = '', bodyClassName = '' }: SectionProps) {
  const headingId = useId()
  return (
    <section
      aria-labelledby={headingId}
      className={`flex min-h-0 flex-col gap-2 rounded-card border border-line bg-surface-raised p-3 tiny:gap-1 tiny:p-2 ${className}`}
    >
      <h2 id={headingId} className="text-center font-condensed text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
        {title}
      </h2>
      <div className={`grid min-h-0 flex-1 grid-cols-2 gap-3 ${bodyClassName}`}>{children}</div>
    </section>
  )
}
