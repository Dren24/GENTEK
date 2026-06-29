import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, EnvelopeSimple, Moon, Sun, SignOut, Trash,
  Lock, Bell, ShieldCheck, FloppyDisk,
} from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { useDarkMode } from '../hooks/useDarkMode'

function Section({ title, children }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h2>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">{children}</div>
    </div>
  )
}

function Row({ icon: Icon, label, desc, children }) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
          <Icon size={15} className="text-gray-500 dark:text-gray-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
          {desc && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{desc}</p>}
        </div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

export default function SettingsPage() {
  const { user, logout, updateUser } = useAuth()
  const [dark, setDark]  = useDarkMode()
  const navigate         = useNavigate()

  const [name, setName]     = useState(user?.name || '')
  const [saved, setSaved]   = useState(false)
  const [notifications, setNotifications] = useState(true)

  const handleSave = () => {
    const trimmed = name.trim()
    if (trimmed) updateUser({ name: trimmed })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 pt-20 pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">

        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your account and preferences.</p>
        </div>

        <div className="space-y-4">

          {/* ── Profile ── */}
          <Section title="Profile">
            <div className="px-6 py-5">
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

          {/* ── Appearance ── */}
          <Section title="Appearance">
            <Row icon={dark ? Moon : Sun} label={dark ? 'Dark Mode' : 'Light Mode'} desc="Switch between light and dark theme">
              <button
                onClick={() => setDark(d => !d)}
                className={`relative w-11 h-6 rounded-full transition-colors ${dark ? 'bg-brand-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${dark ? 'left-5.5 translate-x-0.5' : 'left-0.5'}`} />
              </button>
            </Row>
          </Section>

          {/* ── Notifications ── */}
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

          {/* ── Security ── */}
          <Section title="Security">
            <Row icon={Lock} label="Password" desc="Change your account password">
              <button className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline">Change</button>
            </Row>
            <Row icon={ShieldCheck} label="Two-Factor Auth" desc="Add an extra layer of security">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">Coming soon</span>
            </Row>
          </Section>

          {/* ── Account ── */}
          <Section title="Account">
            <Row icon={SignOut} label="Sign Out" desc="Sign out of your GENTEK account">
              <button
                onClick={handleLogout}
                className="text-xs font-semibold text-rose-500 hover:text-rose-600 border border-rose-200 dark:border-rose-800 hover:border-rose-300 dark:hover:border-rose-700 px-3 py-1.5 rounded-xl transition-colors"
              >
                Sign out
              </button>
            </Row>
            <Row icon={Trash} label="Delete Account" desc="Permanently delete your account and all data">
              <button className="text-xs font-semibold text-rose-500 hover:text-rose-600 border border-rose-200 dark:border-rose-800 hover:border-rose-300 dark:hover:border-rose-700 px-3 py-1.5 rounded-xl transition-colors">
                Delete
              </button>
            </Row>
          </Section>

        </div>
      </div>
    </main>
  )
}
