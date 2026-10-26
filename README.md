# Twilight Struggle Companion

A single-screen PWA to keep beside a game of Twilight Struggle (Deluxe Edition). Unofficial fan tool.

- **4 Ops Cards**: count the 4 Ops cards each side has played. `−` asks for a second tap before it subtracts.
- **Success Rolls**: pick −5…+5 on a wheel and confirm; each side's sum stays hidden until **End**. The log shows the last 3 rolls.
- **Dice EV**: pick 1–6 and add; each side's average stays hidden until **End**.
- **End / New Game** (header): End asks for a second tap, then reveals the results and locks the trackers; New Game clears everything in one tap.

Progress is saved in `localStorage` on every change and restored on launch, until New Game.

React + TypeScript + Tailwind CSS v4, built with Vite and `vite-plugin-pwa` (offline, installable). Styling follows the Twilight Struggle Companion design system.

## Scripts

```sh
npm install
npm run dev      # dev server
npm test         # Vitest + Testing Library
npm run build    # type-check, build, generate the service worker
npm run preview  # serve the production build
```
