import { CloudOff, Users, X } from 'lucide-react'
import { useState } from 'react'
import { copy } from '../copy'
import type { OnlineGame } from '../lib/syncServer'
import { useConfirmTap } from '../lib/useConfirmTap'
import { useOnlineGame } from '../lib/useOnlineGame'
import type { RoomSync } from '../lib/useRoom'
import type { Toast } from '../lib/useToast'
import { ConfirmCaption } from './ConfirmCaption'

interface SyncButtonProps {
  sync: RoomSync
  notify: (toast: Toast) => void
}

const LABEL = 'font-condensed text-xs font-semibold uppercase tracking-[0.08em]'
const ACTION = `flex h-10 items-center justify-center gap-1.5 rounded-counter border-2 px-3 ${LABEL}`

/**
 * The people icon: whether this phone shares the online game. Offline, its panel looks for the
 * online game and offers to join it; online, it shows the connection and turns sync off.
 * A cloud mark on the icon says an online phone has lost the server.
 */
export function SyncButton({ sync, notify }: SyncButtonProps) {
  const [open, setOpen] = useState(false)
  const online = sync.mode === 'online'
  const close = () => setOpen(false)

  return (
    <>
      <button
        type="button"
        aria-label={copy.sync.open}
        title={copy.sync.open}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`relative grid h-12 w-13 shrink-0 place-items-center max-[390px]:w-11 rounded-counter border-2 transition-colors ${
          open ? 'border-gold bg-gold text-on-gold' : online ? 'border-gold bg-surface-sunken text-gold-text' : 'border-line bg-surface-sunken text-ink-muted'
        }`}
      >
        <Users className="size-6" aria-hidden="true" />
        {online && !sync.connected && (
          <CloudOff
            data-testid="sync-offline-mark"
            className="absolute -right-1.5 -bottom-1.5 size-4 rounded-full bg-surface p-0.5 text-danger"
            aria-hidden="true"
          />
        )}
      </button>
      {open && (
        <>
          {/* Taps outside the panel close it. */}
          <button type="button" aria-label={copy.sync.close} tabIndex={-1} onClick={close} className="fixed inset-0 z-20 cursor-default" />
          <div
            role="dialog"
            aria-label={copy.sync.title}
            className="absolute top-full right-0 z-30 mt-1 flex w-72 max-w-full flex-col gap-3 rounded-counter border-2 border-line-strong bg-surface-raised p-3 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h2 className={`${LABEL} text-ink-muted`}>{copy.sync.title}</h2>
              <button type="button" aria-label={copy.sync.close} onClick={close} className="grid size-8 place-items-center text-ink-muted">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <p className={`${LABEL} ${online ? 'text-gold-text' : 'text-ink-muted'}`}>{online ? copy.sync.online : copy.sync.offline}</p>
            {online ? (
              <OnlineBody
                sync={sync}
                onLeave={() => {
                  sync.leave()
                  close()
                  notify({ text: copy.sync.left })
                }}
              />
            ) : (
              <OfflineBody
                sync={sync}
                onJoin={(game) => {
                  sync.join(game)
                  close()
                  notify({ text: copy.sync.joined })
                }}
              />
            )}
          </div>
        </>
      )}
    </>
  )
}

function OnlineBody({ sync, onLeave }: { sync: RoomSync; onLeave: () => void }) {
  const status = sync.missing
    ? copy.sync.missing
    : !sync.connected
      ? copy.sync.disconnected
      : !sync.live
        ? copy.sync.loading
        : copy.sync.connected
  const trouble = sync.missing || !sync.connected
  return (
    <>
      <p role="status" className={`text-sm ${trouble ? 'text-danger' : 'text-ink-muted'}`}>
        {status}
      </p>
      <button type="button" onClick={onLeave} className={`${ACTION} border-line-strong text-ink`}>
        {copy.sync.leave}
      </button>
    </>
  )
}

/** Only mounted while the panel is open, so an offline phone looks at the server only then. */
function OfflineBody({ sync, onJoin }: { sync: RoomSync; onJoin: (game: OnlineGame) => void }) {
  const check = useOnlineGame(sync.server, true)
  switch (check.status) {
    case 'checking':
      return <p role="status" className="text-sm text-ink-muted">{copy.sync.checking}</p>
    case 'none':
      return <p role="status" className="text-sm text-ink-muted">{copy.sync.none}</p>
    case 'unreachable':
      return <p role="status" className="text-sm text-danger">{copy.sync.unreachable}</p>
    case 'found':
      // An ended game has nothing left to play: no way in, only the way to a new one.
      if (check.game.state.game.ended) {
        return <p role="status" className="text-sm text-ink-muted">{copy.sync.ended(check.game.state.cards.turn)}</p>
      }
      return <Found game={check.game} onJoin={onJoin} />
  }
}

function Found({ game, onJoin }: { game: OnlineGame; onJoin: (game: OnlineGame) => void }) {
  // The second tap joins the game as it is then, not as it was at the first.
  const { armed, tap } = useConfirmTap(() => onJoin(game))
  const minutes = Math.max(0, Math.floor((Date.now() - game.updatedAt) / 60_000))
  return (
    <>
      <p role="status" className="text-sm text-ink">
        {copy.sync.found(game.state.cards.turn, copy.sync.ago(minutes))}
      </p>
      <p className="text-sm text-danger">{copy.sync.joinWarning}</p>
      <div className="relative">
        {armed && <ConfirmCaption />}
        <button
          type="button"
          data-armed={armed}
          onClick={tap}
          className={`${ACTION} w-full ${armed ? 'border-danger bg-danger text-surface' : 'border-gold bg-gold text-on-gold'}`}
        >
          {copy.sync.join}
        </button>
      </div>
    </>
  )
}
