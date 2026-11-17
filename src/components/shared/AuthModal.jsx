// ── AuthModal — login / signup / forgot password modal ───────────────────────
// Opened by Navbar's "Log in" or "Sign up" buttons and the homepage CTA.
// Internal views: 'login' | 'signup' | 'verify' | 'forgot' | 'done' | 'create-pw' | 'pw-created'
// Layout: the overlay is sized to the visible screen (visualViewport), so on
// phones the card shrinks above the keyboard and scrolls inside; the close
// button sits outside the scroll area and is always reachable.
// Pressing Escape or clicking outside closes the modal.

import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Eye, EyeSlash, EnvelopeSimple, LockKey, User, ArrowLeft, ShieldCheck, CheckCircle } from '@phosphor-icons/react'
import GentekMark from './GentekLogo'
import { useAuth } from '../../context/AuthContext'

// ── Google OAuth 2.0 Web Client ID — public identifier, safe to ship to the
// browser. Set VITE_GOOGLE_CLIENT_ID in the project root .env; must match
// GOOGLE_CLIENT_ID in backend/.env. ───────────────────────────────────────────
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

// ── GoogleIcon — SVG inline so no extra dependency ────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.96L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

// ── Create-password prompt after Google sign-in: skipping is remembered per
// account on this browser, so it isn't shown on every Google login. ─────────
const pwPromptKey = (id) => `gentek-pw-prompt-skipped-${id}`
const promptSkipped = (id) => { try { return localStorage.getItem(pwPromptKey(id)) === '1' } catch { return false } }
const skipPrompt = (id) => { try { localStorage.setItem(pwPromptKey(id), '1') } catch {} }

// ── Password rule — matches _check_password_strength in backend/auth.py ─────
const passwordProblem = (pw) =>
  pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)
    ? 'Use at least 8 characters, including a letter and a number.'
    : ''

// ── Seconds before "Resend code" is allowed — matches CODE_RESEND_SECONDS on the backend
const RESEND_SECONDS = 60

// ── Touch devices: don't autofocus (it pops the keyboard over the form) ────
const isTouch = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

// ── Spinner — shared by every submit button ─────────────────────────────────
function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
    </svg>
  )
}

// view: 'login' | 'signup' | 'verify' | 'forgot' | 'done' | 'create-pw' | 'pw-created'
export default function AuthModal({ mode = 'signup', onClose }) {
  const { login, register, loginWithGoogle, verifyCode, resendCode, createPassword } = useAuth()
  const navigate                = useNavigate()
  const [view, setView]         = useState(mode)
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [form, setForm]         = useState({ name: '', email: '', password: '', confirm: '' })
  const [resetEmail, setResetEmail] = useState('')
  const [remember, setRemember] = useState(true)
  // ── Emailed-code step: { email, purpose: 'verify' | 'login' | 'reset' } ──
  const [pending, setPending]   = useState(null)
  const [code, setCode]         = useState('')
  const [resendIn, setResendIn] = useState(0)
  const [notice, setNotice]     = useState('')
  // ── Create-password step (Google accounts without a GENTEK password) ─────
  const [googleUser, setGoogleUser] = useState(null)
  const [newPw, setNewPw]           = useState({ password: '', confirm: '' })
  const googleClientRef = useRef(null)
  const rememberRef     = useRef(true)
  const scrollRef       = useRef(null)
  // ── Visible screen area (shrinks when the phone keyboard opens) — the
  // overlay is sized to it so the card always fits and scrolls inside. ──
  const [vv, setVv] = useState(null)
  useLayoutEffect(() => {
    const v = window.visualViewport
    if (!v) return
    const update = () => setVv({ h: v.height, top: v.offsetTop })
    update()
    v.addEventListener('resize', update)
    v.addEventListener('scroll', update)
    return () => { v.removeEventListener('resize', update); v.removeEventListener('scroll', update) }
  }, [])
  // ── Keep the focused field visible above the keyboard ──
  const revealField = (e) => {
    const el = e.target
    if (!isTouch() || !(el instanceof HTMLInputElement)) return
    setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
  }
  // New view → back to the top of the card
  useEffect(() => { scrollRef.current?.scrollTo(0, 0) }, [view])

  // ── Keep a ref mirror of `remember` so the Google callback (created once,
  // below) always reads the latest value without needing to be re-created ──
  useEffect(() => { rememberRef.current = remember }, [remember])

  // ── Escape key closes modal ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // ── Resend countdown — ticks once a second while on the code step ───────
  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn(n => n - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  // ── Lock body scroll while modal is open ──────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // ── Set up the Google OAuth token client once Google's script is ready.
  // Polls briefly since the GIS script loads async/defer — gives up quietly
  // after a few seconds rather than retrying forever. ───────────────────────
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    let cancelled = false
    let attempts = 0
    const trySetup = () => {
      if (cancelled) return
      if (window.google?.accounts?.oauth2) {
        googleClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'openid email profile',
          callback: async (tokenResponse) => {
            if (!tokenResponse?.access_token) {
              setError('Google sign-in was cancelled or failed.')
              return
            }
            setLoading(true)
            setError('')
            try {
              const u = await loginWithGoogle(tokenResponse.access_token, rememberRef.current)
              if (u?.has_password === false && !promptSkipped(u.id)) {
                // Offer a GENTEK password so email + password login works too
                setGoogleUser(u)
                setNewPw({ password: '', confirm: '' })
                setView('create-pw')
              } else {
                onClose()
              }
            } catch (err) {
              setError(err.message || 'Google sign-in failed.')
            } finally {
              setLoading(false)
            }
          },
        })
        return
      }
      if (++attempts <= 15) setTimeout(trySetup, 300)
    }
    trySetup()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── handleGoogleClick — triggers the Google popup from our own styled button ──
  const handleGoogleClick = () => {
    setError('')
    if (!GOOGLE_CLIENT_ID) {
      setError('Google sign-in is not configured yet.')
      return
    }
    if (!googleClientRef.current) {
      setError('Google sign-in is still loading — please try again in a moment.')
      return
    }
    googleClientRef.current.requestAccessToken()
  }

  // ── Controlled input helper — clears error on every keystroke ────────────
  const set = (field) => (e) => { const val = e.target.value; setForm(prev => ({ ...prev, [field]: val })); setError('') }

  // ── handleAuth — submit login or signup form ──────────────────────────────
  const handleAuth = async (e) => {
    e.preventDefault()
    if (view === 'signup') {
      // Same rule as the backend (_check_password_strength) — fail fast here
      const problem = passwordProblem(form.password)
      if (problem) { setError(problem); return }
      if (form.password !== form.confirm) { setError('Passwords do not match.'); return }
    }
    setLoading(true)
    setError('')
    try {
      const result = view === 'signup'
        ? await register(form.name, form.email, form.password)
        : await login(form.email, form.password, remember)
      if (result?.pending) {
        // Sign-up, or a login from a new browser — an emailed code is needed
        setPending(result.pending)
        setCode('')
        setNotice('')
        setResendIn(RESEND_SECONDS)
        setView('verify')
        return
      }
      onClose()   // trusted browser — logged in directly
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── handleVerify — submits the emailed 6-digit code ──────────────────────
  const handleVerify = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (pending.purpose === 'reset') {
        // A correct reset code returns a single-use reset token from the
        // backend; the new-password page sends it with the new password.
        const res = await fetch('/auth/verify-reset-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: pending.email, code }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.detail || 'Verification failed')
        onClose()
        // Passed in router state, not the URL, so it isn't kept in history
        navigate('/reset-password', { state: { resetToken: data.reset_token, email: pending.email } })
        return
      }
      await verifyCode(pending.email, code, pending.purpose, remember)
      if (pending.purpose === 'verify') setView('done')   // new account — confirm before closing
      else onClose()
    } catch (err) {
      setError(err.message)
      // A burned code can't be retried — clear the box so they request a new one
      if (/too many/i.test(err.message)) { setCode(''); setResendIn(0) }
    } finally {
      setLoading(false)
    }
  }

  // ── handleResend — emails a fresh code (backend enforces the cooldown too) ──
  const handleResend = async () => {
    setError('')
    setNotice('')
    try {
      await resendCode(pending.email, pending.purpose)
      setCode('')
      setNotice('A new code has been sent.')
      setResendIn(RESEND_SECONDS)
    } catch (err) {
      setError(err.message)
    }
  }

  // ── handleCreatePassword — sets the first GENTEK password for a Google
  // account; the backend accepts it because the sign-in just happened ──────
  const handleCreatePassword = async (e) => {
    e.preventDefault()
    const problem = passwordProblem(newPw.password)
    if (problem) { setError(problem); return }
    if (newPw.password !== newPw.confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    setError('')
    try {
      await createPassword(newPw.password)
      setView('pw-created')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── handleSkipPassword — keep using Google only; Settings offers it later ──
  const handleSkipPassword = () => {
    if (googleUser) skipPrompt(googleUser.id)
    onClose()
  }

  // ── handleForgot — asks the backend to email a 6-digit reset code. The reply
  // is the same whether or not the email is registered, so the code step is
  // always shown next. ───────────────────────────────────────────────────────
  const handleForgot = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Something went wrong. Please try again.')
      }
      setPending({ email: resetEmail.trim(), purpose: 'reset' })
      setCode('')
      setNotice('')
      setResendIn(RESEND_SECONDS)
      setView('verify')
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── switchTab — change between login/signup, reset form state ────────────
  const switchTab = (t) => {
    setView(t)
    setShowPass(false)
    setLoading(false)
    setError('')
    // Keep the typed email when switching Log in ↔ Sign up
    setForm(f => ({ name: '', email: f.email, password: '', confirm: '' }))
    setRemember(true)
    setPending(null)
    setCode('')
    setNotice('')
  }

  // ── Shared input class — used for all text/email/password fields ──────────
  // 16px on touch devices (incl. landscape phones): smaller text makes iPhone
  // Safari zoom the page on focus. 14px only on mouse-driven desktops.
  const inputCls = "w-full h-11 pl-10 pr-4 text-base [@media(hover:hover)_and_(min-width:640px)]:text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition"

  return (
    // ── Overlay — sized to the VISIBLE screen (visualViewport), so on phones
    // the card never runs under the keyboard, browser bars or notch. Padding
    // respects safe areas; the card scrolls inside when it's taller than that.
    <div
      className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center px-3 sm:px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      style={{ height: vv ? `${vv.h}px` : '100dvh', transform: vv?.top ? `translateY(${vv.top}px)` : undefined }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      onFocus={revealField}
    >
      {/* Backdrop — covers the whole page even while the overlay is keyboard-sized */}
      <div className="fixed inset-0 -z-10 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* ── Modal card ──────────────────────────────────────────────────── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={view === 'signup' ? 'Create your account' : view === 'login' ? 'Log in' : 'Account'}
        className="relative w-full max-w-[400px] sm:max-w-md max-h-full flex flex-col bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-up"
      >

        {/* Close button — outside the scroll area, so it's always visible */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-2 right-2 sm:top-3 sm:right-3 w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-white/80 dark:bg-gray-900/80 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors z-10"
        >
          <X size={16} weight="bold" />
        </button>

        <div ref={scrollRef} className="overflow-y-auto overscroll-contain min-h-0">

        {/* ── CREATE-PW view — offered once after Google sign-in when the
            account has no GENTEK password yet ────────────────────────────── */}
        {view === 'create-pw' && googleUser && (
          <>
            <div className="px-12 pt-7 sm:pt-8 pb-4 sm:pb-5 text-center">
              <div className="flex justify-center mb-4">
                <GentekMark size={44} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Create a GENTEK password</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                You're signed in with Google. Add a password to also sign in with
              </p>
              <p className="text-sm font-semibold text-brand-600 dark:text-brand-400 break-all mt-0.5">{googleUser.email}</p>
            </div>

            <div className="px-5 sm:px-8 pb-6 sm:pb-8 space-y-4">
              <form onSubmit={handleCreatePassword} className="space-y-3">
                <div className="relative">
                  <LockKey size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="New password"
                    autoComplete="new-password"
                    value={newPw.password}
                    onChange={(e) => { setNewPw(p => ({ ...p, password: e.target.value })); setError('') }}
                    required
                    autoFocus={!isTouch()}
                    className={`${inputCls} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showPass ? <EyeSlash size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <div className="relative">
                  <LockKey size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="Confirm password"
                    autoComplete="new-password"
                    value={newPw.confirm}
                    onChange={(e) => { setNewPw(p => ({ ...p, confirm: e.target.value })); setError('') }}
                    required
                    className={inputCls}
                  />
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">At least 8 characters, including a letter and a number.</p>

                {error && (
                  <p className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl px-3 py-2 text-center">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary justify-center min-h-[44px] py-2.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating password…' : 'Create password'}
                </button>
              </form>

              <button
                type="button"
                onClick={handleSkipPassword}
                className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
              >
                Skip for now
              </button>
              <p className="text-center text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
                You can keep using Continue with Google. You can also create a password later in Settings.
              </p>
            </div>
          </>
        )}

        {/* ── PW-CREATED view ──────────────────────────────────────────────── */}
        {view === 'pw-created' && googleUser && (
          <div className="px-6 py-8 sm:p-10 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center mb-5">
              <CheckCircle size={28} weight="fill" className="text-brand-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Password created</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              You can now sign in with Google or with <span className="font-semibold break-all">{googleUser.email}</span> and your password.
            </p>
            <button onClick={onClose} className="btn-primary px-8 py-2.5">
              Continue
            </button>
          </div>
        )}

        {/* ── SUCCESS view — shown after login or signup ─────────────────── */}
        {view === 'done' && (
          <div className="px-6 py-8 sm:p-10 flex flex-col items-center text-center">
            {/* GENTEK logo confirmation icon */}
            <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center mb-5">
              <GentekMark size={44} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Email verified!</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Your GENTEK account is ready. Start detecting gender bias now.
            </p>
            {/* Go to Workspace closes modal */}
            <button onClick={onClose} className="btn-primary px-8 py-2.5">
              Go to Workspace
            </button>
          </div>
        )}

        {/* ── VERIFY view — enter the 6-digit code emailed at sign-up or on a
            login from a new browser ─────────────────────────────────────── */}
        {view === 'verify' && pending && (
          <>
            <div className="px-12 pt-7 sm:pt-8 pb-4 sm:pb-5 text-center">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-full bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
                  <ShieldCheck size={28} weight="duotone" className="text-brand-600" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                {pending.purpose === 'verify' ? 'Verify your email'
                  : pending.purpose === 'reset' ? 'Enter your reset code' : 'Confirm it\'s you'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {pending.purpose === 'verify'
                  ? 'Enter the 6-digit code we sent to'
                  : pending.purpose === 'reset'
                    ? 'If an account exists for this email, we sent a 6-digit code to'
                    : 'This browser is new to your account. Enter the 6-digit code we sent to'}
              </p>
              <p className="text-sm font-semibold text-brand-600 dark:text-brand-400 break-all mt-0.5">{pending.email}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">The code expires in 5 minutes.</p>
            </div>

            <div className="px-5 sm:px-8 pb-6 sm:pb-8 space-y-4">
              <form onSubmit={handleVerify} className="space-y-3">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
                  required
                  autoFocus={!isTouch()}
                  aria-label="6-digit code"
                  className="w-full py-3 text-center text-2xl font-bold tracking-[0.5em] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition"
                />

                {error && (
                  <p className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl px-3 py-2 text-center">
                    {error}
                  </p>
                )}
                {notice && !error && (
                  <p className="text-xs text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-xl px-3 py-2 text-center">
                    {notice}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="w-full btn-primary justify-center min-h-[44px] py-2.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Spinner />
                      Verifying…
                    </span>
                  ) : pending.purpose === 'verify' ? 'Verify and continue' : 'Verify code'}
                </button>
              </form>

              <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                Didn't get it? Check your spam folder or{' '}
                {resendIn > 0 ? (
                  <span className="text-gray-400 dark:text-gray-500">resend in {resendIn}s</span>
                ) : (
                  <button type="button" onClick={handleResend} className="text-brand-600 dark:text-brand-400 hover:underline">
                    resend the code
                  </button>
                )}.
              </p>

              <button
                onClick={() => pending.purpose === 'reset'
                  ? (setView('forgot'), setError(''), setNotice(''))
                  : switchTab(pending.purpose === 'verify' ? 'signup' : 'login')}
                className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors pt-1"
              >
                <ArrowLeft size={14} weight="bold" />
                {pending.purpose === 'login' ? 'Back to Log in' : 'Use a different email'}
              </button>
            </div>
          </>
        )}

        {/* ── FORGOT view — email input form for password reset ─────────────── */}
        {view === 'forgot' && (
          <>
            {/* Header with logo */}
            <div className="px-12 pt-7 sm:pt-8 pb-4 sm:pb-5 text-center">
              <div className="flex justify-center mb-4">
                <GentekMark size={44} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Reset your password</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enter the email linked to your account and we'll send you a 6-digit code.
              </p>
            </div>

            {/* Reset form body */}
            <div className="px-5 sm:px-8 pb-6 sm:pb-8 space-y-4">
              <form onSubmit={handleForgot} className="space-y-3">
                {/* Email field */}
                <div className="relative">
                  <EnvelopeSimple size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    autoFocus={!isTouch()}
                    className={inputCls}
                  />
                </div>

                {/* Send code button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary justify-center min-h-[44px] py-2.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Spinner />
                      Sending code…
                    </span>
                  ) : 'Send code'}
                </button>
              </form>

              {/* Back to login link */}
              <button
                onClick={() => switchTab('login')}
                className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors pt-1"
              >
                <ArrowLeft size={14} weight="bold" />
                Back to Log in
              </button>
            </div>
          </>
        )}

        {/* ── LOGIN / SIGNUP views — email form first, then Google, then the
            link to the other view (switching never closes the modal) ──── */}
        {(view === 'login' || view === 'signup') && (
          <>
            {/* Header — logo + heading; compact on phones and short screens */}
            <div className="px-12 pt-6 sm:pt-8 pb-4 sm:pb-5 text-center [@media(max-height:480px)]:pt-4 [@media(max-height:480px)]:pb-3">
              <div className="flex justify-center mb-3 [@media(max-height:480px)]:hidden">
                <GentekMark size={40} />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {view === 'signup' ? 'Create Your Account' : 'Welcome Back'}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {view === 'signup'
                  ? 'Start detecting gender bias — free, no card needed.'
                  : 'Log in to continue to GENTEK.'}
              </p>
            </div>

            <div className="px-5 sm:px-8 pb-6 sm:pb-8">
              {/* ── Email + password form ─────────────────────────────────── */}
              <form onSubmit={handleAuth} className="space-y-3">
                {/* Full name — signup only */}
                {view === 'signup' && (
                  <div className="relative">
                    <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      name="name"
                      autoComplete="name"
                      aria-label="Full name"
                      placeholder="Full name"
                      value={form.name}
                      onChange={set('name')}
                      required
                      className={inputCls}
                    />
                  </div>
                )}

                {/* Email */}
                <div className="relative">
                  <EnvelopeSimple size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-label="Email address"
                    placeholder="Email address"
                    value={form.email}
                    onChange={set('email')}
                    required
                    className={inputCls}
                  />
                </div>

                {/* Password — eye toggle shows/hides it (and Confirm, on signup) */}
                <div className="relative">
                  <LockKey size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    name="password"
                    autoComplete={view === 'signup' ? 'new-password' : 'current-password'}
                    aria-label="Password"
                    placeholder="Password"
                    value={form.password}
                    onChange={set('password')}
                    required
                    className={`${inputCls} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                    aria-pressed={showPass}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showPass ? <EyeSlash size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Confirm password + rule — signup only */}
                {view === 'signup' && (
                  <>
                    <div className="relative">
                      <LockKey size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input
                        type={showPass ? 'text' : 'password'}
                        name="confirm-password"
                        autoComplete="new-password"
                        aria-label="Confirm password"
                        placeholder="Confirm password"
                        value={form.confirm}
                        onChange={set('confirm')}
                        required
                        className={inputCls}
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 px-1">At least 8 characters, including a letter and a number.</p>
                  </>
                )}

                {/* Remember me + Forgot password — login only */}
                {view === 'login' && (
                  <div className="flex items-center justify-between -my-1">
                    <label className="flex items-center gap-2 min-h-[40px] text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-400 focus:ring-offset-0"
                      />
                      Remember me
                    </label>
                    <button
                      type="button"
                      onClick={() => { setResetEmail(form.email); setError(''); setView('forgot') }}
                      className="min-h-[40px] text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {/* Error banner */}
                {error && (
                  <p role="alert" className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl px-3 py-2 text-center">
                    {error}
                  </p>
                )}

                {/* Primary submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary justify-center min-h-[44px] py-2.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Spinner />
                      {view === 'signup' ? 'Creating account…' : 'Logging in…'}
                    </span>
                  ) : view === 'signup' ? 'Create Account' : 'Log in'}
                </button>
              </form>

              {/* OR divider — separates email login from Google */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                <span className="text-xs text-gray-400 dark:text-gray-500">or</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              </div>

              {/* ── Google OAuth — verified server-side via /auth/google ── */}
              <button
                type="button"
                onClick={handleGoogleClick}
                disabled={loading}
                className="w-full min-h-[44px] flex items-center justify-center gap-3 border border-gray-200 dark:border-gray-700 rounded-xl py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <GoogleIcon />
                Continue with Google
              </button>

              {/* Terms — signup only */}
              {view === 'signup' && (
                <p className="mt-3 text-center text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
                  By signing up you agree to our{' '}
                  <a href="/terms" target="_blank" rel="noopener" className="text-brand-600 dark:text-brand-400 hover:underline">Terms</a>
                  {' '}and{' '}
                  <a href="/privacy" target="_blank" rel="noopener" className="text-brand-600 dark:text-brand-400 hover:underline">Privacy Policy</a>.
                </p>
              )}

              {/* Switch view — stays inside the modal */}
              <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
                {view === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  type="button"
                  onClick={() => switchTab(view === 'signup' ? 'login' : 'signup')}
                  className="font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                >
                  {view === 'signup' ? 'Log in' : 'Sign up'}
                </button>
              </p>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  )
}
