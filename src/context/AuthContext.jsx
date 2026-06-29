import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

function getGroup(ts) {
  const now  = Date.now()
  const diff = now - ts
  const day  = 86400000
  if (diff < day)     return 'Today'
  if (diff < day * 2) return 'Yesterday'
  return 'Previous 7 Days'
}

const DOT = {
  'MALE-BIASED':    'bg-blue-400',
  'FEMALE-BIASED':  'bg-rose-400',
  'GENDER-NEUTRAL': 'bg-brand-400',
  'MIXED-BIAS':     'bg-yellow-400',
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const s = localStorage.getItem('gentek-user')
      return s ? JSON.parse(s) : null
    } catch { return null }
  })

  const [history, setHistory] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [pricingOpen, setPricingOpen] = useState(false)

  // Load history from DB when user logs in
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

  const logout = () => {
    setUser(null)
    setHistory([])
    localStorage.removeItem('gentek-user')
  }

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

  const addToHistory = async (text, results) => {
    const item = {
      id:             Date.now(),
      label:          text.slice(0, 48).trim() + (text.length > 48 ? '…' : ''),
      text,
      score:          results.score,
      classification: results.label,
      dot:            DOT[results.label] || 'bg-gray-400',
      timestamp:      Date.now(),
    }

    // Optimistic update in UI
    setHistory(prev => [item, ...prev.filter(h => h.text !== text)].slice(0, 20))

    // Save to database if user is logged in
    if (user?.id) {
      fetch(`/auth/history/${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label:          item.label,
          text:           item.text,
          score:          item.score,
          classification: item.classification,
        }),
      }).catch(() => {})
    }
  }

  const toggleSidebar = () => setSidebarOpen(o => !o)
  const openPricing   = () => setPricingOpen(true)
  const closePricing  = () => setPricingOpen(false)

  const historyWithGroups = history.map(h => ({ ...h, group: getGroup(h.timestamp) }))

  return (
    <AuthContext.Provider value={{
      user, login, register, logout, updateUser,
      history: historyWithGroups, addToHistory,
      sidebarOpen, toggleSidebar,
      pricingOpen, openPricing, closePricing,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
