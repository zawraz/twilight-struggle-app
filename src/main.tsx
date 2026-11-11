import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/big-shoulders-stencil-display/800'
import '@fontsource/ibm-plex-sans/400'
import '@fontsource/ibm-plex-sans/600'
import '@fontsource/ibm-plex-sans-condensed/600'
import '@fontsource/ibm-plex-mono/400'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'

// An installed PWA resumed from the background never re-navigates, so the browser
// would not look for a new deploy on its own. Check on resume and once a day;
// with autoUpdate, a new service worker takes over and the page reloads itself.
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    const check = () => registration.update()
    setInterval(check, 24 * 60 * 60 * 1000)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
