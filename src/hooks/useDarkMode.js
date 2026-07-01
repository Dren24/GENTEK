// ── useDarkMode hook ─────────────────────────────────────────────────────────
// Reads/writes dark mode preference from localStorage under 'gentek-theme'.
// Falls back to the OS prefers-color-scheme on first visit (no stored value).
// Toggles the 'dark' class on <html> so Tailwind darkMode: 'class' picks it up.
// Multiple component instances stay in sync via a CustomEvent broadcast.

import { useState, useEffect } from 'react'

const EVENT = 'gentek-theme-change'

export function useDarkMode() {
  // ── Initial value: localStorage → OS preference → false (light) ──────────
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem('gentek-theme')
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  // ── Sync 'dark' class on <html>, persist, and notify other instances ──────
  useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
      localStorage.setItem('gentek-theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('gentek-theme', 'light')
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: dark }))
  }, [dark])

  // ── Listen for changes from other mounted instances in the same tab ───────
  useEffect(() => {
    const handler = (e) => setDark(prev => prev !== e.detail ? e.detail : prev)
    window.addEventListener(EVENT, handler)
    return () => window.removeEventListener(EVENT, handler)
  }, [])

  return [dark, setDark]
}
