// ── AuthContext ───────────────────────────────────────────────────────────────
// Global state for user session, analysis history, sidebar toggle, and pricing
// modal visibility. Persists the logged-in user so the session survives page
// refresh — localStorage when "Remember me" is checked (survives closing the
// browser), sessionStorage otherwise (cleared when the tab/browser closes).
// History is loaded from the backend on login.

import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

// ── persistSession — writes user+token to the storage matching `remember`,
// and clears any stale copy from the other one so there's only ever one
// active session at a time. ───────────────────────────────────────────────────
function persistSession(user, token, remember) {
  const store = remember ? localStorage : sessionStorage
  const other = remember ? sessionStorage : localStorage
  store.setItem('gentek-user', JSON.stringify(user))
  store.setItem('gentek-token', token)
  other.removeItem('gentek-user')
  other.removeItem('gentek-token')
}

// ── loadSession — checks localStorage first, then sessionStorage, for a
// valid user+token pair. Returns which one it came from so later profile
// updates know where to write back to. ────────────────────────────────────────
function loadSession() {
  for (const [store, remember] of [[localStorage, true], [sessionStorage, false]]) {
    const token = store.getItem('gentek-token')
    const userStr = store.getItem('gentek-user')
    if (token && userStr) {
      try { return { user: JSON.parse(userStr), token, remember } } catch { /* fall through */ }
    }
  }
  return { user: null, token: null, remember: true }
}

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
  // ── User + token — hydrated from whichever storage (local/session) actually
  // holds a live session on first render. ───────────────────────────────────
  const [user, setUser] = useState(() => loadSession().user)
  const [token, setToken] = useState(() => loadSession().token)

  // ── Whether the active session was "remembered" — decides which storage
  // profile updates (name, notifications) get written back to. ────────────
  const [rememberMe, setRememberMe] = useState(() => loadSession().remember)

  // ── authHeader — returns Authorization header if token is present ─────────
  const authHeader = () => token ? { 'Authorization': `Bearer ${token}` } : {}

  // ── authFetch — fetch with auth header; force-logout on 401 (expired/invalid token) ──
  const authFetch = async (url, options = {}) => {
    const res = await fetch(url, { ...options, headers: { ...options.headers, ...authHeader() } })
    if (res.status === 401) logout()
    return res
  }

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
    authFetch(`/auth/history/${user.id}`)
      .then(r => r.ok ? r.json() : [])
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

  // ── login — POST /auth/login. `remember` decides localStorage (survives
  // closing the browser) vs sessionStorage (cleared when the tab/browser
  // closes) — the password itself is never stored client-side either way. ──
  const login = async (email, password, remember = true) => {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, remember }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.detail || 'Login failed')
    }
    const data = await res.json()
    const { token: t, ...u } = data
    setUser(u)
    setToken(t)
    setRememberMe(remember)
    persistSession(u, t, remember)
    return u
  }

  // ── loginWithGoogle — POST /auth/google with the OAuth access token from
  // Google Identity Services. Backend verifies it and finds-or-creates the
  // account; this only ever handles the resulting GENTEK session, exactly
  // like email/password login — no Google credentials touch localStorage. ──
  const loginWithGoogle = async (accessToken, remember = true) => {
    const res = await fetch('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken, remember }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Google sign-in failed')
    }
    const data = await res.json()
    const { token: t, ...u } = data
    setUser(u)
    setToken(t)
    setRememberMe(remember)
    persistSession(u, t, remember)
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
    const data = await res.json()
    const { token: t, ...u } = data
    setUser(u)
    setToken(t)
    setRememberMe(true)
    persistSession(u, t, true)
    return u
  }

  // ── logout — clear user, token, and history from memory and both storages ──
  const logout = () => {
    setUser(null)
    setToken(null)
    setHistory([])
    setRememberMe(true)
    localStorage.removeItem('gentek-user')
    localStorage.removeItem('gentek-token')
    sessionStorage.removeItem('gentek-user')
    sessionStorage.removeItem('gentek-token')
  }

  // ── updateUser — PUT /auth/update/{id}, update display name only ──────────
  const updateUser = async (updates) => {
    if (!user?.id) return
    const res = await authFetch(`/auth/update/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: updates.name ?? user.name, email: user.email, password: '' }),
    })
    if (res.ok) {
      const updated = { ...user, ...updates }
      setUser(updated)
      ;(rememberMe ? localStorage : sessionStorage).setItem('gentek-user', JSON.stringify(updated))
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
        const res = await authFetch(`/auth/history/${user.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label:          item.label,
            text:           item.text,
            score:          item.score,
            classification: item.classification,
          }),
        })
        // Only parse body when request succeeded — non-ok bodies may not be JSON
        if (res.ok) {
          const data = await res.json()
          if (data.id && data.id !== localId) {
            setHistory(prev => prev.map(h => h.id === localId ? { ...h, id: data.id } : h))
            return data.id
          }
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
      authFetch(`/auth/history/${user.id}/${id}`, {
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
      authFetch(`/auth/history/${user.id}/${id}`, { method: 'DELETE' }).catch(() => {})
    }
  }

  // ── updateNotifications — toggle email notifications and persist to DB ───────
  const updateNotifications = async (value) => {
    if (!user?.id) return
    const updated = { ...user, email_notifications: value }
    setUser(updated)
    ;(rememberMe ? localStorage : sessionStorage).setItem('gentek-user', JSON.stringify(updated))
    await authFetch(`/auth/notifications/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_notifications: value }),
    }).catch(() => {})
  }

  // ── upgradeToPremium — PUT /auth/upgrade/{id}, called when the checkout
  // flow (PaymentModal) completes; grants Premium immediately — see
  // backend/auth.py for why there's no real payment gateway behind this. ────
  const upgradeToPremium = async () => {
    if (!user?.id) return
    const res = await authFetch(`/auth/upgrade/${user.id}`, { method: 'PUT' })
    if (!res.ok) throw new Error('Could not activate Premium')
    const updated = { ...user, is_premium: true }
    setUser(updated)
    ;(rememberMe ? localStorage : sessionStorage).setItem('gentek-user', JSON.stringify(updated))
  }

  // ── deleteAccount — permanently remove account from DB then log out ─────────
  const deleteAccount = async () => {
    if (!user?.id) return
    await authFetch(`/auth/delete/${user.id}`, { method: 'DELETE' }).catch(() => {})
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
      user, token, authHeader, login, loginWithGoogle, register, logout, updateUser, updateNotifications, upgradeToPremium, deleteAccount,
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
