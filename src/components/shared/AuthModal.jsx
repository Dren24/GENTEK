import { useState, useEffect } from 'react'
import { X, Eye, EyeSlash, EnvelopeSimple, LockKey, User, ArrowLeft, PaperPlaneTilt } from '@phosphor-icons/react'
import GentekMark from './GentekLogo'
import { useAuth } from '../../context/AuthContext'

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

// view: 'login' | 'signup' | 'forgot' | 'forgot-sent' | 'done'
export default function AuthModal({ mode = 'signup', onClose }) {
  const { login, register }     = useAuth()
  const [view, setView]         = useState(mode)
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [form, setForm]         = useState({ name: '', email: '', password: '' })
  const [resetEmail, setResetEmail] = useState('')

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const set = (field) => (e) => { setForm({ ...form, [field]: e.target.value }); setError('') }

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (view === 'signup') {
        await register(form.name, form.email, form.password)
      } else {
        await login(form.email, form.password)
      }
      setView('done')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleForgot = (e) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => { setLoading(false); setView('forgot-sent') }, 1400)
  }

  const switchTab = (t) => {
    setView(t)
    setShowPass(false)
    setLoading(false)
  }

  const inputCls = "w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition"

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-up">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors z-10"
        >
          <X size={16} weight="bold" />
        </button>

        {/* ── SUCCESS ── */}
        {view === 'done' && (
          <div className="p-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center mb-5">
              <GentekMark size={44} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">You're in!</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Your GENTEK account is ready. Start detecting gender bias now.
            </p>
            <button onClick={onClose} className="btn-primary px-8 py-2.5">
              Go to Workspace
            </button>
          </div>
        )}

        {/* ── FORGOT — EMAIL SENT ── */}
        {view === 'forgot-sent' && (
          <div className="p-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center mb-5">
              <PaperPlaneTilt size={30} weight="duotone" className="text-brand-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Check your inbox</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              We sent a password reset link to
            </p>
            <p className="text-sm font-semibold text-brand-600 dark:text-brand-400 mb-6 break-all">
              {resetEmail}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
              Didn't receive it? Check your spam folder or{' '}
              <button
                onClick={() => { setView('forgot'); setLoading(false) }}
                className="text-brand-600 dark:text-brand-400 hover:underline"
              >
                try again
              </button>.
            </p>
            <button
              onClick={() => switchTab('login')}
              className="btn-outline px-8 py-2.5"
            >
              Back to Log in
            </button>
          </div>
        )}

        {/* ── FORGOT PASSWORD FORM ── */}
        {view === 'forgot' && (
          <>
            <div className="px-8 pt-8 pb-5 text-center">
              <div className="flex justify-center mb-4">
                <GentekMark size={44} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Reset your password</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enter the email linked to your account and we'll send you a reset link.
              </p>
            </div>

            <div className="px-8 pb-8 space-y-4">
              <form onSubmit={handleForgot} className="space-y-3">
                <div className="relative">
                  <EnvelopeSimple size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    autoFocus
                    className={inputCls}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary justify-center py-2.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      Sending link…
                    </span>
                  ) : 'Send reset link'}
                </button>
              </form>

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

        {/* ── LOGIN / SIGNUP ── */}
        {(view === 'login' || view === 'signup') && (
          <>
            <div className="px-8 pt-8 pb-6 text-center">
              <div className="flex justify-center mb-4">
                <GentekMark size={44} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                {view === 'signup' ? 'Create your free account' : 'Welcome back'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {view === 'signup'
                  ? 'Start detecting gender bias — free forever, no card needed.'
                  : 'Sign in to continue to GENTEK.'}
              </p>
            </div>

            {/* Tab switcher */}
            <div className="mx-8 mb-6 flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
              {['login', 'signup'].map(t => (
                <button
                  key={t}
                  onClick={() => switchTab(t)}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                    view === t
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {t === 'login' ? 'Log in' : 'Sign up'}
                </button>
              ))}
            </div>

            <div className="px-8 pb-8 space-y-4">
              {/* Google */}
              <button className="w-full flex items-center justify-center gap-3 border border-gray-200 dark:border-gray-700 rounded-xl py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <GoogleIcon />
                Continue with Google
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                <span className="text-xs text-gray-400 dark:text-gray-500">or</span>
                <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
              </div>

              <form onSubmit={handleAuth} className="space-y-3">
                {view === 'signup' && (
                  <div className="relative">
                    <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Full name"
                      value={form.name}
                      onChange={set('name')}
                      required
                      className={inputCls}
                    />
                  </div>
                )}

                <div className="relative">
                  <EnvelopeSimple size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={form.email}
                    onChange={set('email')}
                    required
                    className={inputCls}
                  />
                </div>

                <div className="relative">
                  <LockKey size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="Password"
                    value={form.password}
                    onChange={set('password')}
                    required
                    className={`${inputCls} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showPass ? <EyeSlash size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                {/* Forgot password link — login only */}
                {view === 'login' && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => { setResetEmail(form.email); setView('forgot') }}
                      className="text-xs text-brand-600 dark:text-brand-400 hover:underline transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {error && (
                  <p className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl px-3 py-2 text-center">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary justify-center py-2.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      {view === 'signup' ? 'Creating account…' : 'Signing in…'}
                    </span>
                  ) : view === 'signup' ? 'Create free account' : 'Sign in'}
                </button>
              </form>

              {view === 'signup' && (
                <p className="text-center text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
                  By signing up you agree to our{' '}
                  <span className="text-brand-600 dark:text-brand-400 cursor-pointer hover:underline">Terms</span>
                  {' '}and{' '}
                  <span className="text-brand-600 dark:text-brand-400 cursor-pointer hover:underline">Privacy Policy</span>.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
