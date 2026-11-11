# Twilight Struggle App

A single-screen PWA to keep beside a game of Twilight Struggle (Deluxe Edition). Unofficial fan tool.

- **4 Ops Cards**: count the 4 Ops cards each side has played. `−` asks for a second tap before it subtracts.
- **Success Rolls**: pick −5…+5 on a wheel and confirm; each side's sum stays hidden until **End**. The log shows the last 3 rolls.
- **Dice EV**: pick 1–6 and add; each side's average stays hidden until **End**.
- **End / New Game** (header): End asks for a second tap, then reveals the results and locks the trackers; New Game asks **Offline** or **Online**.

Progress is saved in `localStorage` on every change and restored on launch, until New Game.

## Sync

Two phones can share one game through a [Convex](https://convex.dev) server, which keeps exactly one online game.

- **New Game → Online** replaces the online game with a fresh one and syncs this phone to it; a phone already synced resets too.
- **New Game → Offline** starts a game on this phone alone. An offline phone never contacts the server.
- **The people icon** in the header: on an offline phone it looks for the online game and offers to **join** it (two taps; this phone's game is replaced for good). On a synced phone it shows the connection and turns sync off, keeping the game on screen; the online game stays for the other phone, and either can rejoin later.

Without `VITE_CONVEX_URL` (tests, or a checkout with no `.env.local`) there is no sync: New Game is one tap and the people icon is hidden.

React + TypeScript + Tailwind CSS v4, built with Vite and `vite-plugin-pwa` (offline, installable). Styling follows the Twilight Struggle App design system.

## Scripts

```sh
pnpm install
pnpm dev         # dev server + `convex dev` (syncs convex/ to the dev deployment)
pnpm dev:app     # dev server only
pnpm test        # Vitest + Testing Library
pnpm build       # type-check, build, generate the service worker
pnpm preview     # serve the production build
```
