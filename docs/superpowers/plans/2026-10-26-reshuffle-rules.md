# Reshuffles by the Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Karty tab tracks the draw deck, reshuffles only when the rules say so, marks cards known to be in a hand, and walks the player through cards 43, 77 and 108 with a picker.

**Architecture:** All rules live in the pure reducer in `src/lib/cardGame.ts` (state gains `deck`, `inHand`, `pending`, richer `history`). The UI (`CardsPanel`, `CardRow`, a new `EventPicker`) only dispatches and words toasts. Event undo restores a snapshot taken just before the event card was removed.

**Tech Stack:** React 19, TypeScript, Tailwind 4, lucide-react, Vitest + Testing Library. Run tests with `pnpm test`.

**Spec:** `docs/superpowers/specs/2026-10-26-reshuffle-rules-design.md`

## Global Constraints

- Combined hand size: **16** in turns 1–3, **18** in turns 4–10.
- New-turn reshuffle when `available ≤ combined hand size` (checked after Mid/Late War join).
- Tehran (108) reshuffles on removal when `deck ≤ 5`; picks up to **5**; no in-hand marks.
- Card 77 picks up to **8**; reshuffles when `deck < picked`.
- SALT (43) picks up to **1** discarded non-scoring card (value > 0); it becomes available and in hand.
- Only cards with `isPermanent` can be removed. The picker has **no Cancel**; it closes only with OK.
- The deck count never goes below 0.
- Every user-facing word goes in `src/copy.ts`, in Polish. Comments match the file's existing density.
- Commit straight to `main`; end each commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- Reloading while the picker is open: the picker must come back (state `pending` is saved), and the turn controls stay locked. — test in Task 4.
- Pressing Następna tura within 2 s of an event's toast, then Cofnij: must not restore a stale turn. The toast is dismissed on any turn change. — test in Task 4.
- A game saved by the old version (history of plain id arrays, no `deck`) loads without losing progress. — test in Task 1.
- Picks that break the rules (too many, an in-hand card for Tehran, a scoring card for SALT) are ignored by the reducer, not just hidden by the UI. — test in Task 2.
- Active filters must not hide cards the picker needs: in picker mode the list shows exactly the pickable cards, filters ignored. — test in Task 4.

---

### Task 1: Deck count, new-turn reshuffle, in-hand marks

**Files:**
- Modify: `src/lib/cardGame.ts`
- Test: `src/lib/cardGame.test.ts`

**Interfaces:**
- Produces:
  - `export const handSize = (turn: number): number` — 16 for turns 1–3, 18 after.
  - `export interface TurnEntry { returned: number[]; marked: number[]; deck: number | null }` — what entering the turn did; `deck` is the count when the previous turn was left (`null` only for migrated saves: recount on going back as `max(0, available − handSize(turn))`).
  - `CardsState` gains `deck: number`, `inHand: number[]` (available cards known to be in a hand, no duplicates), `pending: EventCard | null` (Task 2 uses it; always `null` here), and `history: TurnEntry[]`.
  - `export const isInHand = (state: CardsState, id: number): boolean`
  - `export const availableIds = (state: CardsState): number[]` — available cards in play.
  - `export const entersWithReshuffle = (state: CardsState): boolean` — whether `nextTurn` would reshuffle now.
  - `newCards()` returns `{ turn: 1, states: {}, inHand: [], deck: 23, pending: null, history: [] }`.
  - `RESHUFFLE_TURNS`, the `reshuffle` and `undoReshuffle` actions are deleted.

- [ ] **Step 1: Write the failing tests** — replace the turn-3/turn-7/manual reshuffle tests in `cardGame.test.ts`. Use `const early = cardsInPlay(1).map((c) => c.id)` and a helper `discardAll(ids)`. A helper `at(partial: Partial<CardsState>)` builds a state on any turn (`history` filled with `{ returned: [], marked: [], deck: 0 }` entries to match `turn`).

```ts
it('starts with 23 cards in the deck', () => expect(newCards().deck).toBe(23))

it('does not reshuffle while the deck can cover the deal', () => {
  const s = run([...discardAll(early.slice(0, 22)), ...next(1)])  // 17 available
  expect(cardState(s, early[0])).toBe('discarded')
  expect(s.deck).toBe(1)
  expect(s.inHand).toEqual([])
})

it('reshuffles when available cards are no more than both hands, marking the rest in hand', () => {
  const s = run([...discardAll(early.slice(0, 23)), ...next(1)])  // 16 available
  expect(early.slice(0, 23).every((id) => cardState(s, id) === 'available')).toBe(true)
  expect([...s.inHand].sort()).toEqual([...early.slice(23)].sort())
  expect(s.deck).toBe(23)
})

it('uses 18 from turn 4, after Mid War joins', () => {
  // Turn 3, every Early War card but 5 removed or discarded: 5 + 48 Mid War = 53 available → no reshuffle, deck 35.
})

it('keeps marks across turns until the card is discarded or removed', () => { /* mark via reshuffle, next turn, still marked; discard → unmarked */ })

it('going back a turn undoes its reshuffle and marks, restores the deck, keeps changes made since', () => {
  // reshuffle into turn 2, then discard one marked card; previousTurn:
  // reshuffled cards discarded again, marks it added gone, the card discarded since stays discarded, deck back to the turn-1 value.
})

it('never lets the deck go below 0', () => { /* removing cards in turn 1 doesn't touch deck; at({deck:0}) then next turn recounts ≥ 0 */ })

it('can only remove cards with an asterisk', () => {
  const s = run([remove(UN_INTERVENTION)])  // 32, no asterisk
  expect(cardState(s, UN_INTERVENTION)).toBe('available')
})
```

Persistence tests: round-trip the new shape; `loadCards` migrates `{ turn: 3, states: { 10: 'discarded' }, history: [[], [15]] }` to `inHand: []`, `pending: null`, `deck: max(0, available − 16)`, history `[{ returned: [], marked: [], deck: null }, { returned: [15], marked: [], deck: null }]`; unusable data still starts fresh.

- [ ] **Step 2: Run** `pnpm test src/lib/cardGame.test.ts` — expect FAIL (`deck`, `inHand` undefined).

- [ ] **Step 3: Implement in `src/lib/cardGame.ts`.**
  - `withStates` also drops ids from `inHand` when they become `discarded` or `removed`.
  - `setCardState` to `removed` is a no-op for a card without `isPermanent`.
  - `nextTurn`: after the turn advances, if `availableIds` (for the new turn) `≤ handSize(new turn)`: `returned = discardedIds`, `marked = available ids not already in inHand`; cards return. Either way `deck = max(0, available after − handSize)`. History entry `{ returned, marked, deck: state.deck }`.
  - `previousTurn`: `unshuffle(returned)`, drop `marked` from `inHand`, `deck = entry.deck ?? recount`.
  - Persistence: keep the key `ts-companion:cards:v1`; `isCardsState` checks the new fields (`inHand` and `TurnEntry` ids known, `deck` a non-negative integer, `pending` `null` or an `EventCard`); a legacy check accepts the old shape and converts it as tested.

- [ ] **Step 4: Run** `pnpm test src/lib/cardGame.test.ts` — expect PASS. `pnpm exec tsc -b` will fail in `CardsPanel.tsx` (uses `RESHUFFLE_TURNS`, `reshuffle`); that's fixed in Task 3 — run `pnpm test src/lib` only here.

- [ ] **Step 5: Commit** — `git commit -m "Reshuffle only when the deck can't cover the deal, and mark cards in hand"`.

---

### Task 2: Events 43, 77 and 108 in the reducer

**Files:**
- Modify: `src/lib/cardGame.ts`
- Test: `src/lib/cardGame.test.ts`

**Interfaces:**
- Consumes: Task 1's state, `availableIds`, `isInHand`, `handSize`.
- Produces:
  - `export const SALT = 43, ASK_NOT = 77, TEHRAN = 108`
  - `export type EventCard = typeof SALT | typeof ASK_NOT | typeof TEHRAN`
  - `export const EVENT_PICKS: Record<EventCard, number> = { 43: 1, 77: 8, 108: 5 }`
  - `export const pickableIds = (state: CardsState): number[]` — for `state.pending`: 108 → available, not in hand; 77 → available; 43 → discarded with `value > 0`; `[]` with nothing pending. In play only.
  - Actions: `{ type: 'resolveEvent'; picked: readonly number[] }`, `{ type: 'restore'; state: CardsState }`.

- [ ] **Step 1: Write the failing tests**

```ts
it('removing an event card waits for its picker; nothing else moves meanwhile', () => {
  let s = run([...next(3), remove(TEHRAN)])
  expect(s.pending).toBe(TEHRAN)
  expect(run([...next(1), discard(BLOCKADE)], s)).toBe(s)  // nextTurn, previousTurn, setCardState ignored
})

it('Tehran with more than 5 in the deck: no reshuffle; its discards leave the deck', () => {
  let s = run([discard(ARMS_RACE), remove(TEHRAN)], at({ turn: 5, deck: 6 }))
  expect(cardState(s, ARMS_RACE)).toBe('discarded')
  s = cardsReducer(s, { type: 'resolveEvent', picked: [A, B] })
  expect([cardState(s, A), cardState(s, B)]).toEqual(['discarded', 'discarded'])
  expect(s.deck).toBe(4)
  expect(s.pending).toBeNull()
})

it('Tehran with 5 or fewer: the discard pile is shuffled in, nobody marked', () => {
  // at({ turn: 5, deck: 4 }) with 10 discarded → after removing Tehran: those 10 available, deck 14, inHand unchanged
})

it('Tehran ignores in-hand cards and more than 5 picks', () => { /* deck drops only by valid picks */ })

it('Ask Not draws without a reshuffle when the deck covers it', () => {
  // deck 11, pick 6 → 6 discarded, deck 5, nothing reshuffled; deck 6 pick 6 → deck 0, no reshuffle
})

it('Ask Not reshuffles, the just-discarded cards included, and marks the rest in hand', () => {
  // deck 3, 5 already discarded, pick 6 → the 11 come back available, card 77 stays removed,
  // every other available card is in inHand, deck = 3 + 11 − 6 = 8
})

it('Ask Not ignores more than 8 picks', () => {})

it('SALT takes one non-scoring card from the discard pile into a hand', () => {
  // discard ASIA_SCORING (1) and BLOCKADE; remove SALT; picking [1] does nothing but close; picking [BLOCKADE] → available, in hand, deck unchanged
})

it('the spec’s turn-5 example ends with 5 in the deck', () => {
  // at({ turn: 5, deck: 4 }) with 10 discarded → Tehran (deck 14) picks 3 (11) → Ask Not picks 6 → deck 5, no reshuffle
})

it('restore puts back a snapshot', () => {
  const before = at({ turn: 5, deck: 6 })
  const s = run([remove(TEHRAN), { type: 'resolveEvent', picked: [A] }, { type: 'restore', state: before }], before)
  expect(s).toEqual(before)
})
```

(`A`, `B`: any available Mid War ids from `cardsInPlay(5)`; pick ones not used elsewhere.)

- [ ] **Step 2: Run** `pnpm test src/lib/cardGame.test.ts` — expect FAIL.

- [ ] **Step 3: Implement.**
  - While `pending` is set, only `resolveEvent`, `restore` and `newGame` change state.
  - `setCardState` to `removed` on an `EventCard` that was not removed sets `pending`; for 108, if `deck ≤ 5`, discards return and `deck += returned.length` (no marks).
  - `resolveEvent`: `picks = picked.filter(in pickableIds).slice(0, EVENT_PICKS[pending])`, then per card:
    - 108: picks → discarded; `deck = max(0, deck − n)`.
    - 77: picks → discarded. If `deck ≥ n`: `deck −= n`. Else: `shuffled = discardedIds` (after the picks), mark every available card not shuffled in, return `shuffled`, `deck = max(0, deck + shuffled.length − n)`.
    - 43: pick → available, added to `inHand`.
    - `pending = null`.
  - `restore` returns `action.state`.

- [ ] **Step 4: Run** `pnpm test src/lib` — expect PASS.

- [ ] **Step 5: Commit** — `git commit -m "Play SALT, Ask Not and Our Man in Tehran through the reducer"`.

---

### Task 3: Deck count, hand icon, no manual reshuffle, asterisk-only removal (UI)

**Files:**
- Modify: `src/components/CardsPanel.tsx`, `src/components/CardRow.tsx`, `src/copy.ts`
- Test: `src/CardsTab.test.tsx`

**Interfaces:**
- Consumes: Task 1's `CardsState`, `isInHand`, `entersWithReshuffle`, `discardedIds`.
- Produces: `CardRow` gains `inHand: boolean`. Copy: `copy.cards.deck = 'Talia'`, `copy.cards.deckCount = (n: number) => \`Talia: ${cards(n)}\``, `copy.cards.inHand = 'Na ręce'`. `reshuffle` and `nothingToReshuffle` copy entries are deleted.

Seed games in tests with `localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(state))` before `render`, building `state` with `run`/`at` (export these helpers from a shared `src/test/cardStates.ts` used by both test files).

- [ ] **Step 1: Write the failing tests** — delete the "manual reshuffle" block and the turn-3 reshuffle test; add:

```ts
it('shows the deck count and has no Przetasuj button', async () => {
  await setup()
  expect(screen.getByRole('status', { name: copy.cards.deckCount(23) })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Przetasuj' })).not.toBeInTheDocument()
})

it('reshuffles on a new turn only when the deck runs out, marking cards in hand', async () => {
  // seed turn 1 with 23 Early War cards discarded; Następna tura → toast copy.cards.reshuffled(23),
  // a remaining card's row has the hand icon (getByLabelText(copy.cards.inHand) within the row), deck 23;
  // Cofnij → turn 1, cards discarded again, no hand icons
})

it('does not offer removing a card without an asterisk', async () => {
  // tap 'Interwencja ONZ': no copy.cards.remove(...) button; swipe(name, SWIPE_COMMIT_PX + 20) leaves it available
})
```

- [ ] **Step 2: Run** `pnpm test src/CardsTab.test.tsx` — expect FAIL.

- [ ] **Step 3: Implement.**
  - `CardsPanel`: delete `ReshuffleButton` and its imports; in its place (`ml-auto`) show the deck count styled like the turn number (`role="status"`, `aria-label={copy.cards.deckCount(cards.deck)}`, label `copy.cards.deck`). `nextTurn` toasts `reshuffled(discardedIds(cards).length)` with undo = going back only when `entersWithReshuffle(cards)`.
  - `CardRow`: `canRemove = state !== 'removed' && card.isPermanent`; the remove button renders only when `card.isPermanent`. When `inHand`, the icon slot shows lucide `Hand` (`size-4 text-ink-muted`, `aria-label={copy.cards.inHand}`, `role="img"`).

- [ ] **Step 4: Run** `pnpm test` and `pnpm build` — expect PASS.

- [ ] **Step 5: Commit** — `git commit -m "Show the deck and cards in hand; drop the manual reshuffle"`.

---

### Task 4: The event picker

**Files:**
- Create: `src/components/EventPicker.tsx`
- Modify: `src/components/CardsPanel.tsx`, `src/components/CardRow.tsx`, `src/copy.ts`, `src/App.tsx` (prop rename)
- Test: `src/CardsTab.test.tsx`

**Interfaces:**
- Consumes: Task 2's `pickableIds`, `EVENT_PICKS`, `EventCard`, `resolveEvent`, `restore`.
- Produces:
  - `EventPicker({ event: EventCard; count: number; onConfirm: () => void })` — the bar above the list: title, `"N / max"`, OK.
  - `CardRow` gains `pick?: { checked: boolean; onToggle: () => void }`. With `pick`, the row's button is `role="checkbox"` with `aria-checked`, the icon slot shows lucide `Check` when checked (an empty square outline otherwise), and swipe, long press and action buttons are off.
  - `CardsPanel` prop `onTurnBack` renamed `onTurnChange`, called on next and previous turn.
  - Copy:
    - `pickTitle: { 43: 'Negocjacje SALT: karta do ręki', 77: '„Nie pytajcie…”: odrzucone karty', 108: 'Teheran: odrzucone karty' }`
    - `picked: (n: number, max: number) => \`${n} / ${max}\``, `ok: 'OK'`, `pick: (name: string) => \`Wybierz: ${name}\``
    - `drewWithout: (n: number) => \`Odrzucono ${cards(n)}, dobrano bez tasowania\``
    - `drewReshuffled: (n: number, back: number) => \`Odrzucono ${cards(n)}, przetasowano: wraca ${cards(back)}\``
    - `tehran: (n: number, back: number) => back > 0 ? \`Przetasowano: wraca ${cards(back)}. Teheran: odrzucono ${cards(n)}\` : \`Teheran: odrzucono ${cards(n)}\``
    - `toHand: (name: string) => \`Do ręki: ${name}\``, `nothingTaken: 'Negocjacje SALT: bez karty'`

- [ ] **Step 1: Write the failing tests**

```ts
it('Tehran opens a picker with no Cancel, and undo takes back the whole play', async () => {
  // seed at({ turn: 5, deck: 6 }); remove 'Nasz człowiek w Teheranie'
  // picker title shown; no button named /Anuluj/; turn buttons disabled
  // list shows only pickable cards; tick 2 (getByRole('checkbox', { name: copy.cards.pick(name) })), a third tick after 5 does nothing
  // OK → toast copy.cards.tehran(2, 0); deck 4; Cofnij → Tehran available, deck 6, both cards available
})

it('Ask Not reshuffles when the deck can’t cover the draw', async () => {
  // seed deck 3 with 5 discarded; remove card 77; tick 6; OK → toast copy.cards.drewReshuffled(6, 11), deck 8, hand icons shown
})

it('SALT lists only non-scoring discarded cards and puts the pick in hand', async () => {})

it('the picker survives a reload and ignores filters', async () => {
  // turn a state filter on, remove Tehran, reload → picker back, list = pickable cards
})

it('a turn change dismisses the last toast', async () => {
  // discard a card, Następna tura → no Cofnij button left from the discard
})
```

- [ ] **Step 2: Run** `pnpm test src/CardsTab.test.tsx` — expect FAIL.

- [ ] **Step 3: Implement.**
  - `CardsPanel` keeps `picks: number[]` state and an `eventStart` ref: `change()` stores the state from before the removal in the ref when an `EventCard` is removed, and shows no toast for it.
  - While `cards.pending`: the turn buttons are disabled, the list shows `pickableIds(cards)` in the usual order (filters ignored) with `pick` props, and `EventPicker` sits above it. Ticking past `EVENT_PICKS` does nothing.
  - OK: work out the toast from the state *before* dispatching (77: reshuffle iff `cards.deck < n`, back = `discardedIds(cards).length + n`; 108: back = what its removal brought back, i.e. `discardedIds(eventStart)` count when `eventStart.deck ≤ 5`), dispatch `resolveEvent`, clear `picks`, notify with undo = `restore(eventStart)` when the ref is set (after a reload there's no snapshot, so no undo).
  - `App.tsx`: pass `onTurnChange={dismissToast}`.

- [ ] **Step 4: Run** `pnpm test` and `pnpm build` — expect PASS. Then launch the app (`pnpm dev`) and play Tehran, 77 and SALT once each on a phone-width window.

- [ ] **Step 5: Commit** — `git commit -m "Pick what SALT, Ask Not and Tehran did"`.
