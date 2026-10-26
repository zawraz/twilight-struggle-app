import { Undo2 } from 'lucide-react'
import { copy } from '../copy'
import { TOAST_MS, type Toast } from '../lib/useToast'

interface ToastBarProps {
  toast: (Toast & { id: number }) | null
  onDismiss: () => void
}

/** The latest action, laid over the header for a moment. Place it inside a `relative` header. */
export function ToastBar({ toast, onDismiss }: ToastBarProps) {
  // The live region stays mounted so screen readers hear each new toast; it lets taps through when empty.
  // It reaches past the app's padding to the screen's top and side edges, down to the header's bottom.
  return (
    <div
      role="status"
      className="pointer-events-none absolute -top-[max(8px,env(safe-area-inset-top))] right-[calc(50%-50vw)] bottom-0 left-[calc(50%-50vw)] z-10"
    >
      {toast && (
        <div
          key={toast.id}
          className="pointer-events-auto relative flex h-full items-center gap-2 overflow-hidden border-b-2 border-gold bg-surface-raised pt-[env(safe-area-inset-top)] pr-[max(12px,env(safe-area-inset-right))] pl-[max(12px,env(safe-area-inset-left))]"
        >
          <p className="min-w-0 flex-1 truncate font-condensed text-xs font-semibold uppercase tracking-[0.06em] text-gold-text">
            {toast.text}
          </p>
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                toast.undo?.()
                onDismiss()
              }}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-counter border-2 border-gold px-2 font-condensed text-xs font-semibold uppercase tracking-[0.08em] text-gold-text"
            >
              <Undo2 className="size-4" aria-hidden="true" />
              {copy.undo}
            </button>
          )}
          <span
            aria-hidden="true"
            style={{ animationDuration: `${TOAST_MS}ms` }}
            className="absolute inset-x-0 bottom-0 h-0.5 origin-left animate-drain bg-gold motion-reduce:hidden"
          />
        </div>
      )}
    </div>
  )
}
