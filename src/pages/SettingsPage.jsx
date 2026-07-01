// ── SettingsPage — user account and preferences settings ──────────────────────
// Five settings sections: Profile, Appearance, Notifications, Security, Account.
// Sidebar is offset (pt-20) because AppSidebar sits at left and Navbar at top.
// Changes to display name persist via updateUser() in AuthContext (calls backend).

import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import {
  User, EnvelopeSimple, Moon, Sun, SignOut, Trash,
  Lock, Bell, ShieldCheck, FloppyDisk, Warning, X,
} from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { useDarkMode } from '../hooks/useDarkMode'

// ── DeleteAccountModal — two-step confirmation before permanently deleting ─────
// Step 1: warning screen. Step 2: type email to confirm.
function DeleteAccountModal({ userEmail, onConfirm, onCancel }) {
  const [step, setStep]   = useState(1)   // 1 = warning, 2 = email confirm
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const matches = input.trim().toLowerCase() === userEmail?.toLowerCase()

  const handleDelete = async () => {
    if (!matches) return
    setLoading(true)
    await onConfirm()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-up">

        {/* Close button */}
        <button onClick={onCancel} className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <X size={14} weight="bold" />
        </button>

        <div className="p-8">
          {step === 1 ? (
            <>
              {/* ── Step 1: Warning ───────────────────────────────────── */}
              <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mb-5">
                <Warning size={24} weight="fill" className="text-rose-500" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete your account?</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-2">
                This will permanently delete your account and <strong>all your analysis history</strong>. This action cannot be undone.
              </p>
              <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1 mb-6 list-disc list-inside">
                <li>All saved analyses will be removed</li>
                <li>Your profile and settings will be erased</li>
                <li>You cannot recover this account</li>
              </ul>
              <div className="flex gap-3">
                <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  Cancel
                </button>
                <button onClick={() => setStep(2)} className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors">
                  Yes, continue
                </button>
              </div>
            </>
          ) : (
            <>
              {/* ── Step 2: Type email to confirm ────────────────────── */}
              <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mb-5">
                <Trash size={22} weight="fill" className="text-rose-500" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Confirm deletion</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Type your email address to confirm:
              </p>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg">
                {userEmail}
              </p>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type your email here"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-rose-400 dark:focus:border-rose-500 transition-colors mb-4"
                autoFocus
              />
              <div className="flex gap-3">
                <button onClick={() => { setStep(1); setInput('') }} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  Back
                </button>
                <button
                  onClick={handleDelete}
                  disabled={!matches || loading}
                  className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                >
                  {loading ? 'Deleting…' : 'Permanently Delete'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Section — card wrapper with a title header and divider-separated rows ─────
function Section({ title, children }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      {/* Section title header bar */}
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h2>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">{children}</div>
    </div>
  )
}

// ── Row — individual settings row: icon badge + label/desc on left, control on right ──
function Row({ icon: Icon, label, desc, children }) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4">
      <div className="flex items-center gap-3 min-w-0">
        {/* Icon badge — gray square with icon */}
        <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
          <Icon size={15} className="text-gray-500 dark:text-gray-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
          {desc && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{desc}</p>}
        </div>
      </div>
      {/* Right-side control — toggle, button, etc. passed as children */}
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

// ════════════════════════ SETTINGS PAGE ══════════════════════════════════════
export default function SettingsPage() {
  const { user, logout, updateUser, deleteAccount } = useAuth()
  const [dark, setDark]  = useDarkMode()
  const navigate         = useNavigate()

  const [name, setName]     = useState(user?.name || '')
  const [saved, setSaved]   = useState(false)                // transient "Saved!" feedback
  const [notifications, setNotifications] = useState(true)   // email notification toggle
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // ── Redirect guests to homepage — settings requires auth ─────────────────
  // Must be after all hooks (Rules of Hooks)
  if (!user) return <Navigate to="/" replace />

  // ── handleSave — updates display name via AuthContext, shows brief feedback ─
  const handleSave = () => {
    const trimmed = name.trim()
    if (trimmed) updateUser({ name: trimmed })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // ── handleLogout — logs out and redirects to homepage ────────────────────
  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 pt-20 pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">

        {/* ── Page heading ──────────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your account and preferences.</p>
        </div>

        <div className="space-y-4">

          {/* ── Profile section — avatar, name input, email (read-only) ─── */}
          <Section title="Profile">
            <div className="px-6 py-5">
              {/* Avatar circle + name/email display */}
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0 shadow-btn">
                  <span className="text-xl font-bold text-white">{user?.name?.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{user?.name}</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">{user?.email}</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Display Name — editable */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Display Name</label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-200 outline-none focus:border-brand-400 dark:focus:border-brand-500 transition-colors"
                    />
                  </div>
                </div>
                {/* Email Address — read-only, greyed out */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Email Address</label>
                  <div className="relative">
                    <EnvelopeSimple size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={user?.email || ''}
                      readOnly
                      className="w-full pl-9 pr-4 py-2.5 text-sm bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 dark:text-gray-500 outline-none cursor-not-allowed"
                    />
                  </div>
                </div>
                {/* Save Changes button — shows "Saved!" for 2s after click */}
                <button
                  onClick={handleSave}
                  className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-btn mt-1"
                >
                  <FloppyDisk size={14} />
                  {saved ? 'Saved!' : 'Save Changes'}
                </button>
              </div>
            </div>
          </Section>

          {/* ── Appearance section — dark/light mode toggle ───────────────── */}
          <Section title="Appearance">
            <Row
              icon={dark ? Moon : Sun}
              label={dark ? 'Dark Mode' : 'Light Mode'}
              desc="Switch between light and dark theme"
            >
              {/* Toggle pill — brand-600 when on, gray-300 when off */}
              <button
                onClick={() => setDark(d => !d)}
                className={`relative w-11 h-6 rounded-full transition-colors ${dark ? 'bg-brand-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${dark ? 'left-5.5 translate-x-0.5' : 'left-0.5'}`} />
              </button>
            </Row>
          </Section>

          {/* ── Notifications section — email notification toggle ─────────── */}
          <Section title="Notifications">
            <Row icon={Bell} label="Email Notifications" desc="Receive tips and feature updates via email">
              <button
                onClick={() => setNotifications(n => !n)}
                className={`relative w-11 h-6 rounded-full transition-colors ${notifications ? 'bg-brand-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${notifications ? 'left-5.5 translate-x-0.5' : 'left-0.5'}`} />
              </button>
            </Row>
          </Section>

          {/* ── Security section — password change + 2FA (coming soon) ────── */}
          <Section title="Security">
            {/* Password change — text button link */}
            <Row icon={Lock} label="Password" desc="Change your account password">
              <button className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline">Change</button>
            </Row>
            {/* Two-Factor Auth — not yet implemented */}
            <Row icon={ShieldCheck} label="Two-Factor Auth" desc="Add an extra layer of security">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">Coming soon</span>
            </Row>
          </Section>

          {/* ── Account section — sign out + delete account ───────────────── */}
          <Section title="Account">
            {/* Sign Out — triggers logout() and navigates home */}
            <Row icon={SignOut} label="Sign Out" desc="Sign out of your GENTEK account">
              <button
                onClick={handleLogout}
                className="text-xs font-semibold text-rose-500 hover:text-rose-600 border border-rose-200 dark:border-rose-800 hover:border-rose-300 dark:hover:border-rose-700 px-3 py-1.5 rounded-xl transition-colors"
              >
                Sign out
              </button>
            </Row>
            {/* Delete Account — opens two-step confirmation modal */}
            <Row icon={Trash} label="Delete Account" desc="Permanently delete your account and all data">
              <button
                onClick={() => setShowDeleteModal(true)}
                className="text-xs font-semibold text-rose-500 hover:text-rose-600 border border-rose-200 dark:border-rose-800 hover:border-rose-300 dark:hover:border-rose-700 px-3 py-1.5 rounded-xl transition-colors"
              >
                Delete
              </button>
            </Row>
          </Section>

        </div>
      </div>

      {/* ── Two-step delete account confirmation modal ─────────────────────── */}
      {showDeleteModal && (
        <DeleteAccountModal
          userEmail={user?.email}
          onConfirm={async () => { await deleteAccount(); navigate('/') }}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </main>
  )
}
