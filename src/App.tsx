import { NotebookText, PlayingCardsFan } from 'lucide-react'
import { useState } from 'react'
import { CardsPanel } from './components/CardsPanel'
import { GameAction } from './components/GameAction'
import { OpsCounter } from './components/OpsCounter'
import { RollTracker } from './components/RollTracker'
import { Section } from './components/Section'
import { TabBar } from './components/TabBar'
import { ToastBar } from './components/ToastBar'
import { copy } from './copy'
import { PLAYERS } from './lib/players'
import { average, formatAverage, formatSigned, sum } from './lib/stats'
import { useCards } from './lib/useCards'
import { useGame } from './lib/useGame'
import { useToast } from './lib/useToast'

// −5…+5 without 0, highest on top.
export const SUCCESS_VALUES = [5, 4, 3, 2, 1, -1, -2, -3, -4, -5] as const
// 6…1, highest on top like the success wheel.
export const DIE_VALUES = [6, 5, 4, 3, 2, 1] as const

const TABS = [
  { id: 'cards', label: copy.tabs.cards, icon: <PlayingCardsFan className="size-5" aria-hidden="true" /> },
  { id: 'log', label: copy.tabs.log, icon: <NotebookText className="size-5" aria-hidden="true" /> },
] as const
type TabId = (typeof TABS)[number]['id']
const TAB_ID = 'view'

export default function App() {
  const [game, dispatch] = useGame()
  const [cards, dispatchCards] = useCards()
  const [tab, setTab] = useState<TabId>('log')
  const [toast, showToast, dismissToast] = useToast()
  // Both panels stay mounted, so a wheel's pick and a pending undo survive a tab switch.
  const panel = (id: TabId) => ({
    role: 'tabpanel',
    id: `${TAB_ID}-panel-${id}`,
    'aria-labelledby': `${TAB_ID}-tab-${id}`,
    hidden: tab !== id,
  })

  return (
    <div className="mx-auto grid h-full max-w-3xl grid-rows-[auto_1fr] gap-2 py-[max(8px,env(safe-area-inset-top))] pr-[max(8px,env(safe-area-inset-right))] pb-[max(8px,env(safe-area-inset-bottom))] pl-[max(8px,env(safe-area-inset-left))] short-landscape:max-w-none short-landscape:gap-1">
      <header className="relative flex flex-col gap-1.5 short-landscape:gap-1">
        <div className="flex items-center gap-2 px-1">
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
              dismissToast()
              setTab('cards')
            }}
          />
          <h1 className="min-w-0 font-stencil text-2xl leading-none font-extrabold tracking-[0.01em] text-ink max-[380px]:text-xl short-landscape:text-lg">
            {copy.appTitle}
          </h1>
          <TabBar tabs={TABS} active={tab} onSelect={setTab} idPrefix={TAB_ID} className="ml-auto" />
        </div>
        {/* The Iron Curtain: USSR and US halves with a gap of ground between them. */}
        <div aria-hidden="true" className="flex h-1 gap-1 short-landscape:hidden">
          <span className="flex-1 rounded-counter bg-ussr" />
          <span className="flex-1 rounded-counter bg-us" />
        </div>
        <ToastBar toast={toast} onDismiss={dismissToast} />
      </header>

      <main className="grid min-h-0">
        <div
          {...panel('log')}
          className="grid min-h-0 grid-rows-3 gap-2 short-landscape:grid-cols-2 short-landscape:grid-rows-[auto_1fr] short-landscape:gap-1"
        >
          <Section title={copy.fourOps.title} className="short-landscape:col-span-2" balanced>
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
            notify={showToast}
            onToastStale={dismissToast}
            onFourOps={
              game.ended
                ? null
                : (player, by) => dispatch({ type: by > 0 ? 'incrementFourOps' : 'decrementFourOps', player })
            }
          />
        </div>
      </main>
    </div>
  )
}
