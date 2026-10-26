# Reshuffles by the rules, and "in hand" cards — design

## Why

The Karty tab now reshuffles the discard pile on entering turns 3 and 7, plus a manual
**Przetasuj** button. That's a rough guess: in a real game the reshuffle happens when the draw
deck runs out, and that depends on what was played. The tab should reshuffle exactly when the
table does, and use what a reshuffle reveals — which cards must now be in a hand — to tell the
player more about where the cards are.

## Goals

- The app tracks how many cards are in the **draw deck**, all game long.
- Reshuffles happen automatically, only at the three moments below.
- After a reshuffle (except Tehran's), every available card that wasn't shuffled into the deck is
  marked **in hand**.
- Cards 77, 108 and 43 open a **picker** when played as the event (marked removed), so the app
  learns what the event did.

## Non-goals

- Knowing which hand a card is in, or which cards are in the deck vs. hands beyond the in-hand mark.
- Any other card that draws or discards (only 77, 108, 43 are handled).
- A manual reshuffle. **Przetasuj** goes away.

## The deck count

- Combined hand size: **16** in turns 1–3, **18** in turns 4–10.
- At the start of a turn, after the deal: `deck = available − combined hand size`.
- Discarding or removing a card during a turn doesn't change the deck — it leaves a hand.
- It changes only through: a reshuffle (+ the cards shuffled in), Tehran's discards (− each),
  card 77's draws (− each).
- Shown on the Karty tab near the turn controls (builder's call on the exact look).

"Available" still means deck or hand; the China Card is not in the list and not counted.

## The three reshuffles

### 1. Entering a new turn

1. Mid/Late War cards join, if this is their turn.
2. If `available ≤ combined hand size` (the deck can't cover the deal): every discarded card in
   play goes back to available, and every card that was available *before* this step is marked
   in hand (leftover hand cards and the last deck cards — all dealt out before the new deck is
   touched).
3. The deck count becomes `available − combined hand size`.

The toast appears only when a reshuffle happened ("Przetasowano: wraca N kart"), with undo =
going back the turn. Going back a turn undoes everything its start did — the reshuffle, the
marks it added, the deck count — and keeps changes made during the turn (as today's `unshuffle`).

### 2. Our Man in Tehran (108) removed

1. If `deck ≤ 5`: reshuffle the discard pile into the deck. **No** in-hand marks (the old deck
   cards are on top and go to Tehran's look, not a hand).
2. The picker opens: tick **up to 5** cards Tehran discarded. Only available cards *not* marked
   in hand can be ticked (Tehran draws from the deck).
3. On OK: ticked cards become discarded; deck count −= ticked.

### 3. "Ask Not What Your Country…" (77) removed

1. The picker opens: tick **up to 8** available cards the US player discards (cards marked in
   hand can be ticked).
2. On OK: ticked cards become discarded. Let `n` = ticked.
   - `deck ≥ n`: draw without a reshuffle; deck −= n.
   - `deck < n`: reshuffle the discard pile (including the cards just discarded) into the deck;
     every available card that wasn't shuffled in is marked in hand; deck = deck + shuffled − n.

### SALT Negotiations (43) removed — not a reshuffle, same picker

The picker opens on the **discard pile**, scoring cards (value 0) excluded: tick **up to 1**.
On OK it becomes available and is marked in hand. The deck count doesn't change.

## The picker

- Opens when card 77, 108 or 43 is marked removed (by swipe or button).
- Each eligible row shows a checkmark slot where the "x" of removed cards normally sits;
  ineligible rows can't be ticked.
- A bar shows "N / max" with **OK** only — no Cancel: playing the event is irreversible, so the
  picker has to be finished. Ticking past the max isn't possible; OK with nothing ticked is allowed
  (the event discarded or took nothing).
- While the picker is open, the rest of the tab (turn controls, other rows' actions) waits for OK.
- After OK, a toast says what happened (e.g. "Odrzucono 6, dobrano bez tasowania",
  "…przetasowano: wraca N kart", "Do ręki: <name>"). Its undo reverses the whole event: the
  removal of 77/108/43, its reshuffle, discards, marks and deck change.

## The in-hand mark

- A hand icon on the row, in the "x" slot.
- Kept until the card is discarded or removed (by hand or by a picker) — through later turns
  and later reshuffles.

- Filtering and the "played last" order treat in-hand cards as available.

## Removing only cards with an asterisk

Only cards with an asterisk (`isPermanent`) can be removed from the game. For every other card,
swipe right does nothing and the remove button isn't offered. A non-asterisk card already marked
removed in an old saved game can still be restored with a long press.

## Saved games

The saved shape changes (deck count, marks, richer turn history). A game saved by the old
version still loads: no marks, deck counted as `available − combined hand size` for its turn,
history entries treated as "reshuffle returned these cards, no marks". Bump the storage key or
version as the builder sees fit, but don't throw away a game in progress.

## Worked example (turn 5)

22 available → deck 4. Tehran: deck ≤ 5, reshuffle 10 discards → deck 14, no marks. Tehran
discards 3 → deck 11. Card 77 discards 6: 11 ≥ 6, draw without reshuffle → deck 5.

## Calls made by Claude (not asked)

- Deck count is visible on the tab.
- The toast after the picker's OK still offers undo, as a safety for a mis-tap — the only way
  back from an event, since the picker has no Cancel.
- Setting 77/108/43 back to available by hand doesn't reverse its event — use the toast undo or
  fix cards by hand.
- Restoring a discarded/removed card by hand doesn't change the deck count.
- The deck count never shows below 0 (a mis-entry can't break it).

## Left to the builder

State shape, history format, component split, copy wording (Polish, in `copy.ts`), tests in the
style of `cardGame.test.ts` and `CardsTab.test.tsx`.
