import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icon.svg', 'icon-maskable.svg'],
      manifest: {
        name: 'Zimna Wojna',
        short_name: 'Zimna Wojna',
        description: 'Pomocnik do gry Zimna Wojna: karty 4 PO, rzuty na sukces i EV rzutów.',
        lang: 'pl',
        theme_color: '#0f151c',
        background_color: '#0f151c',
        display: 'standalone',
        // One layout, held upright: an installed app doesn't turn with the phone.
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
    }),
  ],
})
