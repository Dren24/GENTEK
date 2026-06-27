import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TextAa, ChartBar, Clock, Lightning, ArrowRight, ArrowUp, ArrowDown,
  Export, MagnifyingGlass, DotsThree, Check, Warning,
} from '@phosphor-icons/react'

const RECENT = [
  { id: 1, preview: 'The chairman of the board decided to use his manpower…',     score: 34, verdict: 'MALE-BIASED',    date: '2 min ago',   words: 42 },
  { id: 2, preview: 'All employees are encouraged to share their ideas freely…',   score: 91, verdict: 'NEUTRAL',        date: '18 min ago',  words: 61 },
  { id: 3, preview: 'The stewardess informed all passengers that the flight…',     score: 58, verdict: 'FEMALE-BIASED',  date: '1 hr ago',    words: 33 },
  { id: 4, preview: 'Our workforce spans diverse backgrounds and experiences…',    score: 87, verdict: 'NEUTRAL',        date: 'Yesterday',   words: 88 },
  { id: 5, preview: 'She was described as overly emotional during the meeting…',   score: 41, verdict: 'STEREOTYPE',     date: 'Yesterday',   words: 54 },
  { id: 6, preview: 'The businessman and his team presented the quarterly…',       score: 62, verdict: 'MALE-BIASED',    date: '2 days ago',  words: 77 },
]

const VERDICTMETA = {
  'MALE-BIASED':    { bg: 'bg-blue-50',   text: 'text-blue-700',  ring: 'ring-blue-200' },
  'FEMALE-BIASED':  { bg: 'bg-rose-50',   text: 'text-rose-700',  ring: 'ring-rose-200' },
  'STEREOTYPE':     { bg: 'bg-amber-50',  text: 'text-amber-700', ring: 'ring-amber-200' },
  'NEUTRAL':        { bg: 'bg-green-50',  text: 'text-green-700', ring: 'ring-green-200' },
}

function ScorePill({ score }) {
  const color = score >= 80 ? 'text-green-600' : score >= 50 ? 'text-amber-600' : 'text-red-500'
  return <span className={`font-bold text-sm tabular-nums ${color}`}>{score}%</span>
}

function VerdictBadge({ verdict }) {
  const m = VERDICTMETA[verdict] || {}
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ring-1 ${m.bg} ${m.text} ${m.ring}`}>
      {verdict.replace('-', ' ')}
    </span>
  )
}

function StatCard({ icon: Icon, iconBg, iconColor, label, value, delta, deltaDir }) {
  return (
    <div className="card p-5 flex gap-4 items-start">
      <div className={`w-11 h-11 rounded-2xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={20} weight="duotone" className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 font-medium mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-none mb-1">{value}</p>
        {delta && (
          <p className={`text-xs flex items-center gap-0.5 font-medium ${deltaDir === 'up' ? 'text-green-500' : 'text-red-400'}`}>
            {deltaDir === 'up' ? <ArrowUp size={11} weight="bold" /> : <ArrowDown size={11} weight="bold" />}
            {delta}
          </p>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [search, setSearch] = useState('')

  const filtered = RECENT.filter((r) =>
    r.preview.toLowerCase().includes(search.toLowerCase()) ||
    r.verdict.toLowerCase().includes(search.toLowerCase())
  )

  const usedPercent = 37   // mock: 74 / 200 free-tier analyses

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
              <TextAa size={14} weight="bold" className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">GENTEK</span>
          </Link>

          <div className="flex items-center gap-3 ml-auto">
            <Link to="/detector" className="btn-primary text-xs px-4 py-2">
              New Analysis
              <ArrowRight size={13} weight="bold" />
            </Link>
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xs">
              AB
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">

        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome back, Aldren 👋</h1>
          <p className="text-gray-400 text-sm mt-0.5">Here&rsquo;s a summary of your recent activity.</p>
        </div>

        {/* Stats row */}
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <StatCard icon={ChartBar}  iconBg="bg-brand-50"  iconColor="text-brand-600" label="Total Analyses"   value="74"   delta="12 this week" deltaDir="up" />
          <StatCard icon={Check}     iconBg="bg-green-50"  iconColor="text-green-600" label="Neutral Texts"    value="31"   delta="42% of total" deltaDir="up" />
          <StatCard icon={Warning}   iconBg="bg-amber-50"  iconColor="text-amber-600" label="Biased Detected"  value="43"   delta="58% of total" deltaDir="down" />
          <StatCard icon={Clock}     iconBg="bg-blue-50"   iconColor="text-blue-600"  label="Avg. Bias Score"  value="63%"  delta="↑ 4% vs last week" deltaDir="up" />
        </div>

        {/* Main grid */}
        <div className="grid xl:grid-cols-3 gap-6">

          {/* Recent analyses table */}
          <div className="xl:col-span-2 card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between gap-3">
              <h2 className="font-bold text-gray-900 text-sm">Recent Analyses</h2>
              <div className="flex items-center gap-2 flex-1 max-w-xs ml-auto">
                <div className="relative flex-1">
                  <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search…"
                    className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  />
                </div>
                <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors" title="Export">
                  <Export size={15} />
                </button>
              </div>
            </div>

            <div className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <div className="py-12 text-center text-sm text-gray-400">No analyses match your search.</div>
              )}
              {filtered.map((row) => (
                <div key={row.id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-gray-50/60 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate leading-snug">{row.preview}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{row.words} words · {row.date}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <ScorePill score={row.score} />
                    <VerdictBadge verdict={row.verdict} />
                    <button className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-gray-200 text-gray-400 transition-all">
                      <DotsThree size={15} weight="bold" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-gray-50 text-center">
              <Link to="/detector" className="text-xs font-medium text-brand-600 hover:underline">
                Start a new analysis →
              </Link>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-5">

            {/* Usage tracker */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-gray-900 text-sm">Monthly Usage</h2>
                <span className="text-xs text-gray-400">Free Plan</span>
              </div>
              <div className="flex items-end justify-between mb-2">
                <span className="text-3xl font-bold text-gray-900">74</span>
                <span className="text-sm text-gray-400">/ 200 analyses</span>
              </div>
              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all"
                  style={{ width: `${usedPercent}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">126 analyses remaining this month</p>
              <Link to="/pricing" className="btn-primary w-full justify-center mt-4 text-xs py-2.5">
                <Lightning size={13} weight="fill" />
                Upgrade to Pro
              </Link>
            </div>

            {/* Subscription card */}
            <div className="card p-5 border-2 border-dashed border-gray-100">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Current Plan</p>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-lg font-bold text-gray-900">Free</p>
                  <p className="text-sm text-gray-400">$0 / forever</p>
                </div>
                <span className="text-xs font-bold text-gray-400 border border-gray-200 rounded-full px-3 py-1">Active</span>
              </div>
              <ul className="space-y-2 mb-4">
                {['200 analyses / month', 'Basic detection', '3 suggestions max', 'Word highlighting'].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-gray-500">
                    <Check size={12} weight="bold" className="text-gray-400" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/pricing" className="btn-outline w-full justify-center text-xs py-2.5">
                View Pro features
              </Link>
            </div>

            {/* Quick analyze widget */}
            <div className="card p-5">
              <h2 className="font-bold text-gray-900 text-sm mb-3">Quick Analyze</h2>
              <textarea
                rows={4}
                placeholder="Paste text here to check for gender bias…"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-200 resize-none mb-3"
              />
              <Link to="/detector" className="btn-primary w-full justify-center text-xs py-2.5">
                Open Full Detector
                <ArrowRight size={12} weight="bold" />
              </Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
