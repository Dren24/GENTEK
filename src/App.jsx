// ── Root app component ────────────────────────────────────────────────────────
// Handles global layout: sidebar offset, shared Navbar/Footer, route definitions,
// and the global PricingModal overlay. Pages with their own full-screen layout
// (like /dashboard) bypass the shared shell entirely.

import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Navbar        from './components/shared/Navbar'
import Footer        from './components/shared/Footer'
import AppSidebar    from './components/shared/AppSidebar'
import PricingModal  from './components/shared/PricingModal'
import HomePage     from './pages/HomePage'
import PricingPage  from './pages/PricingPage'
import AboutPage    from './pages/AboutPage'
import ContactPage  from './pages/ContactPage'
import DashboardPage  from './pages/DashboardPage'
import SettingsPage   from './pages/SettingsPage'
import { useAuth }  from './context/AuthContext'

// ── ScrollToTop — resets scroll on route change, or scrolls to hash section ───
function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      // Scroll to the section id after the page renders
      const timer = setTimeout(() => {
        const el = document.getElementById(hash.slice(1))
        if (el) el.scrollIntoView({ behavior: 'smooth' })
        else window.scrollTo(0, 0)
      }, 100)
      return () => clearTimeout(timer)
    } else {
      window.scrollTo(0, 0)
    }
  }, [pathname, hash])
  return null
}

// ── useScrollReveal — adds 'visible' to .reveal elements when they enter view ──
// Re-runs on pathname OR user changes so newly rendered sections (e.g. guest
// sections that appear after logout) are picked up by the observer.
function useScrollReveal(user) {
  const { pathname } = useLocation()
  useEffect(() => {
    const run = () => {
      const observer = new IntersectionObserver(
        (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible') }),
        { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
      )
      document.querySelectorAll('.reveal').forEach((el) => observer.observe(el))
      return observer
    }
    let obs
    const timer = setTimeout(() => { obs = run() }, 100)
    return () => { clearTimeout(timer); obs?.disconnect() }
  }, [pathname, user])
}

// ── Pages that use their own full-screen layout (no shared navbar/footer/sidebar)
const HIDE_SHELL = ['/detector', '/dashboard']

export default function App() {
  const { pathname }              = useLocation()
  const { user, sidebarOpen }     = useAuth()
  useScrollReveal(user)

  const hideShell   = HIDE_SHELL.includes(pathname)
  const showSidebar = user && !hideShell

  // ── Sidebar width: 256px when open, 48px collapsed icon rail ─────────────
  const sidebarW = showSidebar ? (sidebarOpen ? 256 : 48) : 0

  return (
    <>
      <ScrollToTop />

      {/* ── Persistent sidebar — logged-in users only, not on tool pages ─── */}
      {showSidebar && <AppSidebar />}

      {/* ── Global pricing modal overlay (z-60) ──────────────────────────── */}
      <PricingModal />

      {/* ── Main content area — offset left by sidebar width ─────────────── */}
      <div
        className="transition-all duration-300"
        style={{ marginLeft: sidebarW }}
      >
        {!hideShell && <Navbar />}

        {/* ── Route definitions ────────────────────────────────────────────── */}
        <Routes>
          <Route path="/"          element={<HomePage />} />
          {/* /detector redirects to / — old URL from previous layout */}
          <Route path="/detector"  element={<Navigate to="/" replace />} />
          <Route path="/pricing"   element={<PricingPage />} />
          <Route path="/about"     element={<AboutPage />} />
          <Route path="/contact"   element={<ContactPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/settings"  element={<SettingsPage />} />
        </Routes>

        {!hideShell && <Footer />}
      </div>
    </>
  )
}
