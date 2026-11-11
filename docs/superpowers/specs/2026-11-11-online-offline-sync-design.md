# Online / offline sync instead of rooms

## Why

Two people only ever use this app, at the same table. Room codes, share links and the "join another
room" form solve a problem they don't have. What they do want:

- usually, one game shared between the two phones (both see and change the same state);
- sometimes, a fully offline game where each phone tracks the game on its own, with no server at all;
- the freedom to drop out of sync mid-game and carry on alone, and to get back into the shared game
  later.

## Goals

- **No rooms.** The server keeps exactly one shared game: "the online game".
- **New Game asks Offline or Online.**
  - **Online**: the online game is replaced with a fresh game, and this phone becomes synced to it.
    Any other phone currently synced resets too (it is the same game).
  - **Offline**: this phone gets a fresh local game and stops syncing (if it was). The online game on
    the server is left untouched.
- **Joining** happens from the existing people icon in the header, at any time during a game:
  - Opening the panel on an offline phone checks the server. If an online game exists, the panel
    shows a short summary of it (turn, how long ago it last changed) and a **Join** button.
  - Join replaces this phone's game with the online one. The local game is gone and not
    recoverable; the button must say so and take a confirming second tap.
  - If no online game exists, the panel says so (no Join).
- **Turning sync off**: on a synced phone, the panel shows the connection status and a
  **Turn sync off** button. The phone keeps the game exactly as it is on screen and continues
  offline. Only this phone is affected: the other phone stays synced and the online game stays alive
  on the server, so the phone that left can rejoin later (which overwrites its local game again).
- **Offline means offline.** A phone in offline mode does not talk to the server at all, except
  while the people panel is open (that is the only time it checks for an online game).

## Non-goals

- No notification of any kind (push or in-app) when the other phone starts an online game. The
  only check is opening the people panel.
- **An offline game can never be put online.** The only ways into online mode are New Game → Online
  and joining the existing online game. No "upload my game" action.
- No multiple games, codes, links or sharing.
- "My hand" marks stay per-phone and never sync, as now.

## Anti-goals

- Silently overwriting a phone's local game. Overwriting only happens on an explicit Join (two
  taps) or on New Game → Online.
- An offline phone holding an open connection to the server in the background.

## Behaviour details

### Mode on the phone

- Each phone stores its mode (`offline` | `online`) in `localStorage`; a reload or reopen keeps it.
- After this update ships, every phone starts **offline** with the game it already has stored.
- The local stored game (game, cards, moves) remains the single source of truth while offline. While
  online, the phone keeps saving the last online state it saw, as `useSyncedRoom` does today, so
  turning sync off keeps exactly what is on screen.

### Online phone

- Same behaviour as today's synced room: state from the server query, optimistic updates, changes
  blocked until the online game has loaded, changes queued while the connection is down.
- If the online game is missing on the server (e.g. never created), the phone shows its last-seen
  game read-only — builder's call how to surface this; the expected path is that a synced phone
  always has a game because it got there via New Game → Online or Join.
- The header icon looks different online vs offline, and still marks a lost connection while online
  (today's `CloudOff` badge). Exact styling: builder's call, within the existing design system.

### New Game

- New Game (currently one tap in `GameAction`) now opens a small modal: **Offline**, **Online**, and a
  way to cancel. Choosing either starts the new game (clears my hand, dismisses the toast, switches to
  the Cards tab — as `onNewGame` does today) and sets the mode.
- **Online** sends one mutation that replaces the server's game with a fresh `newRoom()` built on the
  server, not state sent from the phone.
- In a build without a sync server (`VITE_CONVEX_URL` unset: tests, local dev) the modal is skipped,
  New Game behaves as today and there is no people icon. *(Call made in design.)*

### People panel

| Phone mode | Server has online game | Panel shows |
|---|---|---|
| offline | checking | a loading line |
| offline | yes | summary (turn N, last changed X ago) + Join (two taps, warns local game is lost) |
| offline | no | "no online game" |
| offline | unreachable | "can't reach the server" |
| online | — | connection status + Turn sync off (one tap; it loses nothing) |

Removed: the room code, share link, and join-by-code form.

## Server (Convex)

- Replace the `rooms` table with a single-game store (e.g. a `game` table holding at most one
  document), with `game`, `cards`, `moves` and an `updatedAt` timestamp for the panel summary.
- Functions (names are the builder's call):
  - `get` query → the online game (+ `updatedAt`) or null.
  - `start` mutation → replaces (or creates) the online game with a fresh `newRoom()`.
  - `dispatch` mutation → applies a `RoomAction` through `roomReducer`, as today; sets `updatedAt`.
- Old `rooms` data can be dropped; nothing needs migrating.
- Two phones racing on New Game → Online: last one wins, both stay synced to it. Acceptable.

## Client constraints

- The Convex client must not open a connection while the phone is offline and the panel is closed.
  Today `src/lib/convex.ts` constructs `ConvexReactClient` at module load, which connects straight
  away; it has to be created lazily (or the connection otherwise held off) and the
  `ConvexProvider` arranged so offline mode makes no requests.
- `useRoom` becomes one hook that switches between the local reducer and the synced state based on
  the stored mode, keeping the `Room` interface the rest of the app uses. `RoomSync` changes shape
  (no `code`/`join`; adds mode, join-the-online-game, turn-sync-off).
- Remove room-code code: `makeRoomCode`, `normalizeRoomCode`, `roomLink`, `ROOM_KEY`, the `?room=`
  link handling, and the related copy and tests. Keep `roomReducer`, `RoomState`, moves.
- All UI text is Polish, in `src/copy.ts`, in the existing tone.
- Tests: Vitest + Testing Library as in the repo. Cover mode persistence, New Game modal choices,
  Join replacing local state, Turn sync off keeping state, and offline making no server calls.

## Left to the builder

- Exact component structure, modal styling, icon treatment for online/offline.
- Function and table names on the server.
- How the "last changed X ago" summary is worded.
