// ── App entry point ──────────────────────────────────────────────────────────
// Mounts the React app into #root with BrowserRouter, AuthProvider, and StrictMode.
// AuthProvider must sit inside BrowserRouter so it can use useNavigate internally.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* BrowserRouter wraps AuthProvider so navigate() is available inside context */}
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
