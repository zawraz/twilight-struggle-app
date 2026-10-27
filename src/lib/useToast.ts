import { useEffect, useRef, useState } from 'react'

/** How long a toast stays over the header. */
export const TOAST_MS = 5000

export interface Toast {
  text: string
  /** Takes the action back; a toast without it has no undo button. */
  undo?: () => void
}

/** The latest toast, shown for `TOAST_MS`; a new one replaces it and restarts the timer. */
export function useToast() {
  const [toast, setToast] = useState<(Toast & { id: number }) | null>(null)
  const nextId = useRef(0)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  const show = (next: Toast) => setToast({ ...next, id: nextId.current++ })
  const dismiss = () => setToast(null)

  return [toast, show, dismiss] as const
}
