import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { installBrowserPreviewBridge } from './browser-preview'
import './styles.css'
import './app-shell.css'
import './theme.css'

if (import.meta.env.VITE_ALPHA_K_BROWSER_PREVIEW === 'true') installBrowserPreviewBridge()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
