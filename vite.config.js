// ── Vite config (frontend dev server + build) ─────────────────────────────────
// In development (npm run dev) the React app runs on :5173 and these proxy
// rules forward API calls to the FastAPI backend on :8000, so the frontend can
// call '/analyze' and '/auth/...' with relative URLs. In production the
// backend serves the built app itself, so the same URLs work unchanged.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/analyze': 'http://localhost:8000',
      '/health':  'http://localhost:8000',
      '/auth':    { target: 'http://localhost:8000', changeOrigin: true },
      '/payments': { target: 'http://localhost:8000', changeOrigin: true },
      '/uploads':  { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
