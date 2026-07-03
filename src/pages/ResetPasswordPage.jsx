// ── ResetPasswordPage — lets the user set a new password ──────────────────────
// Supports reset links with a token and the local bypass flow with an email.

import { useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { LockKey, Eye, EyeSlash, CheckCircle, WarningCircle, X } from '@phosphor-icons/react'
import GentekMark from '../components/shared/GentekLogo'

export default function ResetPasswordPage() {
  const [searchParams]          = useSearchParams()
  const navigate                = useNavigate()
  const token                   = searchParams.get('token') || ''
  const email                   = searchParams.get('email') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)
  const [error, setError]       = useState('')

  const inputCls = "w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 transition"

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      const res = await fetch('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token || null, email: email || null, new_password: password }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Reset failed')
      }
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-up">
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="Close reset password"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors z-10"
        >
          <X size={16} weight="bold" />
        </button>

        {!token && !email ? (
          // ── No reset target in URL ─────────────────────────────────────────
          <div className="p-10 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center">
              <WarningCircle size={28} weight="fill" className="text-rose-500" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mt-5 mb-2">Invalid reset link</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">This link is missing the account to reset. Please request a new one.</p>
            <Link to="/" className="btn-primary px-8 py-2.5">Back to Home</Link>
          </div>

        ) : done ? (
          // ── Success state ──────────────────────────────────────────────────
          <div className="p-10 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
              <CheckCircle size={28} weight="fill" className="text-brand-500" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mt-5 mb-2">Password updated!</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Your password has been changed. You can now log in with your new password.</p>
            <button onClick={() => navigate('/')} className="btn-primary px-8 py-2.5">
              Go to Log In
            </button>
          </div>

        ) : (
          // ── Reset form ────────────────────────────────────────────────────
          <div className="p-8">
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <GentekMark size={44} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Set a new password</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Enter a new password for your GENTEK account.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* New password field */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">New Password</label>
                <div className="relative">
                  <LockKey size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError('') }}
                    required
                    autoFocus
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showPass ? <EyeSlash size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Confirm password field */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Confirm Password</label>
                <div className="relative">
                  <LockKey size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="Repeat your new password"
                    value={confirm}
                    onChange={e => { setConfirm(e.target.value); setError('') }}
                    required
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Error banner */}
              {error && (
                <p className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl px-3 py-2 text-center">
                  {error}
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary justify-center py-3 text-sm disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Updating password…
                  </span>
                ) : 'Update Password'}
              </button>

              <div className="text-center pt-1">
                <Link to="/" className="text-sm text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                  Back to Home
                </Link>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  )
}
