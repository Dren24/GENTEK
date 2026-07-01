// ── AuthContext ───────────────────────────────────────────────────────────────
// Global state for user session, analysis history, sidebar toggle, and pricing
// modal visibility. Persists the logged-in user to localStorage so the session
// survives page refresh. History is loaded from the backend on login.

import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

// ── getGroup — buckets a JS timestamp into sidebar date group labels ──────────
function getGroup(ts) {
  const now  = Date.now()
  const diff = now - ts
  const day  = 86400000
  if (diff < day)     return 'Today'
  if (diff < day * 2) return 'Yesterday'
  return 'Previous 7 Days'
}

// ── DOT — maps bias classification to sidebar indicator dot color ─────────────
const DOT = {
  'MALE-BIASED':    'bg-blue-400',
  'FEMALE-BIASED':  'bg-rose-400',
  'GENDER-NEUTRAL': 'bg-brand-400',
  'MIXED-BIAS':     'bg-yellow-400',
}

export function AuthProvider({ children }) {
  // ── User state — hydrated from localStorage on first render ──────────────
  const [user, setUser] = useState(() => {
    try {
      const s = localStorage.getItem('gentek-user')
      return s ? JSON.parse(s) : null
    } catch { return null }
  })

  // ── Analysis history shown in the sidebar ─────────────────────────────────
  const [history, setHistory] = useState([])

  // ── lastDeletedId — signals HomePage to clear editor when sidebar deletes ──
  const [lastDeletedId, setLastDeletedId] = useState(null)

  // ── Sidebar open/collapsed state ──────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // ── Pricing modal open/closed state ──────────────────────────────────────
  const [pricingOpen, setPricingOpen] = useState(false)

  // ── Fetch history from DB when user logs in (or changes) ─────────────────
  useEffect(() => {
    if (!user?.id) { setHistory([]); return }
    fetch(`/auth/history/${user.id}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setHistory(data.map(h => ({
            ...h,
            dot: DOT[h.classification] || 'bg-gray-400',
          })))
        }
      })
      .catch(() => {})
  }, [user?.id])

  // ── login — POST /auth/login, persist user to localStorage ───────────────
  const login = async (email, password) => {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.detail || 'Login failed')
    }
    const u = await res.json()
    setUser(u)
    localStorage.setItem('gentek-user', JSON.stringify(u))
    return u
  }

  // ── register — POST /auth/register, auto-login after success ─────────────
  const register = async (name, email, password) => {
    const res = await fetch('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.detail || 'Registration failed')
    }
    const u = await res.json()
    setUser(u)
    localStorage.setItem('gentek-user', JSON.stringify(u))
    return u
  }

  // ── logout — clear user and history from memory and localStorage ──────────
  const logout = () => {
    setUser(null)
    setHistory([])
    localStorage.removeItem('gentek-user')
  }

  // ── updateUser — PUT /auth/update/{id}, update display name only ──────────
  const updateUser = async (updates) => {
    if (!user?.id) return
    const res = await fetch(`/auth/update/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: updates.name ?? user.name, email: user.email, password: '' }),
    })
    if (res.ok) {
      const updated = { ...user, ...updates }
      setUser(updated)
      localStorage.setItem('gentek-user', JSON.stringify(updated))
    }
  }

  // ── addToHistory — optimistic insert, then syncs with DB ─────────────────
  // Uses a local timestamp as a temp id; replaces it with the DB id on success.
  // Returns the final id so HomePage can track the current entry for updates.
  const addToHistory = async (text, results) => {
    const localId = Date.now()
    const item = {
      id:             localId,
      label:          text.slice(0, 48).trim() + (text.length > 48 ? '…' : ''),
      text,
      score:          results.score,
      classification: results.label,
      dot:            DOT[results.label] || 'bg-gray-400',
      timestamp:      localId,
    }

    // ── Optimistic UI: add to top, deduplicate by text ────────────────────
    setHistory(prev => [item, ...prev.filter(h => h.text !== text)].slice(0, 20))

    // ── Persist to DB and swap temp id for real DB id ─────────────────────
    if (user?.id) {
      try {
        const res = await fetch(`/auth/history/${user.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label:          item.label,
            text:           item.text,
            score:          item.score,
            classification: item.classification,
          }),
        })
        const data = await res.json()
        if (data.id && data.id !== localId) {
          setHistory(prev => prev.map(h => h.id === localId ? { ...h, id: data.id } : h))
          return data.id
        }
      } catch {}
    }
    return localId
  }

  // ── updateHistory — re-analyze same entry: update score & classification ──
  // Called when currentHistoryIdRef is set (user re-ran analysis on loaded text).
  const updateHistory = (id, results) => {
    setHistory(prev => prev.map(h =>
      h.id === id
        ? { ...h, score: results.score, classification: results.label, dot: DOT[results.label] || 'bg-gray-400' }
        : h
    ))
    if (user?.id) {
      fetch(`/auth/history/${user.id}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: results.score, classification: results.label }),
      }).catch(() => {})
    }
  }

  // ── deleteHistory — remove entry from sidebar and DB ─────────────────────
  // Sets lastDeletedId so HomePage can clear the editor if that entry is open.
  const deleteHistory = (id) => {
    setHistory(prev => prev.filter(h => h.id !== id))
    setLastDeletedId(id)
    if (user?.id) {
      fetch(`/auth/history/${user.id}/${id}`, { method: 'DELETE' }).catch(() => {})
    }
  }

  // ── deleteAccount — permanently remove account from DB then log out ─────────
  const deleteAccount = async () => {
    if (!user?.id) return
    await fetch(`/auth/delete/${user.id}`, { method: 'DELETE' }).catch(() => {})
    logout()
  }

  // ── Sidebar and pricing modal helpers ─────────────────────────────────────
  const toggleSidebar = () => setSidebarOpen(o => !o)
  const openPricing   = () => setPricingOpen(true)
  const closePricing  = () => setPricingOpen(false)

  // ── Attach group label to each history item for sidebar section headers ───
  const historyWithGroups = history.map(h => ({ ...h, group: getGroup(h.timestamp) }))

  return (
    <AuthContext.Provider value={{
      user, login, register, logout, updateUser, deleteAccount,
      history: historyWithGroups, addToHistory, updateHistory, deleteHistory, lastDeletedId,
      sidebarOpen, toggleSidebar,
      pricingOpen, openPricing, closePricing,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// ── useAuth — consume AuthContext in any component ────────────────────────────
export const useAuth = () => useContext(AuthContext)
