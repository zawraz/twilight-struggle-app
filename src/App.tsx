import { NotebookText, PlayingCardsFan } from 'lucide-react'
import { useState } from 'react'
import { CardsPanel } from './components/CardsPanel'
import { GameAction } from './components/GameAction'
import { LastActionBar } from './components/LastActionBar'
import { OpsCounter } from './components/OpsCounter'
import { RoomButton } from './components/RoomButton'
import { RollTracker } from './components/RollTracker'
import { Section } from './components/Section'
import { TabBar } from './components/TabBar'
import { ToastBar } from './components/ToastBar'
import { copy } from './copy'
import { PLAYERS } from './lib/players'
import { canUndo } from './lib/room'
import { average, formatAverage, formatSigned, sum } from './lib/stats'
import { useMyHand } from './lib/useMyHand'
import { useRoom } from './lib/useRoom'
import { useToast } from './lib/useToast'
import { useWakeLock } from './lib/useWakeLock'

// −5…+5 without 0, highest on top.
export const SUCCESS_VALUES = [5, 4, 3, 2, 1, -1, -2, -3, -4, -5] as const
// 6…1, highest on top like the success wheel.
export const DIE_VALUES = [6, 5, 4, 3, 2, 1] as const

const TABS = [
  { id: 'cards', label: copy.tabs.cards, icon: <PlayingCardsFan className="size-6" aria-hidden="true" /> },
  { id: 'log', label: copy.tabs.log, icon: <NotebookText className="size-6" aria-hidden="true" /> },
] as const
type TabId = (typeof TABS)[number]['id']
const TAB_ID = 'view'

export default function App() {
  // Shared with every device in the same room when the app has a sync server.
  const { game, dispatch, cards, dispatchCards, moves, act, sync } = useRoom()
  const [tab, setTab] = useState<TabId>('log')
  const [toast, showToast, dismissToast] = useToast()
  // Kept here, not in the Karty tab, so New Game can clear it.
  const myHand = useMyHand(cards)
  useWakeLock()
  // Both panels stay mounted, so a wheel's pick and a pending undo survive a tab switch.
  const panel = (id: TabId) => ({
    role: 'tabpanel',
    id: `${TAB_ID}-panel-${id}`,
    'aria-labelledby': `${TAB_ID}-tab-${id}`,
    hidden: tab !== id,
  })

  return (
    <div className="mx-auto grid h-full max-w-3xl grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr] gap-2 py-[max(8px,env(safe-area-inset-top))] pr-[max(8px,env(safe-area-inset-right))] pb-[max(8px,env(safe-area-inset-bottom))] pl-[max(8px,env(safe-area-inset-left))]">
      <header className="flex min-w-0 flex-col gap-1.5">
        {/* The toast lies over the title row and the Iron Curtain, leaving the last action in view. */}
        <div className="relative flex flex-col gap-1.5">
          <div className="flex items-center gap-2 max-[390px]:gap-1.5">
            <GameAction
              ended={game.ended}
              // Ending shows the results in the log; a new game starts at the deck.
              onEnd={() => {
                dispatch({ type: 'end' })
                setTab('log')
              }}
              onNewGame={() => {
                dispatch({ type: 'newGame' })
                dispatchCards({ type: 'newGame' })
                myHand.clear()
                dismissToast()
                setTab('cards')
              }}
            />
            <h1 className="shrink-0 font-stencil text-2xl leading-none font-extrabold tracking-[0.01em] text-ink max-[480px]:text-xl max-[400px]:text-base">
              {copy.appTitle}
            </h1>
            {sync && <RoomButton sync={sync} notify={showToast} />}
            {/* The view tabs take the rest of the row: the most tapped buttons, made the widest. */}
            <TabBar tabs={TABS} active={tab} onSelect={setTab} idPrefix={TAB_ID} size="header" stretch className="min-w-24 flex-1" />
          </div>
          {/* The Iron Curtain: USSR and US halves with a gap of ground between them. */}
          <div aria-hidden="true" className="flex h-1 gap-1">
            <span className="flex-1 rounded-counter bg-ussr" />
            <span className="flex-1 rounded-counter bg-us" />
          </div>
          <ToastBar toast={toast} onDismiss={dismissToast} />
        </div>
        <LastActionBar last={moves.at(-1) ?? null} undoable={canUndo({ game, moves })} onUndo={() => act({ target: 'undoLast' })} />
      </header>

      <main className="grid min-h-0">
        <div
          {...panel('log')}
          className="grid min-h-0 grid-rows-3 gap-2"
        >
          <Section title={copy.fourOps.title} balanced>
            {PLAYERS.map((player) => (
              <OpsCounter
                key={player.id}
                player={player}
                count={game.fourOps[player.id]}
                locked={game.ended}
                onIncrement={() => dispatch({ type: 'incrementFourOps', player: player.id })}
                onDecrement={() => dispatch({ type: 'decrementFourOps', player: player.id })}
              />
            ))}
          </Section>
          <RollTracker
            text={copy.success}
            values={SUCCESS_VALUES}
            initialValue={1}
            formatValue={formatSigned}
            summarize={(values) => formatSigned(sum(values))}
            entries={game.rolls.success}
            onSubmit={(player, value) => dispatch({ type: 'addRoll', track: 'success', player, value })}
            onUndo={(player) => dispatch({ type: 'undoRoll', track: 'success', player })}
            revealed={game.ended}
          />
          <RollTracker
            text={copy.dice}
            values={DIE_VALUES}
            initialValue={4}
            formatValue={String}
            summarize={(values) => formatAverage(average(values))}
            entries={game.rolls.dice}
            onSubmit={(player, value) => dispatch({ type: 'addRoll', track: 'dice', player, value })}
            onUndo={(player) => dispatch({ type: 'undoRoll', track: 'dice', player })}
            revealed={game.ended}
          />
        </div>
        <div {...panel('cards')} className="grid min-h-0">
          <CardsPanel
            cards={cards}
            dispatch={dispatchCards}
            act={act}
            notify={showToast}
            onToastStale={dismissToast}
            countsFourOps={!game.ended}
            myHand={myHand}
          />
        </div>
      </main>
    </div>
  )
}
