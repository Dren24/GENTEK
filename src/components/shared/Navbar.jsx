// ── Navbar ────────────────────────────────────────────────────────────────────
// Fixed top bar (z-30). Layout differs for guests vs logged-in users:
//   Guests  — logo left, dark mode toggle + Log in / Sign up buttons right
//   Logged-in — no logo (sidebar shows it), Gift icon (pricing) + Temp chat button

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sun, Moon, List, X, Gear, SignOut, Gift, ChatCircle } from '@phosphor-icons/react'
import { useDarkMode } from '../../hooks/useDarkMode'
import { GentekWordmark } from './GentekLogo'
import AuthModal from './AuthModal'
import { useAuth } from '../../context/AuthContext'

// ── UserMenu — avatar button with settings / sign-out dropdown ────────────────
// Shows the user's initial letter as the avatar. Opens a small dropdown panel.
function UserMenu({ user, logout }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const initial = user?.name?.charAt(0).toUpperCase() || '?'

  return (
    <div className="relative">
      {/* Avatar button — shows first letter of user's name */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title={user?.name}
      >
        <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-white">{initial}</span>
        </div>
      </button>

      {open && (
        <>
          {/* Click-outside overlay to close dropdown */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

          {/* ── Dropdown panel ─────────────────────────────────────────────── */}
          <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-card-hover py-1.5 z-20">
            {/* User name and email header */}
            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
              <p className="text-xs font-semibold text-gray-800 dark:text-white truncate">{user?.name}</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{user?.email}</p>
            </div>

            {/* Settings link */}
            <button
              onClick={() => { navigate('/settings'); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Gear size={14} />Settings
            </button>

            {/* Sign out — clears session and redirects to homepage */}
            <button
              onClick={() => { logout(); setOpen(false); navigate('/') }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors rounded-b-2xl"
            >
              <SignOut size={14} />Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── TempChatModal — explains what temporary session means before starting ──────
// Clicking Start navigates to / with { tempChat: true } so HomePage won't save results.
function TempChatModal({ onClose, onStart }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 w-full max-w-sm p-6">
        {/* Close X button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <X size={14} weight="bold" />
        </button>

        {/* Dashed circle icon — visual cue for "temporary / ephemeral" */}
        <div className="w-10 h-10 rounded-full border-2 border-dashed border-gray-400 dark:border-gray-500 flex items-center justify-center mb-4">
          <ChatCircle size={18} className="text-gray-500 dark:text-gray-400" />
        </div>

        {/* Description */}
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">Temporary chat</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-5">
          Your analysis won't be saved to your history or recent analyses. Great for quick one-off checks.
        </p>

        {/* Cancel / Start buttons */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onStart}
            className="flex-1 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors"
          >
            Start
          </button>
        </div>
      </div>
    </div>
  )
}


// ════════════════════════ NAVBAR ═════════════════════════════════════════════
export default function Navbar() {
  const [dark, setDark]     = useDarkMode()
  const [menuOpen, setMenu] = useState(false)   // mobile hamburger state
  const [auth, setAuth]     = useState(null)    // 'login' | 'signup' | null
  const [tempOpen, setTempOpen] = useState(false)
  const { user, logout, openPricing } = useAuth()
  const navigate                      = useNavigate()

  // ── Auth modal helpers ────────────────────────────────────────────────────
  const openSignup = () => { setAuth('signup'); setMenu(false) }
  const openLogin  = () => { setAuth('login');  setMenu(false) }
  const closeAuth  = () => setAuth(null)

  // ── Temp chat start — navigate to / with tempChat flag ───────────────────
  const handleTempStart = () => {
    setTempOpen(false)
    navigate('/', { state: { tempChat: true, newAnalysis: true } })
  }

  return (
    <>
      {/* ── Fixed header bar ──────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-30 bg-white/90 dark:bg-gray-950/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className={user ? 'px-4' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}>
          <div className="flex items-center h-14 gap-2">

            {/* ── Logo — shown only for guests (sidebar has it for logged-in) ─ */}
            {!user && (
              <Link to="/" className="flex-shrink-0">
                <GentekWordmark size={34} textSize="text-base" />
              </Link>
            )}

            {/* Flexible spacer — pushes right-side items to the edge */}
            <div className="flex-1" />

            {/* ── Guest: dark mode toggle ───────────────────────────────────── */}
            {!user && (
              <button
                onClick={() => setDark(d => !d)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title={dark ? 'Light mode' : 'Dark mode'}
              >
                {dark
                  ? <Sun  size={16} weight="fill" className="text-accent-400" />
                  : <Moon size={16} weight="fill" />}
              </button>
            )}

            {/* ── Logged-in desktop: Gift offer icon + Temp chat button ─────── */}
            {user && (
              <div className="hidden md:flex items-center gap-2">
                {/* Gift icon — opens the PricingModal upgrade popup */}
                <button
                  onClick={openPricing}
                  title="Free offer"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <Gift size={16} weight="fill" />
                </button>

                {/* Temp chat button — dashed circle signals ephemeral session */}
                <button
                  onClick={() => setTempOpen(true)}
                  title="Temporary chat"
                  className="w-8 h-8 rounded-full border-2 border-dashed border-gray-400 dark:border-gray-500 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:border-brand-500 hover:text-brand-500 dark:hover:border-brand-400 dark:hover:text-brand-400 transition-colors"
                >
                  <ChatCircle size={14} weight="regular" />
                </button>
              </div>
            )}

            {/* ── Guest desktop: Log in + Sign up buttons ───────────────────── */}
            {!user && (
              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={openLogin}
                  className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors px-3 py-2"
                >
                  Log in
                </button>
                <button
                  onClick={openSignup}
                  className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl px-4 py-2 transition-all shadow-btn hover:shadow-none active:scale-95"
                >
                  Sign up free
                </button>
              </div>
            )}

            {/* ── Mobile right-side area ────────────────────────────────────── */}
            <div className="md:hidden flex items-center gap-1">
              {user ? (
                <>
                  {/* Mobile: Gift offer icon */}
                  <button
                    onClick={openPricing}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-blue-500"
                    title="Free offer"
                  >
                    <Gift size={15} weight="fill" />
                  </button>

                  {/* Mobile: Temp chat dashed circle button */}
                  <button
                    onClick={() => setTempOpen(true)}
                    title="Temporary chat"
                    className="w-7 h-7 rounded-full border-2 border-dashed border-gray-400 dark:border-gray-500 flex items-center justify-center text-gray-500"
                  >
                    <ChatCircle size={12} />
                  </button>
                </>
              ) : (
                // Mobile hamburger — toggles mobile menu dropdown below
                <button
                  onClick={() => setMenu(o => !o)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  {menuOpen ? <X size={18} weight="bold" /> : <List size={18} weight="bold" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Mobile dropdown menu — guests only ───────────────────────────── */}
        {!user && (
          <div className={`md:hidden overflow-hidden transition-all duration-300 border-t border-gray-100 dark:border-gray-800 ${menuOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="bg-white dark:bg-gray-950 px-4 py-3 space-y-2">
              <button onClick={openLogin} className="block w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Log in
              </button>
              <button onClick={openSignup} className="block w-full text-center bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl px-4 py-2.5 transition-colors">
                Sign up free
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── Temporary chat confirmation modal ──────────────────────────────── */}
      {tempOpen && (
        <TempChatModal
          onClose={() => setTempOpen(false)}
          onStart={handleTempStart}
        />
      )}

      {/* ── Auth modal — login or signup ────────────────────────────────────── */}
      {auth && <AuthModal mode={auth} onClose={closeAuth} />}
    </>
  )
}
