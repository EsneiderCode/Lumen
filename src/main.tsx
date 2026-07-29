import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted fonts — served locally, cached by service worker
// NEXUS Brand System 2026: Space Grotesk (display) + Inter (text) + JetBrains Mono (data)
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/700.css'
import './index.css'
import './i18n'
import App from './App'
import { installStaleChunkRecovery } from '@/lib/staleChunk'

// Before rendering: a deploy that happened while this tab was open leaves it
// asking for chunks that no longer exist, and that must not surface as an error.
installStaleChunkRecovery()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
