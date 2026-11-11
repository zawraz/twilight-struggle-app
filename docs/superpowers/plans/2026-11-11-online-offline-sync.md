# Online / Offline Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace room codes with one shared online game on the server, a per-phone Offline/Online mode chosen at New Game, joining and leaving from the people icon.

**Architecture:** The server keeps one game document. The app talks to it only through a small `SyncServer` interface (real Convex implementation + an in-memory fake for tests), which opens its connection lazily and closes it when nobody watches. `useRoom(server)` keeps one local reducer as the source of what's on screen; while online, every server update replaces it, so turning sync off simply stops listening.

**Tech Stack:** React 19, TypeScript, Convex 1.49 (`ConvexReactClient` used directly, no `ConvexProvider`), Vitest + Testing Library, pnpm.

**Spec:** `docs/superpowers/specs/2026-11-11-online-offline-sync-design.md`

## Global Constraints

- All UI text is Polish and lives in `src/copy.ts`; exact strings are given in the task that adds them.
- Offline phone makes no server connection except while the people panel is open.
- A build without `VITE_CONVEX_URL` (tests, local dev) behaves as today: one-tap New Game, no people icon.
- Mode is stored in `localStorage` under `ts-companion:sync-mode:v1` as `'online'` or `'offline'`; missing or anything else means `'offline'`.
- "My hand" never syncs (`useMyHand` unchanged).
- Commit straight to `main`; every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run tests with `pnpm test`; type-check with `pnpm exec tsc -b`.

## Review Focus

1. **Reload while online** — the phone comes back online, shows the last game seen at once (read-only) and goes live when the server answers. Test in Task 3.
2. **Turn sync off while the connection is down** — the phone keeps exactly what is on screen, including changes made since the drop. Test in Task 4.
3. **The other phone starts a new online game while this one is synced** — this phone resets, and its My-hand marks clear (existing fresh-deck detection in `useMyHand`). Test in Task 3.
4. **Opening then closing the panel on an offline phone** — the connection closes again; nothing lingers. Test in Task 4.
5. **The online game changes between the two Join taps** — Join takes the latest state, not the one first shown. Test in Task 4.

---

## File Map

| File | Change | Responsibility |
|---|---|---|
| `convex/schema.ts` | modify | add `games` table (Task 1); drop `rooms` (Task 5) |
| `convex/game.ts` | create | `get`, `start`, `dispatch` on the one online game |
| `convex/rooms.ts` | delete (Task 5) | |
| `src/lib/syncServer.ts` | create | `SyncServer` interface, `OnlineGame`, `SyncListener` |
| `src/lib/convexServer.ts` | create | lazy Convex implementation; `defaultServer` |
| `src/lib/convex.ts` | delete (Task 2) | replaced by `convexServer.ts` |
| `src/test/fakeServer.ts` | create | in-memory `SyncServer` for tests |
| `src/lib/useRoom.ts` | rewrite | mode, local/online state, `RoomSync` |
| `src/lib/useOnlineGame.ts` | create | the panel's check for an online game |
| `src/components/NewGameDialog.tsx` | create | Offline / Online / Cancel |
| `src/components/SyncButton.tsx` | create | header icon + panel (replaces `RoomButton.tsx`) |
| `src/components/RoomButton.tsx` | delete (Task 3) | |
| `src/App.tsx` | modify | `server` prop, dialog, `SyncButton` |
| `src/main.tsx` | modify | drop `ConvexProvider` |
| `src/lib/room.ts`, `src/lib/room.test.ts` | modify (Task 5) | remove room codes |
| `src/copy.ts` | modify | `newGameDialog`, `sync` copy; remove `room` |
| `src/Sync.test.tsx` | create | sync behaviour through `<App server={fake} />` |

---

### Task 1: The one online game on the server

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/game.ts`
- Regenerate: `convex/_generated/*`

**Interfaces:**
- Produces: `api.game.get` (query, no args) → `{ state: RoomState; updatedAt: number } | null`; `api.game.start` (mutation, no args) → `void`; `api.game.dispatch` (mutation, `{ action: RoomAction }`) → `void`.

- [ ] **Step 1: Add the table** — in `convex/schema.ts`, next to `rooms` (left in place until Task 5):

```ts
// The one shared game. At most one document; `game`, `cards` and `moves` are checked with the app's own validators.
games: defineTable({ game: v.any(), cards: v.any(), moves: v.any(), updatedAt: v.number() }),
```

- [ ] **Step 2: Write `convex/game.ts`**
  - A helper `current(ctx)` returning `ctx.db.query('games').first()`.
  - `get`: returns `null` or `{ state: { game, cards, moves }, updatedAt }`.
  - `start`: builds `newRoom()` on the server (import from `../src/lib/room`); patches the existing document or inserts one; `updatedAt: Date.now()`. Never accepts state from the phone.
  - `dispatch`: throws `'No online game'` if none; runs `roomReducer`, rejects with `'Invalid action'` when it throws or the result fails `isRoomState` (same as `convex/rooms.ts` today); patches with `updatedAt: Date.now()`.

- [ ] **Step 3: Regenerate types**

Run: `pnpm exec convex codegen` (if it needs a deployment, `pnpm exec convex dev --once`).
Expected: `convex/_generated/api.d.ts` contains `game: typeof game`.

- [ ] **Step 4: Type-check** — Run: `pnpm exec tsc -b`. Expected: no errors.

- [ ] **Step 5: Commit** — `git add convex && git commit -m "Keep one online game on the server"`

---

### Task 2: The `SyncServer` seam, its Convex implementation and a fake

**Files:**
- Create: `src/lib/syncServer.ts`, `src/lib/convexServer.ts`, `src/test/fakeServer.ts`, `src/test/fakeServer.test.ts`
- Delete: `src/lib/convex.ts`
- Modify: `src/main.tsx` (render `<App />` without `ConvexProvider`)

**Interfaces:**
- Produces (`src/lib/syncServer.ts`):

```ts
export interface OnlineGame { state: RoomState; updatedAt: number }
export interface SyncListener {
  /** The online game, or null when there is none; called on every change. */
  onGame: (game: OnlineGame | null) => void
  /** Whether the connection is up right now. */
  onConnected: (connected: boolean) => void
}
export interface SyncServer {
  /** Starts listening, opening the connection if it is closed. Returns stop; the connection closes once the last listener stops. */
  watch: (listener: SyncListener) => () => void
  /** Replaces the online game with a fresh one; shown to watchers at once. */
  start: () => Promise<void>
  /** Applies one action to the online game; shown to watchers at once. */
  dispatch: (action: RoomAction) => Promise<void>
}
```

- Produces (`src/lib/convexServer.ts`): `export function convexServer(url: string): SyncServer` and `export const defaultServer: SyncServer | null` (null when `VITE_CONVEX_URL` is empty/unset).
- Produces (`src/test/fakeServer.ts`): `export function fakeServer(initial?: OnlineGame | null, options?: { held?: boolean }): FakeServer` where `FakeServer = SyncServer & { game: OnlineGame | null; open: boolean; opens: number; setConnected(up: boolean): void; replace(game: OnlineGame | null): void; release(): void }`. With `held: true`, listeners get no `onGame` until `release()` (then the current game, and every change after). `open` is true while any listener is active; `opens` counts closed→open transitions; `replace` simulates the other phone (notifies listeners); `dispatch`/`start` apply via `roomReducer` / `newRoom()` synchronously and notify; `updatedAt` from `Date.now()`. A new listener gets `onGame` and `onConnected` immediately (connected defaults to true).

- [ ] **Step 1: Write the fake's own tests** in `src/test/fakeServer.test.ts`:
  - `opens on first watch and closes after the last stop` — two watches → `opens === 1`, `open === true`; stop both → `open === false`.
  - `dispatch updates every listener` — after `dispatch({ target: 'cards', action: { type: 'nextTurn' } })`, last `onGame` arg has `state.cards.turn === 2`.
  - `start replaces the game with a fresh one` — from a turn-2 game, `start()` → `game.state` equals `newRoom()`.

- [ ] **Step 2: Run** `pnpm test src/test/fakeServer.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement `syncServer.ts` and `fakeServer.ts`** to the interfaces above.

- [ ] **Step 4: Run** `pnpm test src/test/fakeServer.test.ts` — Expected: PASS.

- [ ] **Step 5: Implement `convexServer.ts`**
  - Holds `client: ConvexReactClient | null`, created on the first `watch` (not at import). Each `watch` uses `client.watchQuery(api.game.get, {})`, `.onUpdate` → `onGame(watch.localQueryResult() ?? null)` (a thrown result is logged, not passed on), and `client.subscribeToConnectionState(s => onConnected(s.isWebSocketConnected))`, also reporting the current state once.
  - When the last listener stops, close the client on the next tick (`setTimeout(…, 0)`) unless a new watch arrived meanwhile; then `client = null`. This absorbs StrictMode's unmount/remount.
  - `start` and `dispatch` call `client.mutation(...)` (creating the client if needed) with `optimisticUpdate`: `start` sets `api.game.get` to `{ state: newRoom(), updatedAt: Date.now() }`; `dispatch` sets it to `roomReducer(current.state, action)` when a value is present.

- [ ] **Step 6: Update `src/main.tsx`** — remove the `ConvexProvider` branch and the `./lib/convex` import; render `<App />`. Delete `src/lib/convex.ts`. (`useRoom.ts` still imports `convex` until Task 3: change that import to `import { defaultServer as convex } from './convexServer'` as a stop-gap so the tree compiles; Task 3 rewrites it.)

  Note: the stop-gap leaves `useSyncedRoom` calling Convex hooks without a provider; it is only reached with a URL set, and Task 3 replaces it. Tests run without a URL.

- [ ] **Step 7: Run** `pnpm test` and `pnpm exec tsc -b` — Expected: all pass, no type errors.

- [ ] **Step 8: Commit** — `git commit -m "Reach the server through a SyncServer that connects only while watched"`

---

### Task 3: Mode, `useRoom(server)` and the New Game dialog

**Files:**
- Rewrite: `src/lib/useRoom.ts`
- Create: `src/components/NewGameDialog.tsx`, `src/Sync.test.tsx`
- Modify: `src/App.tsx`, `src/copy.ts`
- Delete: `src/components/RoomButton.tsx` (the panel returns in Task 4)

**Interfaces:**
- Consumes: `SyncServer`, `OnlineGame` (Task 2); `fakeServer` in tests.
- Produces:

```ts
export type SyncMode = 'online' | 'offline'
export const SYNC_MODE_KEY = 'ts-companion:sync-mode:v1'
export interface RoomSync {
  mode: SyncMode
  /** Online only: the online game has loaded, so changes go through. */
  live: boolean
  /** Online only: the connection is up. */
  connected: boolean
  /** Online only: the server answered that there is no online game. */
  missing: boolean
  /** A fresh game in this mode: online replaces the online game, offline leaves it alone. */
  newGame: (mode: SyncMode) => void
  /** Replaces this phone's game with the online one and goes online. */
  join: (game: OnlineGame) => void
  /** Stops syncing, keeping the game on screen. */
  leave: () => void
  server: SyncServer
}
export function useRoom(server: SyncServer | null): Room   // Room as today; sync: RoomSync | null (null when server is null)
```

- `App` signature: `export default function App({ server = defaultServer }: { server?: SyncServer | null })`.
- `NewGameDialog({ onChoose, onCancel }: { onChoose: (mode: SyncMode) => void; onCancel: () => void })`.

- [ ] **Step 1: Add copy** to `src/copy.ts` (keep `room` for now):

```ts
newGameDialog: {
  title: 'Nowa gra',
  offline: 'Offline',
  offlineHint: 'Gra tylko na tym telefonie',
  online: 'Online',
  onlineHint: 'Wspólna gra na obu telefonach. Zastępuje obecną grę online.',
  cancel: 'Anuluj',
},
```

- [ ] **Step 2: Write failing tests** in `src/Sync.test.tsx` (render `<App server={fake} />`; reuse the End-twice-then-New-Game pattern from `App.test.tsx`; helper `chooseNewGame(user, label)` clicks `copy.newGame` then the dialog button):
  - `New Game asks Offline or Online` — after ending, clicking `Nowa gra` shows a dialog named `copy.newGameDialog.title` with buttons `Offline`, `Online`, `Anuluj`; `Anuluj` closes it and the game is still ended.
  - `offline new game never touches the server` — fresh render → play a few moves → End → New Game → Offline: `fake.opens === 0`, `fake.game === null`, `localStorage[SYNC_MODE_KEY]` is `'offline'`.
  - `online new game replaces the online game and syncs` — with `fake` holding a turn-5 game: New Game → Online → `fake.game.state` equals `newRoom()`; next-turn on the Cards tab → `fake.game.state.cards.turn === 2`; mode stored `'online'`.
  - `online new game from a synced phone resets the other phone` — covered by: phone synced (`localStorage` mode `'online'`, fake holds a turn-3 game) → `fake.replace({ state: newRoom(), updatedAt })` → Cards tab shows turn 1, and a card marked in My hand before is no longer marked. *(Review Focus 3)*
  - `reload while online shows the last game at once, read-only until the server answers` — set mode `'online'` and a stored turn-4 game in `localStorage`; `fakeServer(turn6Game, { held: true })`; render: turn 4 shown, next-turn does nothing; `fake.release()` → turn 6 shown and next-turn goes through. *(Review Focus 1)*
  - `offline new game from a synced phone leaves the online game alone` — synced phone, New Game → Offline: `fake.game` unchanged, `fake.open === false`.
  - Existing `App.test.tsx` / `CardsTab.test.tsx` render `<App />` with no server and must keep passing unchanged.

- [ ] **Step 3: Run** `pnpm test src/Sync.test.tsx` — Expected: FAIL.

- [ ] **Step 4: Rewrite `useRoom.ts`**
  - Local state: `useReducer` over `RoomAction | { target: 'replace'; state: RoomState }` (`replace` handled in `useRoom.ts`, not added to `roomReducer`), initialised from `loadRoom()`, saved on every change as now.
  - `mode` from `localStorage` (Global Constraints), saved on change; forced `'offline'` when `server` is null.
  - While `mode === 'online'`: `useEffect` → `server.watch({ onGame, onConnected })`; `onGame(g)` → `live = g !== null`, `missing = g === null`, and `g` → `replace` into local state. Stop on leave/unmount.
  - Changes while online go to `server.dispatch` only when `live` (ignored otherwise, as today); the screen updates from the watched answer (optimistic in Convex, synchronous in the fake). Offline: local reducer.
  - `newGame('online')`: `replace` local with `newRoom()`, mode online, `server.start()`. `newGame('offline')`: mode offline, `replace` local with `newRoom()`. Errors from server calls are `console.error`'d as today.
  - `join(g)`: `replace` with `g.state`, mode online. `leave()`: mode offline (local already holds the screen).
  - Delete room-code handling, `roomLink`, `ROOM_KEY`, the `?room=` link reading.

- [ ] **Step 5: `NewGameDialog` and `App` wiring**
  - Dialog: `role="dialog"` named by its title, two large choice buttons (label + hint) and Cancel, styled like the existing header panel (`rounded-counter border-2 border-line-strong bg-surface-raised`), fixed and centred with a backdrop that cancels on tap.
  - `App`: `useRoom(server)`. When `sync` is null, `onNewGame` does exactly what it does today. Otherwise it opens the dialog; on choice: `sync.newGame(mode)`, `myHand.clear()`, `dismissToast()`, `setTab('cards')`. Remove the `RoomButton` render and import; delete `RoomButton.tsx`.

- [ ] **Step 6: Run** `pnpm test` and `pnpm exec tsc -b` — Expected: all pass.

- [ ] **Step 7: Commit** — `git commit -m "Choose Offline or Online at New Game; one online game instead of rooms"`

---

### Task 4: The people panel — check, join, turn sync off

**Files:**
- Create: `src/lib/useOnlineGame.ts`, `src/components/SyncButton.tsx`
- Modify: `src/App.tsx`, `src/copy.ts`, `src/Sync.test.tsx`

**Interfaces:**
- Consumes: `RoomSync` (Task 3), `SyncServer` (Task 2), `useConfirmTap`, `ConfirmCaption`.
- Produces:

```ts
export const CHECK_TIMEOUT_MS = 5000
export type OnlineCheck =
  | { status: 'checking' } | { status: 'none' } | { status: 'unreachable' }
  | { status: 'found'; game: OnlineGame }
/** Watches the online game while `enabled`; 'unreachable' when nothing has answered after CHECK_TIMEOUT_MS. */
export function useOnlineGame(server: SyncServer, enabled: boolean): OnlineCheck
export function SyncButton({ sync, notify }: { sync: RoomSync; notify: (toast: Toast) => void }): JSX.Element
```

- [ ] **Step 1: Add copy** to `src/copy.ts` as `sync`:

```ts
sync: {
  open: 'Wspólna gra',
  title: 'Wspólna gra',
  close: 'Zamknij',
  online: 'Ten telefon: online',
  offline: 'Ten telefon: offline',
  connected: 'Połączono',
  disconnected: 'Brak połączenia: zmiany zostaną wysłane po powrocie',
  loading: 'Wczytywanie gry, zmiany na razie zablokowane',
  missing: 'Na serwerze nie ma gry online',
  leave: 'Wyłącz synchronizację',
  left: 'Synchronizacja wyłączona: grasz offline',
  checking: 'Sprawdzanie gry online…',
  none: 'Nie ma gry online. Zacznij ją przez Nowa gra → Online.',
  unreachable: 'Brak połączenia z serwerem',
  found: (turn: number, ago: string) => `Gra online: tura ${turn}, ostatnia zmiana ${ago}`,
  ago: (minutes: number) =>
    minutes < 1 ? 'przed chwilą' : minutes < 60 ? `${minutes} min temu` : `${Math.floor(minutes / 60)} godz. temu`,
  join: 'Dołącz',
  joinWarning: 'Gra na tym telefonie zostanie zastąpiona i nie da się jej odzyskać.',
  joined: 'Dołączono do gry online',
},
```

- [ ] **Step 2: Write failing tests** in `src/Sync.test.tsx` (panel opened with the header button named `copy.sync.open`):
  - `offline panel finds the online game and joins after two taps` — fake holds a turn-3 game updated 2 min ago; local game at turn 1 with a roll: open panel → text `copy.sync.found(3, '2 min temu')`, `copy.sync.joinWarning` visible; one tap on `Dołącz` doesn't join (armed); second tap → Cards tab shows turn 3, roll gone, mode `'online'`, toast `copy.sync.joined`.
  - `join takes the latest online game` — open panel, first tap, `fake.replace` with a turn-4 game, second tap → turn 4 shown. *(Review Focus 5)*
  - `offline panel says when there is no online game` — fake with `null` → `copy.sync.none`, no `Dołącz` button.
  - `offline panel gives up after CHECK_TIMEOUT_MS` — `fakeServer(game, { held: true })`: after `CHECK_TIMEOUT_MS` → `copy.sync.unreachable`.
  - `closing the panel on an offline phone closes the connection` — open → `fake.open === true`; close → `fake.open === false` (advance timers one tick). *(Review Focus 4)*
  - `online panel turns sync off and keeps the game` — synced phone at turn 3; `fake.setConnected(false)`; advance to turn 4 (the fake still applies it, as Convex's optimistic update would); tap `copy.sync.leave` → mode `'offline'`, `fake.open === false`, screen unchanged, later changes don't reach `fake.game`, toast `copy.sync.left`. *(Review Focus 2)*
  - `rejoin after turning sync off` — then open panel → `found` shown → join → back online.
  - `the icon marks a lost connection only while online` — the CloudOff mark (give it `data-testid="sync-offline-mark"`) present when online + disconnected; absent when offline.

- [ ] **Step 3: Run** `pnpm test src/Sync.test.tsx` — Expected: new tests FAIL.

- [ ] **Step 4: Implement `useOnlineGame`** — `watch` while `enabled`, stop on disable/unmount; start `'checking'`, timer to `'unreachable'` cleared by any `onGame`.

- [ ] **Step 5: Implement `SyncButton`** — header button keeps today's size/classes and `Users` icon; online gets a gold accent (`border-gold`), offline the muted style; `CloudOff` mark only when `mode === 'online' && !connected`. Panel layout as today's `RoomButton` (title row, close, tap-outside closes).
  - Offline body: `copy.sync.offline`, then by `useOnlineGame(sync.server, open && mode === 'offline')` status: checking / none / unreachable text, or `found` line + warning + `Dołącz` (two taps with `useConfirmTap`, `ConfirmCaption`); confirm → `sync.join(latest game)`, close panel, toast.
  - Online body: `copy.sync.online`, status line (`missing` › `!connected` › `!live` › connected), `Wyłącz synchronizację` button → `sync.leave()`, close, toast.
  - Minutes for `ago`: `Math.floor((Date.now() - updatedAt) / 60000)`.

- [ ] **Step 6: Render** `{sync && <SyncButton sync={sync} notify={showToast} />}` in `App.tsx` where `RoomButton` was.

- [ ] **Step 7: Run** `pnpm test` and `pnpm exec tsc -b` — Expected: all pass.

- [ ] **Step 8: Commit** — `git commit -m "Join the online game or turn sync off from the people icon"`

---

### Task 5: Remove what rooms left behind

**Files:**
- Delete: `convex/rooms.ts`
- Modify: `convex/schema.ts` (drop `rooms`), `src/lib/room.ts`, `src/lib/room.test.ts`, `src/copy.ts`, `README.md`, regenerate `convex/_generated`

- [ ] **Step 1:** Remove `makeRoomCode`, `normalizeRoomCode`, `CODE_ALPHABET`, `CODE_LENGTH`, `withMoves` (only the old server used it — check with grep) from `room.ts` and their tests; remove `copy.room`; update doc comments in `room.ts` that mention "room codes"/"per room code" to "the online game".
- [ ] **Step 2:** Drop `rooms` from `convex/schema.ts`, delete `convex/rooms.ts`, run `pnpm exec convex codegen`. If a Convex deploy later refuses because the `rooms` table still has documents, clear that table in the Convex dashboard (dev and prod) — the data is not needed.
- [ ] **Step 3:** README: add a short "Sync" section — New Game asks Offline/Online; the people icon joins the online game or turns sync off; offline never contacts the server.
- [ ] **Step 4: Verify** — `grep -rn "roomLink\|RoomButton\|normalizeRoomCode\|api.rooms" src convex` → no matches; `pnpm test` all pass; `pnpm build` succeeds.
- [ ] **Step 5: Commit** — `git commit -m "Drop room codes and the rooms table"`
