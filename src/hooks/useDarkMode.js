import { useState, useEffect } from 'react'

export function useDarkMode() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem('gentek-theme')
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
      localStorage.setItem('gentek-theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('gentek-theme', 'light')
    }
  }, [dark])

  return [dark, setDark]
}
