import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

function getGroup(ts) {
  const now   = Date.now()
  const diff  = now - ts
  const day   = 86400000
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

  const [history, setHistory] = useState(() => {
    try {
      const s = localStorage.getItem('gentek-history')
      return s ? JSON.parse(s) : []
    } catch { return [] }
  })

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [pricingOpen, setPricingOpen] = useState(false)

  const login = (u) => {
    setUser(u)
    localStorage.setItem('gentek-user', JSON.stringify(u))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('gentek-user')
  }

  const updateUser = (updates) => {
    const updated = { ...user, ...updates }
    setUser(updated)
    localStorage.setItem('gentek-user', JSON.stringify(updated))
  }

  const addToHistory = (text, results) => {
    const item = {
      id:             Date.now(),
      label:          text.slice(0, 48).trim() + (text.length > 48 ? '…' : ''),
      text,
      score:          results.score,
      classification: results.label,
      dot:            DOT[results.label] || 'bg-gray-400',
      timestamp:      Date.now(),
    }
    setHistory(prev => {
      const next = [item, ...prev.filter(h => h.text !== text)].slice(0, 20)
      localStorage.setItem('gentek-history', JSON.stringify(next))
      return next
    })
  }

  const toggleSidebar = () => setSidebarOpen(o => !o)
  const openPricing   = () => setPricingOpen(true)
  const closePricing  = () => setPricingOpen(false)

  const historyWithGroups = history.map(h => ({ ...h, group: getGroup(h.timestamp) }))

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, history: historyWithGroups, addToHistory, sidebarOpen, toggleSidebar, pricingOpen, openPricing, closePricing }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
