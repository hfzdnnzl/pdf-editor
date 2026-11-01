import { createRoot } from 'react-dom/client'
import '@fontsource/caveat/400.css'
import '@fontsource/great-vibes/400.css'
import './styles/tokens.css'
import './styles/app.css'
import App from './App'
import { useDocumentStore } from './state/documentStore'
import { useUiStore } from './state/uiStore'

if (import.meta.env.DEV) {
  // Debug handle for the browser preview and e2e smoke checks.
  Object.assign(window, { __pdfStudio: { document: useDocumentStore, ui: useUiStore } })
}

const container = document.getElementById('root')
if (!container) throw new Error('Root element is missing')

createRoot(container).render(<App />)
