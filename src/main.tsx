import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/big-shoulders-stencil-display/800'
import '@fontsource/ibm-plex-sans/400'
import '@fontsource/ibm-plex-sans/600'
import '@fontsource/ibm-plex-sans-condensed/600'
import '@fontsource/ibm-plex-mono/400'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
