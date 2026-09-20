// ── DashboardPage — analytics overview for logged-in users ───────────────────
// Rendered inside the shared AppSidebar/Navbar shell like every other
// logged-in page. Stats and the recent-analyses table are driven by the
// real history from AuthContext (same data the sidebar shows).

import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ChartBar, Percent, ArrowRight, Lightning, MagnifyingGlass, Check, Warning } from '@phosphor-icons/react'

// ── Verdict badge color map — matches the classifications used across the app ─
const VERDICTMETA = {
  'MALE-BIASED':    { bg: 'bg-blue-50 dark:bg-blue-900/20',   text: 'text-blue-700 dark:text-blue-300',   ring: 'ring-blue-200 dark:ring-blue-800' },
  'FEMALE-BIASED':  { bg: 'bg-rose-50 dark:bg-rose-900/20',   text: 'text-rose-700 dark:text-rose-300',   ring: 'ring-rose-200 dark:ring-rose-800' },
  'MIXED-BIAS':     { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', ring: 'ring-amber-200 dark:ring-amber-800' },
  'GENDER-NEUTRAL': { bg: 'bg-brand-50 dark:bg-brand-900/20', text: 'text-brand-700 dark:text-brand-300', ring: 'ring-brand-200 dark:ring-brand-800' },
}

// ── ScorePill — colored percentage number (green ≥80, amber ≥50, red <50) ─────
function ScorePill({ score }) {
  const color = score >= 80 ? 'text-green-600 dark:text-green-400' : score >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400'
  return <span className={`font-bold text-sm tabular-nums ${color}`}>{score}%</span>
}

// ── VerdictBadge — pill badge matching VERDICTMETA color map ──────────────────
function VerdictBadge({ verdict }) {
  const m = VERDICTMETA[verdict] || {}
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ring-1 ${m.bg} ${m.text} ${m.ring}`}>
      {verdict.replace('-', ' ')}
    </span>
  )
}

// ── StatCard — summary metric with icon and value ─────────────────────────────
function StatCard({ icon: Icon, iconBg, iconColor, label, value }) {
  return (
    <div className="card p-5 flex gap-4 items-start">
      <div className={`w-11 h-11 rounded-2xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={20} weight="duotone" className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{value}</p>
      </div>
    </div>
  )
}

// ════════════════════════ DASHBOARD PAGE ══════════════════════════════════════
export default function DashboardPage() {
  const { user, history } = useAuth()
  const [search, setSearch] = useState('')

  // ── Redirect guests — dashboard requires auth ──────────────────────────────
  // Must be after all hooks (Rules of Hooks)
  if (!user) return <Navigate to="/" replace />

  // ── Filter history by preview text or classification ─────────────────────
  const filtered = history.filter((r) =>
    r.label.toLowerCase().includes(search.toLowerCase()) ||
    r.classification.toLowerCase().includes(search.toLowerCase())
  )

  const neutralCount = history.filter(r => r.classification === 'GENDER-NEUTRAL').length
  const biasedCount  = history.length - neutralCount
  const avgScore     = history.length ? Math.round(history.reduce((sum, r) => sum + r.score, 0) / history.length) : 0

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 pt-20 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* ── Greeting heading + New Analysis shortcut ─────────────────────── */}
        <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back, {user.name} 👋</h1>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-0.5">Here&rsquo;s a summary of your recent activity.</p>
          </div>
          <Link to="/" state={{ newAnalysis: true }} className="btn-primary text-xs px-4 py-2">
            New Analysis
            <ArrowRight size={13} weight="bold" />
          </Link>
        </div>

        {/* ── Stats row — derived from real saved history ──────────────────── */}
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <StatCard icon={ChartBar} iconBg="bg-brand-50 dark:bg-brand-900/30"  iconColor="text-brand-600 dark:text-brand-400"  label="Total Analyses"  value={history.length} />
          <StatCard icon={Check}    iconBg="bg-green-50 dark:bg-green-900/30" iconColor="text-green-600 dark:text-green-400" label="Neutral Texts"   value={neutralCount} />
          <StatCard icon={Warning}  iconBg="bg-amber-50 dark:bg-amber-900/30" iconColor="text-amber-600 dark:text-amber-400" label="Biased Detected" value={biasedCount} />
          <StatCard icon={Percent}  iconBg="bg-blue-50 dark:bg-blue-900/30"   iconColor="text-blue-600 dark:text-blue-400"   label="Avg. Bias Score" value={`${avgScore}%`} />
        </div>

        {/* ── Main content grid — analyses table + right widgets ─────────── */}
        <div className="grid xl:grid-cols-3 gap-6">

          {/* ── Recent analyses table — left 2/3 ────────────────────────── */}
          <div className="xl:col-span-2 card overflow-hidden">
            {/* Table header — title + search */}
            <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between gap-3">
              <h2 className="font-bold text-gray-900 dark:text-white text-sm">Recent Analyses</h2>
              <div className="relative flex-1 max-w-xs ml-auto">
                <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-800"
                />
              </div>
            </div>

            {/* Table rows — one per history entry, click loads it in the analyzer */}
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {filtered.length === 0 && (
                <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
                  {history.length === 0 ? 'No analyses yet — run your first check to see it here.' : 'No analyses match your search.'}
                </div>
              )}
              {filtered.map((row) => (
                <Link
                  key={row.id}
                  to="/"
                  state={{ loadText: row.text, historyId: row.id }}
                  className="px-5 py-3.5 flex items-start gap-3 hover:bg-gray-50/60 dark:hover:bg-gray-800/60 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 dark:text-gray-300 truncate leading-snug">{row.label}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{row.group}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <ScorePill score={row.score} />
                    <VerdictBadge verdict={row.classification} />
                  </div>
                </Link>
              ))}
            </div>

            {/* Table footer — link back to the analyzer */}
            <div className="px-5 py-3 border-t border-gray-50 dark:border-gray-800 text-center">
              <Link to="/" state={{ newAnalysis: true }} className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline">
                Start a new analysis →
              </Link>
            </div>
          </div>

          {/* ── Right widget column ──────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Current plan card — reflects the account's actual is_premium status */}
            <div className="card p-5 border-2 border-dashed border-gray-100 dark:border-gray-800">
              <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Current Plan</p>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{user.is_premium ? 'Pro' : 'Free'}</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">{user.is_premium ? '$9 / month' : '$0 / forever'}</p>
                </div>
                <span className="text-xs font-bold text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1">Active</span>
              </div>
              <ul className="space-y-2 mb-4">
                {(user.is_premium
                  ? ['Unlimited analyses', 'Advanced detection', 'Unlimited suggestions', 'Full analysis history']
                  : ['200 analyses / month', 'Basic detection', '3 suggestions max', 'Word highlighting']
                ).map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Check size={12} weight="bold" className="text-gray-400 dark:text-gray-500" />
                    {f}
                  </li>
                ))}
              </ul>
              {!user.is_premium && (
                <Link to="/pricing" className="btn-outline w-full justify-center text-xs py-2.5">
                  View Pro features
                </Link>
              )}
            </div>

            {/* Go Pro nudge — Free users only; Premium accounts already see their status above */}
            {!user.is_premium && (
              <div className="card p-5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Lightning size={12} weight="fill" className="text-brand-600 dark:text-brand-400" />
                  <span className="text-xs font-bold text-brand-700 dark:text-brand-300">Go Pro</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed mb-3">Unlimited analyses, exports, API access and history.</p>
                <Link to="/pricing" className="btn-primary w-full justify-center text-xs py-2.5">
                  Upgrade →
                </Link>
              </div>
            )}

          </div>
        </div>
      </div>
    </main>
  )
}
