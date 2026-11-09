import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Tests play the game on the device: no sync server, whatever .env.local points at.
    env: { VITE_CONVEX_URL: '' },
  },
})
