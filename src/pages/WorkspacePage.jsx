import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, FilePdf, FileDoc, ClockCounterClockwise, X, ArrowRight,
  MagicWand, Check, Warning, Info, CopySimple, ArrowCounterClockwise,
  CaretDown, Sun, Moon, ArrowCircleRight, Sparkle,
} from '@phosphor-icons/react'
import { useDarkMode } from '../hooks/useDarkMode'
import { GentekWordmark } from '../components/shared/GentekLogo'

/* ─── Mock data ─────────────────────────────────────────────── */
const RECENT_FILES = [
  { name: 'Research_Paper_Draft.docx', type: 'docx', date: 'Jun 24, 2026', size: '42 KB' },
  { name: 'HR_Policy_2026.pdf',        type: 'pdf',  date: 'Jun 22, 2026', size: '118 KB' },
  { name: 'Job_Description_v3.docx',   type: 'docx', date: 'Jun 20, 2026', size: '28 KB' },
]

const BIAS_PATTERNS = [
  { word: 'chairman',         type: 'male',       suggestion: 'chairperson',          reason: 'Gendered occupational title — use a gender-neutral alternative.',                       severity: 'high'   },
  { word: 'manpower',         type: 'male',       suggestion: 'workforce',            reason: 'Male-centric compound noun — "workforce" is more inclusive.',                          severity: 'high'   },
  { word: 'businessman',      type: 'male',       suggestion: 'business professional',reason: 'Gendered occupational term — use "business professional" instead.',                   severity: 'high'   },
  { word: 'stewardess',       type: 'female',     suggestion: 'flight attendant',     reason: 'Gendered job title — the neutral term is "flight attendant".',                        severity: 'medium' },
  { word: 'fireman',          type: 'male',       suggestion: 'firefighter',          reason: 'Gendered occupational term — "firefighter" is the standard neutral form.',            severity: 'high'   },
  { word: 'policeman',        type: 'male',       suggestion: 'police officer',       reason: 'Gendered job title — "police officer" is the preferred neutral term.',                severity: 'high'   },
  { word: 'mankind',          type: 'male',       suggestion: 'humankind',            reason: 'Gender-exclusive term — "humankind" includes all genders.',                           severity: 'medium' },
  { word: 'overly emotional', type: 'stereotype', suggestion: 'highly expressive',    reason: 'Gendered emotional stereotype often applied to women unfairly.',                      severity: 'high'   },
  { word: 'bossy',            type: 'stereotype', suggestion: 'assertive',            reason: 'Term disproportionately applied to women — "assertive" is neutral.',                  severity: 'medium' },
  { word: 'nurturing',        type: 'female',     suggestion: 'supportive',           reason: 'Gendered trait stereotype — "supportive" is a more neutral descriptor.',              severity: 'low'    },
  { word: 'man-made',         type: 'male',       suggestion: 'artificial',           reason: 'Gender-exclusive compound — "artificial" or "synthetic" are neutral.',               severity: 'medium' },
  { word: 'workman',          type: 'male',       suggestion: 'worker',               reason: 'Gendered term — "worker" is the inclusive alternative.',                              severity: 'medium' },
  { word: 'lady doctor',      type: 'female',     suggestion: 'doctor',               reason: 'The "lady" prefix is unnecessary and diminishing — "doctor" is the correct title.',  severity: 'high'   },
  { word: 'girl boss',        type: 'female',     suggestion: 'leader',               reason: '"Girl" is infantilizing when applied to a professional woman.',                       severity: 'high'   },
  { word: 'hysterical',       type: 'stereotype', suggestion: 'overwhelmed',          reason: 'Historically weaponized to dismiss women\'s emotions as irrational.',                severity: 'high'   },
  { word: 'housewife',        type: 'female',     suggestion: 'homemaker',            reason: '"Housewife" assumes gender — "homemaker" is a more inclusive term.',                 severity: 'medium' },
  { word: 'spinster',         type: 'female',     suggestion: 'unmarried person',     reason: 'Gendered and stigmatizing term not applied equally to men.',                          severity: 'medium' },
  { word: 'mailman',          type: 'male',       suggestion: 'mail carrier',         reason: 'Gendered occupational term — "mail carrier" is the inclusive form.',                 severity: 'medium' },
  { word: 'congressman',      type: 'male',       suggestion: 'congressperson',       reason: 'Gendered title — "congressperson" or "representative" is preferred.',                severity: 'high'   },
]

const SAMPLES = {
  essay:   `The chairman of the board convened a meeting to discuss manpower planning for the upcoming quarter. Every businessman in the room agreed that the company needed to hire more workers. The stewardess on the corporate jet served refreshments while the team reviewed the man-made solutions proposed last week. One executive described a colleague as overly emotional during the presentation, while another praised her as bossy but effective.`,
  job:     `We are looking for a dynamic businessman to lead our sales division. The ideal candidate must be a strong leader who can manage a large manpower of field agents. He should have experience in the industry and the ability to make tough decisions. The fireman attitude — charging into difficult situations — is what we need for this role.`,
  email:   `Dear Sir or Madam, I am writing to inquire about the chairman position listed on your website. As a seasoned workman in the industry, I believe my manpower-focused management style aligns with your company's goals. I am not overly emotional and can handle high-pressure situations. Please find my resume attached.`,
  report:  `The quarterly workforce report prepared by the manpower department reveals a gender imbalance at the executive level. The board, led by the current chairman, has pledged to address this disparity. The man-made barriers that have historically limited women's advancement must be removed. Bossy behavior should never be a disqualifier for leadership roles.`,
  female:  `The new team leader was dismissed as bossy and hysterical when she challenged the restructuring proposal. The housewife demographic remains our primary target segment according to the market study. She is described as naturally nurturing and warm — exactly what we need for this client-facing role. The lady doctor on call responded to the emergency within minutes. Our stewardess will assist you with any needs throughout the flight.`,
}

/* ─── Helpers ────────────────────────────────────────────────── */
function escapeRx(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

function analyse(text) {
  const lower  = text.toLowerCase()
  const found  = BIAS_PATTERNS.filter(p => lower.includes(p.word.toLowerCase()))
  if (!found.length) return { score: 95, verdict: 'NEUTRAL', findings: [] }
  const maleC  = found.filter(f => f.type === 'male').length
  const femaleC= found.filter(f => f.type === 'female').length
  const stereoC= found.filter(f => f.type === 'stereotype').length
  const penalty= found.reduce((a, f) => a + (f.severity === 'high' ? 18 : f.severity === 'medium' ? 12 : 6), 0)
  const score  = Math.max(5, 100 - penalty)
  let verdict  = 'NEUTRAL'
  if (maleC > femaleC && maleC > stereoC)    verdict = 'MALE-BIASED'
  else if (femaleC > maleC && femaleC > stereoC) verdict = 'FEMALE-BIASED'
  else if (stereoC > 0 && stereoC >= maleC)  verdict = 'STEREOTYPE'
  return { score, verdict, findings: found }
}

function buildHtml(text, findings) {
  if (!findings.length) return { __html: text.replace(/\n/g, '<br/>') }
  let out = text
  findings.forEach(f => {
    const rx  = new RegExp(`(${escapeRx(f.word)})`, 'gi')
    const cls = f.type === 'male' ? 'bias-male' : f.type === 'female' ? 'bias-female' : 'bias-stereotype'
    out = out.replace(rx, `<mark class="${cls}">$1</mark>`)
  })
  return { __html: out.replace(/\n/g, '<br/>') }
}

const VERDICT_META = {
  'NEUTRAL':       { label: 'Gender Neutral',      color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30', ring: 'ring-emerald-200 dark:ring-emerald-700', bar: 'bg-emerald-500' },
  'MALE-BIASED':   { label: 'Male-Biased',          color: 'text-blue-600 dark:text-blue-400',      bg: 'bg-blue-50 dark:bg-blue-900/30',      ring: 'ring-blue-200 dark:ring-blue-700',      bar: 'bg-blue-500'    },
  'FEMALE-BIASED': { label: 'Female-Biased',        color: 'text-rose-600 dark:text-rose-400',      bg: 'bg-rose-50 dark:bg-rose-900/30',      ring: 'ring-rose-200 dark:ring-rose-700',      bar: 'bg-rose-500'    },
  'STEREOTYPE':    { label: 'Gendered Stereotype',  color: 'text-amber-600 dark:text-amber-400',    bg: 'bg-amber-50 dark:bg-amber-900/30',    ring: 'ring-amber-200 dark:ring-amber-700',    bar: 'bg-amber-500'   },
}

const SEV_BADGE = {
  high:   'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-700',
  medium: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-700',
  low:    'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 ring-1 ring-gray-200 dark:ring-gray-600',
}

/* ─── Score ring ─────────────────────────────────────────────── */
function ScoreRing({ score, verdict }) {
  const meta   = VERDICT_META[verdict] || VERDICT_META['NEUTRAL']
  const r      = 36
  const circ   = 2 * Math.PI * r
  const offset = circ * (1 - score / 100)
  const colour = verdict === 'NEUTRAL' ? '#10b981' : verdict === 'MALE-BIASED' ? '#3b82f6' : verdict === 'FEMALE-BIASED' ? '#f43f5e' : '#f59e0b'
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
          <circle cx="44" cy="44" r={r} strokeWidth="7" stroke="currentColor" className="text-gray-100 dark:text-gray-700" fill="none" />
          <circle cx="44" cy="44" r={r} strokeWidth="7" stroke={colour} fill="none"
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-gray-900 dark:text-white">{score}<span className="text-xs font-normal text-gray-400">%</span></span>
        </div>
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ring-1 ${meta.bg} ${meta.color} ${meta.ring}`}>
        {meta.label}
      </span>
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────────── */
export default function WorkspacePage() {
  const [dark, setDark]         = useDarkMode()
  const [text, setText]         = useState('')
  const [result, setResult]     = useState(null)
  const [loading, setLoading]   = useState(false)
  const [showPlus, setShowPlus] = useState(false)
  const [showRecent, setShowRecent] = useState(false)
  const [copied, setCopied]     = useState(false)
  const [activeFind, setActiveFind] = useState(null)

  const plusRef   = useRef(null)
  const pdfInput  = useRef(null)
  const docxInput = useRef(null)
  const resultsRef= useRef(null)

  useEffect(() => {
    function handler(e) {
      if (plusRef.current && !plusRef.current.contains(e.target)) {
        setShowPlus(false); setShowRecent(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /* scroll to results on analyze */
  useEffect(() => {
    if (result && resultsRef.current) {
      setTimeout(() => resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [result])

  function handleAnalyze() {
    if (!text.trim()) return
    setLoading(true); setResult(null); setActiveFind(null)
    setTimeout(() => { setResult(analyse(text)); setLoading(false) }, 900)
  }

  function handleClear() { setText(''); setResult(null); setActiveFind(null) }

  function handleApply(finding) {
    const rx = new RegExp(escapeRx(finding.word), 'gi')
    setText(prev => prev.replace(rx, finding.suggestion))
    setResult(null)
  }

  function handleCopy() {
    navigator.clipboard.writeText(text)
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }

  function handleFileRead(file) {
    setShowPlus(false); setShowRecent(false)
    setText(`[File loaded: ${typeof file === 'string' ? file : file.name}]\n\nPaste or type your text content here to analyse it for gender-biased language.`)
  }

  function loadSample(key) { setText(SAMPLES[key]); setResult(null) }

  const words    = text.trim() ? text.trim().split(/\s+/).length : 0
  const chars    = text.length
  const canRun   = text.trim().length > 10 && !loading
  const htmlBody = result ? buildHtml(text, result.findings) : null

  const QUICK_ACTIONS = [
    { label: 'Check Essay',           key: 'essay'  },
    { label: 'Check Job Posting',     key: 'job'    },
    { label: 'Check Email',           key: 'email'  },
    { label: 'Check Report',          key: 'report' },
    { label: 'Female Bias Example',   key: 'female' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col transition-colors duration-200">

      {/* ── Top Nav ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">

          {/* Logo */}
          <Link to="/" className="mr-auto">
            <GentekWordmark size={30} textSize="text-base" />
          </Link>

          <nav className="hidden sm:flex items-center gap-0.5">
            <Link to="/about"   className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors font-medium">About</Link>
            <Link to="/contact" className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors font-medium">Contact</Link>
            <Link to="/pricing" className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors font-medium">Pricing</Link>
          </nav>

          {/* Dark mode toggle */}
          <button
            onClick={() => setDark(d => !d)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? <Sun size={17} weight="fill" className="text-amber-400" /> : <Moon size={17} weight="fill" />}
          </button>

          <div className="flex items-center gap-2">
            <Link to="/dashboard" className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Log In
            </Link>
            <Link to="/pricing" className="px-4 py-1.5 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-full transition-colors shadow-sm">
              Sign Up Free
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main workspace ──────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center px-4 py-10 gap-6">

        {/* Greeting */}
        {!result && !loading && (
          <div className="text-center animate-fade-up">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">
              Detect gender bias in your writing
            </h1>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Paste any text — essays, emails, reports, job descriptions — and get instant AI analysis.{' '}
              <span className="text-rose-400 dark:text-rose-400 font-medium">Detects male, female, and stereotype bias.</span>
            </p>
          </div>
        )}

        {/* ── Input card ──────────────────────────────────── */}
        <div className={`w-full transition-all duration-500 ${result ? 'max-w-6xl' : 'max-w-2xl'}`}>
          <div className={`flex gap-5 ${result ? 'flex-col lg:flex-row items-start' : 'flex-col'}`}>

            {/* Input box */}
            <div className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-card flex flex-col transition-all duration-300 ${result ? 'lg:w-[46%] flex-shrink-0' : 'w-full'}`}>

              {/* Top bar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <Sparkle size={13} weight="fill" className="text-brand-500" />
                  <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Input Text</span>
                </div>
                {text && (
                  <button onClick={handleClear} className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                    <X size={13} weight="bold" />
                  </button>
                )}
              </div>

              {/* Textarea */}
              <div className="relative">
                <textarea
                  value={text}
                  onChange={e => { setText(e.target.value); if (result) setResult(null) }}
                  onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleAnalyze() }}
                  placeholder="Write, paste, or upload text to analyze gender-biased language…"
                  className="w-full min-h-[220px] resize-none px-5 pt-4 pb-14 text-sm text-gray-800 dark:text-gray-200 leading-relaxed bg-transparent focus:outline-none placeholder-gray-300 dark:placeholder-gray-600"
                />

                {/* + Upload button */}
                <div className="absolute bottom-3.5 left-4" ref={plusRef}>
                  <button
                    onClick={() => { setShowPlus(!showPlus); setShowRecent(false) }}
                    className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-brand-50 dark:hover:bg-brand-900/40 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-all"
                    title="Upload file"
                  >
                    <Plus size={13} weight="bold" />
                  </button>

                  {/* Dropdown */}
                  {showPlus && (
                    <div className="absolute bottom-9 left-0 w-56 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xl py-1.5 z-40 animate-fade-up">
                      <button onClick={() => pdfInput.current.click()}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
                        <FilePdf size={16} weight="duotone" className="text-red-500 flex-shrink-0" />
                        Upload PDF
                      </button>
                      <input ref={pdfInput} type="file" accept=".pdf" className="hidden"
                        onChange={e => e.target.files[0] && handleFileRead(e.target.files[0])} />

                      <button onClick={() => docxInput.current.click()}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
                        <FileDoc size={16} weight="duotone" className="text-blue-500 flex-shrink-0" />
                        Upload Word Document
                      </button>
                      <input ref={docxInput} type="file" accept=".docx,.doc" className="hidden"
                        onChange={e => e.target.files[0] && handleFileRead(e.target.files[0])} />

                      <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />

                      <button onClick={() => setShowRecent(!showRecent)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
                        <ClockCounterClockwise size={16} weight="duotone" className="text-gray-400 flex-shrink-0" />
                        Recent Files
                        <CaretDown size={11} className={`ml-auto transition-transform ${showRecent ? 'rotate-180' : ''}`} />
                      </button>

                      {showRecent && (
                        <div className="bg-gray-50/80 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700">
                          {RECENT_FILES.map(f => (
                            <button key={f.name} onClick={() => handleFileRead(f.name)}
                              className="w-full flex items-start gap-2.5 px-4 py-2 hover:bg-white dark:hover:bg-gray-700 transition-colors text-left">
                              {f.type === 'pdf'
                                ? <FilePdf size={14} weight="duotone" className="text-red-400 mt-0.5 flex-shrink-0" />
                                : <FileDoc size={14} weight="duotone" className="text-blue-400 mt-0.5 flex-shrink-0" />}
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">{f.name}</p>
                                <p className="text-[10px] text-gray-400">{f.date} · {f.size}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Submit arrow */}
                <button
                  onClick={handleAnalyze}
                  disabled={!canRun}
                  className="absolute bottom-3 right-4 w-8 h-8 rounded-full bg-brand-600 hover:bg-brand-700 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all active:scale-95 shadow-sm"
                  title="Analyze Text (⌘Enter)"
                >
                  {loading
                    ? <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    : <ArrowCircleRight size={18} weight="fill" />
                  }
                </button>
              </div>

              {/* Bottom meta */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-50 dark:border-gray-800">
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>{words} words</span>
                  <span className="text-gray-200 dark:text-gray-700">·</span>
                  <span>{chars} chars</span>
                </div>
                <div className="flex items-center gap-2">
                  {text && (
                    <button onClick={handleCopy} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Copy">
                      {copied ? <Check size={13} weight="bold" className="text-green-500" /> : <CopySimple size={13} />}
                    </button>
                  )}
                  <button
                    onClick={handleAnalyze}
                    disabled={!canRun}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-full shadow-sm transition-all active:scale-95"
                  >
                    <MagicWand size={12} weight="fill" />
                    {loading ? 'Analyzing…' : 'Analyze Text'}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Results (right column after analyze) ──────── */}
            {result && (
              <div ref={resultsRef} className="flex-1 flex flex-col gap-3 animate-fade-up">

                {/* Score + breakdown */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-card p-5">
                  <div className="flex items-start gap-5">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Bias Score</p>
                      <ScoreRing score={result.score} verdict={result.verdict} />
                    </div>
                    <div className="flex-1 space-y-2.5 pt-0.5">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Breakdown</p>
                      {[
                        { label: 'Male-Biased',   count: result.findings.filter(f=>f.type==='male').length,       bar: 'bg-blue-500' },
                        { label: 'Female-Biased', count: result.findings.filter(f=>f.type==='female').length,     bar: 'bg-rose-500' },
                        { label: 'Stereotype',    count: result.findings.filter(f=>f.type==='stereotype').length, bar: 'bg-amber-500' },
                      ].map(b => (
                        <div key={b.label}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500 dark:text-gray-400">{b.label}</span>
                            <span className="font-semibold text-gray-700 dark:text-gray-200">{b.count}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${b.bar}`}
                              style={{ width: `${Math.min(100, b.count * 25)}%`, transition: 'width 0.8s ease' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Highlighted text */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-card overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Highlighted Text</span>
                    <div className="flex gap-3 text-[10px] font-semibold text-gray-400">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-200 border-b-2 border-blue-500 inline-block"/>Male</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-200 border-b-2 border-rose-500 inline-block"/>Female</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-100 border-b-2 border-amber-400 inline-block"/>Stereotype</span>
                    </div>
                  </div>
                  <div className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed max-h-40 overflow-y-auto"
                    dangerouslySetInnerHTML={htmlBody} />
                </div>

                {/* Suggestions */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-card overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Suggestions
                      {result.findings.length > 0 && (
                        <span className="ml-2 bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                          {result.findings.length}
                        </span>
                      )}
                    </span>
                    {result.findings.length > 0 && (
                      <button onClick={() => result.findings.forEach(handleApply)}
                        className="flex items-center gap-1 text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:text-brand-800 transition-colors">
                        <ArrowCounterClockwise size={11} weight="bold" />
                        Apply All
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-gray-50 dark:divide-gray-800 max-h-64 overflow-y-auto">
                    {result.findings.length === 0 ? (
                      <div className="py-10 text-center">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-2">
                          <Check size={18} weight="bold" className="text-emerald-500" />
                        </div>
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">No bias detected</p>
                        <p className="text-xs text-gray-400 mt-0.5">Your text uses inclusive language.</p>
                      </div>
                    ) : result.findings.map((f, i) => (
                      <div key={i}
                        className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors cursor-pointer ${activeFind === i ? 'bg-brand-50/40 dark:bg-brand-900/20' : ''}`}
                        onClick={() => setActiveFind(activeFind === i ? null : i)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${SEV_BADGE[f.severity]}`}>{f.severity}</span>
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 line-through decoration-red-400">{f.word}</span>
                            <ArrowRight size={11} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
                            <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">{f.suggestion}</span>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); handleApply(f) }}
                            className="flex-shrink-0 px-2.5 py-1 text-[11px] font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 hover:bg-brand-100 dark:hover:bg-brand-900/50 rounded-full transition-colors"
                          >
                            Apply
                          </button>
                        </div>
                        {activeFind === i && (
                          <div className="mt-2 flex items-start gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2">
                            <Info size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{f.reason}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Severity summary */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-card px-5 py-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Severity</p>
                  <div className="flex gap-3">
                    {[
                      { sev: 'high',   label: 'High',   bg: 'bg-red-50 dark:bg-red-900/20',   text: 'text-red-600 dark:text-red-400' },
                      { sev: 'medium', label: 'Medium', bg: 'bg-amber-50 dark:bg-amber-900/20',text: 'text-amber-600 dark:text-amber-400' },
                      { sev: 'low',    label: 'Low',    bg: 'bg-gray-50 dark:bg-gray-800',     text: 'text-gray-500 dark:text-gray-400' },
                    ].map(s => {
                      const cnt = result.findings.filter(f => f.severity === s.sev).length
                      return (
                        <div key={s.sev} className={`flex-1 ${s.bg} rounded-xl px-3 py-2.5 text-center`}>
                          <div className={`text-xl font-bold ${s.text}`}>{cnt}</div>
                          <div className="text-[10px] font-semibold text-gray-400 mt-0.5">{s.label}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Empty results hint (desktop only, before analyze) */}
            {!result && !loading && (
              <div className="hidden lg:flex flex-col items-center justify-center text-center gap-3 py-8 px-6 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 w-72 flex-shrink-0 self-center opacity-0 pointer-events-none">
              </div>
            )}
          </div>
        </div>

        {/* ── Quick action chips ───────────────────────────── */}
        {!result && !loading && (
          <div className="w-full max-w-2xl animate-fade-up" style={{ animationDelay: '0.1s' }}>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center mb-3">Try a sample →</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_ACTIONS.map(a => (
                <button key={a.key} onClick={() => loadSample(a.key)}
                  className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 hover:bg-brand-50 dark:hover:bg-brand-900/30 border border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-600 text-gray-600 dark:text-gray-300 hover:text-brand-700 dark:hover:text-brand-300 rounded-full transition-all shadow-sm">
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading pulse */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-6 animate-fade-up">
            <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/50 flex items-center justify-center">
              <MagicWand size={20} weight="duotone" className="text-brand-600 dark:text-brand-400 animate-pulse" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Analyzing your text for gender bias…</p>
          </div>
        )}

        {/* Color legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-gray-400 dark:text-gray-500 pb-4">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-200 border-b-2 border-blue-500 inline-block"/> Male-biased</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-200 border-b-2 border-rose-500 inline-block"/> Female-biased</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border-b-2 border-amber-400 inline-block"/> Stereotype</span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span className="text-gray-400 dark:text-gray-500">Press ⌘Enter to analyze</span>
        </div>
      </main>
    </div>
  )
}
