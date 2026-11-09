import { CloudOff, Share2, Users, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { copy } from '../copy'
import { CODE_LENGTH } from '../lib/room'
import { roomLink, type RoomSync } from '../lib/useRoom'
import type { Toast } from '../lib/useToast'

interface RoomButtonProps {
  sync: RoomSync
  notify: (toast: Toast) => void
}

const LABEL = 'font-condensed text-xs font-semibold uppercase tracking-[0.08em]'
const ACTION = `flex h-10 items-center justify-center gap-1.5 rounded-counter border-2 px-3 ${LABEL}`

/**
 * The shared game: a header button opening a panel with this room's code and link, and a way
 * to join another room. A cloud mark on the button says the server is out of reach.
 */
export function RoomButton({ sync, notify }: RoomButtonProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [invalid, setInvalid] = useState(false)
  const status = !sync.connected ? copy.room.offline : sync.live ? copy.room.connected : copy.room.loading

  async function share() {
    const url = roomLink(sync.code)
    try {
      if (navigator.share) {
        await navigator.share({ title: copy.room.shareTitle, url })
        return
      }
      await navigator.clipboard.writeText(url)
      notify({ text: copy.room.copied })
    } catch {
      // Share sheet dismissed, or the clipboard refused: the code stays on screen to read out.
    }
  }

  function join(event: FormEvent) {
    event.preventDefault()
    if (!sync.join(input)) {
      setInvalid(true)
      return
    }
    notify({ text: copy.room.joined(input.trim().toUpperCase()) })
    setInput('')
    setInvalid(false)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        aria-label={copy.room.open}
        title={copy.room.open}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`relative grid h-12 w-13 shrink-0 place-items-center max-[390px]:w-11 rounded-counter border-2 transition-colors short-landscape:size-10 ${
          open ? 'border-gold bg-gold text-on-gold' : 'border-line bg-surface-sunken text-ink-muted'
        }`}
      >
        <Users className="size-6" aria-hidden="true" />
        {!sync.connected && (
          <CloudOff className="absolute -right-1.5 -bottom-1.5 size-4 rounded-full bg-surface p-0.5 text-danger" aria-hidden="true" />
        )}
      </button>
      {open && (
        <>
          {/* Taps outside the panel close it. */}
          <button type="button" aria-label={copy.room.close} tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-20 cursor-default" />
          <div
            role="dialog"
            aria-label={copy.room.title}
            className="absolute top-full right-0 z-30 mt-1 flex w-72 max-w-full flex-col gap-3 rounded-counter border-2 border-line-strong bg-surface-raised p-3 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h2 className={`${LABEL} text-ink-muted`}>{copy.room.title}</h2>
              <button type="button" aria-label={copy.room.close} onClick={() => setOpen(false)} className="grid size-8 place-items-center text-ink-muted">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div>
              <p className={`${LABEL} text-ink-muted`}>{copy.room.code}</p>
              <p className="font-mono text-3xl tracking-[0.2em] text-ink">{sync.code}</p>
              <p className="mt-1 text-sm text-ink-muted">{copy.room.hint}</p>
            </div>
            <button type="button" onClick={share} className={`${ACTION} border-gold bg-gold text-on-gold`}>
              <Share2 className="size-4" aria-hidden="true" />
              {copy.room.share}
            </button>
            <p role="status" className={`text-sm ${sync.connected ? 'text-ink-muted' : 'text-danger'}`}>
              {status}
            </p>
            <form onSubmit={join} className="flex flex-col gap-1 border-t-2 border-line pt-3">
              <label htmlFor="room-code" className={`${LABEL} text-ink-muted`}>
                {copy.room.joinLabel}
              </label>
              <div className="flex gap-2">
                <input
                  id="room-code"
                  value={input}
                  onChange={(event) => {
                    setInput(event.target.value)
                    setInvalid(false)
                  }}
                  maxLength={CODE_LENGTH}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={invalid}
                  aria-describedby={invalid ? 'room-code-error' : undefined}
                  className="h-10 min-w-0 flex-1 rounded-counter border-2 border-line bg-surface-sunken px-2 font-mono text-lg uppercase tracking-[0.2em] text-ink"
                />
                <button type="submit" className={`${ACTION} border-line-strong text-ink`}>
                  {copy.room.join}
                </button>
              </div>
              {invalid && (
                <p id="room-code-error" className="text-sm text-danger">
                  {copy.room.badCode}
                </p>
              )}
            </form>
          </div>
        </>
      )}
    </>
  )
}
