# Cards tab — design

## Intent

During a live game of Twilight Struggle (Polish 3rd edition, "Zimna Wojna"), one player keeps the phone on the table and
updates the Karty tab **every time a card is played**. The same list answers the question **"what may still show up?"**:
which cards are in the draw deck or someone's hand, which are sitting in the discard pile until the next reshuffle, and
which are gone for good.

Source for the card list, its order, sides, values, asterisks and bold marks:
`Zimna_Wojna_lista_kontrolna_A4_final.pdf` (the Polish A4 checklist the user plays with).

## Goals

- A scrollable list of every card currently in the game, in the checklist's order, each in one of three states:
  - **available** (`available`) — in the draw deck or in either player's hand (the app can't tell these apart);
  - **discarded** (`discarded`) — on the discard pile, back in play after the next reshuffle;
  - **removed** (`removed`) — out of the game.
- A turn counter (1–10) that brings Mid War and Late War cards in and performs the scheduled reshuffles.
- A manual reshuffle for when the deck runs out at an unscheduled moment.
- Fast, one-handed state changes: tap, swipe, long-press.
- Filters by side, phase, state and ops value.

## Non-goals

- Tracking which cards are in whose hand, or the deck size. "Available" covers deck + both hands.
- The China Card (not on the checklist, never in the deck).
- Card texts or event effects.
- Automatically removing asterisked cards. The asterisk is only a reminder; the user removes the card themselves.

## Anti-goals

- A reshuffle happening silently, or one that can't be taken back after a mis-tap.
- Hidden cards from phases that haven't started cluttering the list.
- Swipes that fire while the user is just scrolling.

## Card data

A static list in code (one entry per checklist row), with these properties:

| property      | type                            | notes                                                                                                         |
| ------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `id`          | `number`                        | Official card number (GMT numbering).                                                                         |
| `order`       | `number`                        | Position on the checklist; the list's default order.                                                          |
| `stub`        | `string`                        | Official English name in kebab-case, e.g. `warsaw-pact`, `duck-and-cover`.                                    |
| `name`        | `string`                        | Polish name exactly as on the checklist, without the asterisk.                                                |
| `important`   | `boolean`                       | The name is bold on the checklist.                                                                            |
| `value`       | `number`                        | Ops value; scoring cards use `0` and display "–".                                                             |
| `phase`       | `'early' \| 'mid' \| 'late'`    | Checklist section: Początek / Apogeum / Schyłek Wojny.                                                        |
| `player`      | `'ussr' \| 'us' \| 'neutral'`   | Checklist column: ZSRR / USA / N.                                                                             |
| `isPermanent` | `boolean`                       | Name has the asterisk: removed after its event is played (the user still removes it by hand).                 |

`state` is not part of the static data; it lives in the saved game state, keyed by card `id`.

## Turns and reshuffles

Rules (GMT living rules; BGG "The reshuffle explained concisely"; twilightstrategy.com "Reshuffles"):

- A **reshuffle** happens immediately when the draw deck runs out: every discarded card goes back into the deck. Cards
  in hands and removed cards are untouched.
- The first reshuffle **always** happens during the turn 3 deal; the second almost always during the turn 7 deal; a
  third sometimes during the turn 10 deal. Heavy discarding can move the second one earlier, even mid-turn.
- Mid War cards join the draw deck before the turn 4 deal, Late War cards before the turn 8 deal. **These are not
  reshuffles**: the discard pile stays where it is.

The **turn counter** (replaces the earlier stepper idea) shows the current turn and a "next turn" control. Going back
exists to fix a mis-tap.

| entering turn | what happens                                                    |
| ------------- | --------------------------------------------------------------- |
| 3             | reshuffle: all `discarded` → `available`                        |
| 4             | Mid War cards appear, all `available`                           |
| 7             | reshuffle                                                       |
| 8             | Late War cards appear, all `available`                          |
| others        | nothing                                                         |

- A card is shown only once its phase has started: turns 1–3 early; 4–7 early + mid; 8–10 all.
- After an automatic reshuffle, a short message says how many cards came back.
- **Going back a turn undoes exactly what entering that turn did.** For a reshuffle, the cards it returned go back to
  `discarded` — except any card the user has changed since (that change wins). Going back past turn 4 or 8 hides that
  phase's cards again.
- **Manual reshuffle** ("Przetasuj"): a button in the turn-counter area with the app's two-tap confirmation
  (`useConfirmTap`, like "Zakończ grę"). It can be undone the same way (a short-lived undo, like the roll trackers').
- Counter at turn 1 can't go back; at turn 10 can't go forward.

## The list

### Rows

Each row: Polish name, then the asterisk (if `isPermanent`), then the important mark (if `important`): a lucide warning
icon (`TriangleAlert`) in a dark-tinted yellow (the theme's gold-text family). Right side: side label (ZSRR / USA / N) and
ops value ("–" for scoring cards), as on the checklist.

| state       | appearance                                                    |
| ----------- | ------------------------------------------------------------- |
| `available` | normal                                                        |
| `discarded` | slightly dimmed, with a play icon (lucide `Play`)             |
| `removed`   | strongly dimmed, with a red X (lucide `X`, `danger` colour)   |

### Interactions

- **Tap an available card** → two action buttons appear on that row: **X** (remove) and **play** (discard). Tapping
  elsewhere or another row closes them.
- **Swipe left** → discard; the play icon follows the finger. **Swipe right** → remove; the X follows the finger. A
  swipe commits past a threshold; otherwise the row springs back. Vertical scrolling must win over a mostly-vertical drag.
- **Long-press a discarded or removed card** → a **"Przywróć"** (restore) option that makes it `available`.
- A discarded card can also be swiped right to remove it (some events remove a card from the discard pile).
- A plain tap on a discarded or removed card does nothing (restore is deliberately behind a long press).
- Everything reachable without gestures too (keyboard / screen reader): Enter/Space opens the row's actions, and for a
  discarded or removed card that includes restore.

### Order

- Default: checklist order (`order`), with or without filters.
- A separate toggle in the filter area: **discarded and removed to the bottom**. When on, available cards come first
  (in checklist order), then the rest (in checklist order). When off, every card stays in place.

### Filters

Toggle chips above the list, in four groups: **side** (ZSRR, USA, N), **phase** (early, mid, late — only phases that
have started), **state** (available, discarded, removed), **ops value** (–, 1, 2, 3, 4).

- Within a group, chips combine with OR (USA + N = cards of either side).
- Across groups, they combine with AND (USA + 4 = only US 4-ops cards).
- A group with nothing selected doesn't filter.

### Counts

The turn-counter area shows, per state, the count split by side, coloured: **red** ZSRR | **blue** USA | **grey** N —
e.g. "Dostępne 12|6|2". Counts cover the cards currently in the game (phase started), ignoring filters.

## Persistence and new game

- Card states, the turn and a record of what entering each turn did (so the user can step back several turns) survive
  reloads, like the rest of the app (localStorage, own key so existing saved games stay valid).
- "Nowa gra" also resets the cards: turn 1, all early cards `available`.

## Builder's calls (made by Claude, open to change)

- Separate storage key and reducer for cards rather than extending `GameState`, so the existing save format is untouched.
- Exact layout of the turn counter, filter chips (e.g. a collapsible filter panel on small screens), swipe threshold,
  long-press duration and the reshuffle message.
- Whether a removed card can be swiped to discarded (default: no; restore first).
- Official numbers come from the GMT numbering (deluxe core 1–103, optional 104–110); any checklist card without a GMT
  number (e.g. a promo such as *Schwytanie nazistowskich naukowców*) gets the next free number above 110, and the data
  task double-checks all mappings against the checklist count per section.
- The game's "ended" state doesn't lock the cards tab.
- Polish labels for states, phases and buttons, added to `copy.ts`.
