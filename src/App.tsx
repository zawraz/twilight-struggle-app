import { NotebookText, PlayingCardsFan } from 'lucide-react'
import { useState } from 'react'
import { CardsPanel } from './components/CardsPanel'
import { GameAction } from './components/GameAction'
import { OpsCounter } from './components/OpsCounter'
import { RollTracker } from './components/RollTracker'
import { Section } from './components/Section'
import { TabBar } from './components/TabBar'
import { copy } from './copy'
import { PLAYERS } from './lib/players'
import { average, formatAverage, formatSigned, sum } from './lib/stats'
import { useCards } from './lib/useCards'
import { useGame } from './lib/useGame'

// −5…+5 without 0, highest on top.
export const SUCCESS_VALUES = [5, 4, 3, 2, 1, -1, -2, -3, -4, -5] as const
export const DIE_VALUES = [1, 2, 3, 4, 5, 6] as const

const TABS = [
  { id: 'log', label: copy.tabs.log, icon: <NotebookText className="size-5" aria-hidden="true" /> },
  { id: 'cards', label: copy.tabs.cards, icon: <PlayingCardsFan className="size-5" aria-hidden="true" /> },
] as const
type TabId = (typeof TABS)[number]['id']
const TAB_ID = 'view'

export default function App() {
  const [game, dispatch] = useGame()
  const [cards, dispatchCards] = useCards()
  const [tab, setTab] = useState<TabId>('log')
  // Both panels stay mounted, so a wheel's pick and a pending undo survive a tab switch.
  const panel = (id: TabId) => ({
    role: 'tabpanel',
    id: `${TAB_ID}-panel-${id}`,
    'aria-labelledby': `${TAB_ID}-tab-${id}`,
    hidden: tab !== id,
  })

  return (
    <div className="mx-auto grid h-full max-w-3xl grid-rows-[auto_1fr] gap-2 py-[max(8px,env(safe-area-inset-top))] pr-[max(8px,env(safe-area-inset-right))] pb-[max(8px,env(safe-area-inset-bottom))] pl-[max(8px,env(safe-area-inset-left))] short-landscape:max-w-none short-landscape:gap-1">
      <header className="flex flex-col gap-1.5 short-landscape:gap-1">
        <div className="flex items-center px-1">
          <h1 className="min-w-0 font-stencil text-2xl leading-none font-extrabold tracking-[0.01em] text-ink max-[380px]:text-xl short-landscape:text-lg">
            {copy.appTitle}
          </h1>
          {/* Auto margins centre the pill between the title and the action. */}
          <TabBar tabs={TABS} active={tab} onSelect={setTab} idPrefix={TAB_ID} className="mx-auto px-2" />
          <GameAction
            ended={game.ended}
            onEnd={() => dispatch({ type: 'end' })}
            onNewGame={() => {
              dispatch({ type: 'newGame' })
              dispatchCards({ type: 'newGame' })
            }}
          />
        </div>
        {/* The Iron Curtain: USSR and US halves with a gap of ground between them. */}
        <div aria-hidden="true" className="flex h-1 gap-1 short-landscape:hidden">
          <span className="flex-1 rounded-counter bg-ussr" />
          <span className="flex-1 rounded-counter bg-us" />
        </div>
      </header>

      <main className="grid min-h-0">
        <div
          {...panel('log')}
          className="grid min-h-0 grid-rows-[auto_1fr_1fr] gap-2 short-landscape:grid-cols-2 short-landscape:grid-rows-[auto_1fr] short-landscape:gap-1"
        >
          <Section title={copy.fourOps.title} className="short-landscape:col-span-2">
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
            initialValue={1}
            formatValue={String}
            summarize={(values) => formatAverage(average(values))}
            entries={game.rolls.dice}
            onSubmit={(player, value) => dispatch({ type: 'addRoll', track: 'dice', player, value })}
            onUndo={(player) => dispatch({ type: 'undoRoll', track: 'dice', player })}
            revealed={game.ended}
          />
        </div>
        <div {...panel('cards')} className="grid min-h-0">
          <CardsPanel cards={cards} dispatch={dispatchCards} />
        </div>
      </main>
    </div>
  )
}
