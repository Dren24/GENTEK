import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Navbar        from './components/shared/Navbar'
import Footer        from './components/shared/Footer'
import AppSidebar    from './components/shared/AppSidebar'
import PricingModal  from './components/shared/PricingModal'
import HomePage     from './pages/HomePage'
import DetectorPage from './pages/DetectorPage'
import PricingPage  from './pages/PricingPage'
import AboutPage    from './pages/AboutPage'
import ContactPage  from './pages/ContactPage'
import DashboardPage  from './pages/DashboardPage'
import SettingsPage   from './pages/SettingsPage'
import { useAuth }  from './context/AuthContext'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function useScrollReveal() {
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
    const timer = setTimeout(() => { const obs = run(); return () => obs.disconnect() }, 100)
    return () => clearTimeout(timer)
  }, [pathname])
}

// Pages that have their own full-screen layout (no shared navbar/footer/sidebar)
const HIDE_SHELL = ['/detector', '/dashboard']

export default function App() {
  const { pathname }              = useLocation()
  const { user, sidebarOpen }     = useAuth()
  useScrollReveal()

  const hideShell   = HIDE_SHELL.includes(pathname)
  const showSidebar = user && !hideShell

  // Sidebar width: 256px open, 48px collapsed icon rail
  const sidebarW = showSidebar ? (sidebarOpen ? 256 : 48) : 0

  return (
    <>
      <ScrollToTop />

      {/* Persistent sidebar for logged-in users (not on tool pages) */}
      {showSidebar && <AppSidebar />}

      {/* Global pricing modal */}
      <PricingModal />

      {/* Main content — offset by sidebar width */}
      <div
        className="transition-all duration-300"
        style={{ marginLeft: sidebarW }}
      >
        {!hideShell && <Navbar />}
        <Routes>
          <Route path="/"          element={<HomePage />} />
          <Route path="/detector"  element={<DetectorPage />} />
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
