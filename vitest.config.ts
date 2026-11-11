import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'app',
          include: ['src/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          css: false,
          // Tests play the game on the device: no sync server, whatever .env.local points at.
          env: { VITE_CONVEX_URL: '' },
        },
      },
      {
        // The server's functions, run by convex-test in the runtime Convex uses.
        test: {
          name: 'convex',
          include: ['convex/**/*.test.ts'],
          environment: 'edge-runtime',
          server: { deps: { inline: ['convex-test'] } },
        },
      },
    ],
  },
})
