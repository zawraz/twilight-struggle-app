import { copy } from '../copy'

const PLACEMENT = {
  above: 'bottom-full left-1/2 mb-0.5 -translate-x-1/2',
  // Beside a header control the caption can sit over the title, so it gets its own ground.
  right: 'left-full top-1/2 ml-1 -translate-y-1/2 rounded-counter bg-surface px-1.5 py-0.5',
} as const

/** The small red "Potwierdź?" shown beside an armed control. Place it inside a `relative` wrapper. */
export function ConfirmCaption({ placement = 'above' }: { placement?: keyof typeof PLACEMENT }) {
  return (
    <span
      role="alert"
      className={`pointer-events-none absolute whitespace-nowrap font-condensed text-[11px] font-semibold uppercase tracking-[0.06em] text-danger ${PLACEMENT[placement]}`}
    >
      {copy.confirmQuestion}
    </span>
  )
}
