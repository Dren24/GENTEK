import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, SpinnerGap, WarningCircle, CheckCircle, ClipboardText,
  Trash, DownloadSimple, Copy, Info, List, X, Plus,
  ClockCounterClockwise, Tag, Gear, Question, ArrowLeft,
  FileText, Lightning, CaretRight,
} from '@phosphor-icons/react'
import GentekMark, { BrainIcon } from '../components/shared/GentekLogo'

/* ── Bias patterns ── */
const SAMPLE_MALE   = 'The chairman of the board approved the proposal. She was overly emotional during the negotiation. The manpower required for this project is significant. Every businessman understands the risks involved in this field. The stewardess welcomed all guests on board.'
const SAMPLE_FEMALE = 'The new manager was dismissed as bossy and hysterical when she proposed the restructuring. A nurturing housewife type is better suited for this client-facing role, the report noted. The lady doctor on call responded professionally. Our stewardess welcomed every passenger with a warm smile.'

const BIAS_PATTERNS = [
  { word: 'chairman',        type: 'male',       suggestion: 'chairperson',          reason: 'Gendered occupational title' },
  { word: 'manpower',        type: 'male',       suggestion: 'workforce',             reason: 'Male-centric compound noun' },
  { word: 'businessman',     type: 'male',       suggestion: 'business professional', reason: 'Gendered occupational term' },
  { word: 'fireman',         type: 'male',       suggestion: 'firefighter',           reason: 'Gendered occupational term' },
  { word: 'policeman',       type: 'male',       suggestion: 'police officer',        reason: 'Gendered job title' },
  { word: 'mankind',         type: 'male',       suggestion: 'humankind',             reason: 'Gender-exclusive term' },
  { word: 'man-made',        type: 'male',       suggestion: 'artificial',            reason: 'Gender-exclusive compound' },
  { word: 'overly emotional',type: 'stereotype', suggestion: 'highly expressive',     reason: 'Gendered emotional stereotype' },
  { word: 'bossy',           type: 'stereotype', suggestion: 'assertive',             reason: 'Term disproportionately applied to women' },
  { word: 'hysterical',      type: 'stereotype', suggestion: 'overwhelmed',           reason: "Historically used to dismiss women's emotions" },
  { word: 'stewardess',      type: 'female',     suggestion: 'flight attendant',      reason: 'Gendered occupational role' },
  { word: 'housewife',       type: 'female',     suggestion: 'homemaker',             reason: 'Gendered term' },
  { word: 'nurturing',       type: 'female',     suggestion: 'supportive',            reason: 'Gendered trait stereotype' },
  { word: 'lady doctor',     type: 'female',     suggestion: 'doctor',                reason: 'The "lady" prefix is unnecessary' },
  { word: 'girl boss',       type: 'female',     suggestion: 'leader',                reason: '"Girl" is infantilizing for professionals' },
  { word: 'spinster',        type: 'female',     suggestion: 'unmarried person',      reason: 'Gendered and stigmatizing term' },
]

function highlightText(text, detected) {
  let result = text
  detected.forEach(({ word, type }) => {
    const cls   = type === 'male' ? 'bias-male' : type === 'female' ? 'bias-female' : 'bias-stereotype'
    const regex = new RegExp(`\\b${word.replace(/\s+/g, '\\s+')}\\b`, 'gi')
    result = result.replace(regex, `<mark class="${cls}">${word}</mark>`)
  })
  return result
}

/* ── Mock history ── */
const HISTORY = [
  { id: 1, label: 'Job posting — Dev Lead',   tag: 'male',      score: 72, date: 'Today'     },
  { id: 2, label: 'Essay on leadership',       tag: 'female',    score: 55, date: 'Today'     },
  { id: 3, label: 'HR Policy v2',              tag: 'neutral',   score: 8,  date: 'Yesterday'  },
  { id: 4, label: 'Research paper abstract',   tag: 'stereotype',score: 38, date: 'Yesterday'  },
  { id: 5, label: 'Annual report intro',       tag: 'male',      score: 61, date: 'Mon'        },
  { id: 6, label: 'Email to board',            tag: 'neutral',   score: 4,  date: 'Mon'        },
]

const TAG_COLOR = {
  male:       'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  female:     'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  stereotype: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  neutral:    'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
}

/* ── Score ring ── */
function ScoreRing({ score, color }) {
  const r = 34, circ = 2 * Math.PI * r
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-20 h-20">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#f1f5f9" strokeWidth="7" />
          <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7"
            strokeLinecap="round" strokeDasharray={circ}
            strokeDashoffset={circ - (score / 100) * circ}
            style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-base font-bold text-gray-800 dark:text-white">{score}%</span>
        </div>
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 text-center">Bias Score</span>
    </div>
  )
}

/* ═══════════════ SIDEBAR ═══════════════ */
function Sidebar({ open, onClose, onNewAnalysis }) {
  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside className={`
        fixed md:relative top-0 left-0 h-full z-40 md:z-auto
        flex flex-col bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
        transition-all duration-300 ease-in-out
        ${open ? 'w-64 translate-x-0' : 'w-0 md:w-14 -translate-x-full md:translate-x-0'}
        overflow-hidden flex-shrink-0
      `}>
        {/* Sidebar header */}
        <div className="flex items-center justify-between h-14 px-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          {open && (
            <Link to="/" className="flex items-center gap-2">
              <GentekMark size={28} />
              <span className="font-extrabold text-sm text-gray-900 dark:text-white tracking-tight">
                GEN<span className="text-brand-600">TEK</span>
              </span>
            </Link>
          )}
          {!open && <div className="w-full flex justify-center"><GentekMark size={28} /></div>}
        </div>

        {/* New Analysis button */}
        <div className="px-2 pt-3 pb-2 flex-shrink-0">
          <button
            onClick={onNewAnalysis}
            className={`w-full flex items-center gap-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-xl transition-all shadow-btn hover:shadow-none active:scale-95 ${open ? 'px-3 py-2.5' : 'justify-center p-2.5'}`}
          >
            <Plus size={16} weight="bold" className="flex-shrink-0" />
            {open && 'New Analysis'}
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto editor-scroll">

          {/* Recent Analyses */}
          {open && (
            <div className="px-3 pt-2 pb-1">
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 px-1">
                Recent
              </p>
              <div className="space-y-0.5">
                {HISTORY.map(h => (
                  <button
                    key={h.id}
                    className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white dark:hover:bg-gray-800 transition-colors group text-left"
                  >
                    <FileText size={14} className="text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{h.label}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">{h.date} · {h.score}% bias</p>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${TAG_COLOR[h.tag]}`}>
                      {h.tag === 'neutral' ? '✓' : h.tag.slice(0,1).toUpperCase()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Collapsed — icon-only nav items */}
          {!open && (
            <div className="px-2 pt-2 space-y-1">
              {[
                { icon: ClockCounterClockwise, tip: 'History'    },
                { icon: Tag,                   tip: 'Categories' },
                { icon: Lightning,             tip: 'Upgrade'    },
              ].map(({ icon: Icon, tip }) => (
                <button key={tip} title={tip} className="w-full flex justify-center p-2.5 rounded-xl text-gray-400 hover:text-brand-600 hover:bg-white dark:hover:bg-gray-800 transition-colors">
                  <Icon size={18} />
                </button>
              ))}
            </div>
          )}

          {/* Bias Categories */}
          {open && (
            <div className="px-3 pt-4 pb-2">
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 px-1">
                Bias Categories
              </p>
              {[
                { label: 'Male-Biased',    color: 'bg-blue-500',  count: 9  },
                { label: 'Female-Biased',  color: 'bg-rose-500',  count: 6  },
                { label: 'Stereotype',     color: 'bg-amber-500', count: 4  },
              ].map(c => (
                <button key={c.label} className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white dark:hover:bg-gray-800 transition-colors group">
                  <span className={`w-2.5 h-2.5 rounded-full ${c.color} flex-shrink-0`} />
                  <span className="text-xs text-gray-600 dark:text-gray-400 flex-1 text-left">{c.label}</span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">{c.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Upgrade banner */}
          {open && (
            <div className="mx-3 mt-4 p-3 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800">
              <div className="flex items-center gap-1.5 mb-1">
                <Lightning size={12} weight="fill" className="text-brand-600" />
                <span className="text-xs font-bold text-brand-700 dark:text-brand-300">Go Pro</span>
              </div>
              <p className="text-[11px] text-brand-600 dark:text-brand-400 leading-relaxed mb-2">
                Unlimited analyses, export, history & API access.
              </p>
              <Link to="/pricing" className="block text-center text-[11px] font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-1.5 transition-colors">
                Upgrade →
              </Link>
            </div>
          )}
        </div>

        {/* Bottom nav */}
        <div className={`border-t border-gray-200 dark:border-gray-800 py-2 flex-shrink-0 ${open ? 'px-3 space-y-0.5' : 'px-2 space-y-1'}`}>
          {[
            { icon: Gear,     label: 'Settings', tip: 'Settings' },
            { icon: Question, label: 'Help',     tip: 'Help'     },
          ].map(({ icon: Icon, label, tip }) => (
            <button
              key={label}
              title={!open ? tip : undefined}
              className={`flex items-center gap-2.5 text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-gray-800 rounded-xl transition-colors text-xs font-medium ${open ? 'w-full px-2 py-2' : 'w-full justify-center p-2.5'}`}
            >
              <Icon size={16} className="flex-shrink-0" />
              {open && label}
            </button>
          ))}
          {open && (
            <Link
              to="/"
              className="flex items-center gap-2.5 text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-gray-800 rounded-xl transition-colors text-xs font-medium w-full px-2 py-2"
            >
              <ArrowLeft size={16} className="flex-shrink-0" />
              Back to Home
            </Link>
          )}
        </div>
      </aside>
    </>
  )
}

/* ═══════════════ MAIN ═══════════════ */
export default function DetectorPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [text, setText]               = useState('')
  const [analyzing, setAnalyzing]     = useState(false)
  const [results, setResults]         = useState(null)
  const [copied, setCopied]           = useState(false)
  const textareaRef                   = useRef(null)

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
  const charCount = text.length

  const analyze = () => {
    if (!text.trim() || wordCount < 3) return
    setAnalyzing(true); setResults(null)
    setTimeout(() => {
      const detected = BIAS_PATTERNS.filter(p => text.toLowerCase().includes(p.word.toLowerCase()))
      const male   = detected.filter(p => p.type === 'male').length
      const female = detected.filter(p => p.type === 'female').length
      const stereo = detected.filter(p => p.type === 'stereotype').length
      let label = 'GENDER-NEUTRAL', score = 4, scoreColor = '#0D9488'
      if (male > female && male > 0)        { label = 'MALE-BIASED';   score = Math.min(95, 40 + male*15 + stereo*8); scoreColor = '#3B82F6' }
      else if (female > male && female > 0) { label = 'FEMALE-BIASED'; score = Math.min(95, 40 + female*15 + stereo*8); scoreColor = '#F43F5E' }
      else if (detected.length > 0)         { label = 'MIXED-BIAS';    score = 28 + detected.length*10; scoreColor = '#F59E0B' }
      setResults({ html: highlightText(text, detected), label, score, scoreColor, detected, words: text.trim().split(/\s+/).length })
      setAnalyzing(false)
    }, 1800)
  }

  const clear        = () => { setText(''); setResults(null); textareaRef.current?.focus() }
  const newAnalysis  = () => { clear() }
  const applyAll     = () => {
    if (!results) return
    setText(t => {
      let out = t
      results.detected.forEach(d => { out = out.replace(new RegExp(`\\b${d.word}\\b`, 'gi'), d.suggestion) })
      return out
    })
    setResults(null)
  }
  const copyResults  = () => {
    if (!results) return
    const plain = results.detected.map(d => `${d.word} -> ${d.suggestion} (${d.reason})`).join('\n')
    navigator.clipboard.writeText(`Bias Classification: ${results.label}\nScore: ${results.score}%\n\nSuggestions:\n${plain}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const classColor = !results ? '' :
    results.label === 'MALE-BIASED'    ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' :
    results.label === 'FEMALE-BIASED'  ? 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700' :
    results.label === 'GENDER-NEUTRAL' ? 'bg-brand-100 text-brand-700 border-brand-200 dark:bg-brand-900/30 dark:text-brand-300 dark:border-brand-700' :
                                         'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700'

  return (
    <div className="h-screen flex overflow-hidden bg-white dark:bg-gray-950">

      {/* ── LEFT SIDEBAR ── */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNewAnalysis={newAnalysis} />

      {/* ── MAIN AREA ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="h-14 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center px-3 gap-3 flex-shrink-0 sticky top-0 z-20">
          {/* Hamburger */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
            title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? <X size={18} weight="bold" /> : <List size={18} weight="bold" />}
          </button>

          <div className="h-5 w-px bg-gray-200 dark:bg-gray-700" />

          {/* Mode tabs */}
          <div className="flex items-center gap-1">
            <button className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 bg-brand-50 dark:bg-brand-900/30 rounded-lg px-3 py-1.5">
              <BrainIcon size={13} color="#0D9488" faceColor="white" />Basic
            </button>
            <button className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg px-3 py-1.5 transition-colors">
              Advanced
              <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full">PRO</span>
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/pricing"
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 border border-brand-200 dark:border-brand-700 bg-brand-50 dark:bg-brand-900/20 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Lightning size={12} weight="fill" />
              Upgrade to Pro
            </Link>
            <Link
              to="/"
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ArrowLeft size={14} />
              <span className="hidden sm:block">Home</span>
            </Link>
          </div>
        </header>

        {/* Editor split */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

          {/* LEFT: Input */}
          <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-800 min-h-[300px] md:min-h-0">
            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/60 dark:bg-gray-800/60">
              <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Original Text</span>
              <div className="flex items-center gap-1">
                <button onClick={() => { setText(SAMPLE_MALE); setResults(null) }}
                  className="text-xs text-blue-500 hover:text-blue-700 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
                  Male sample
                </button>
                <button onClick={() => { setText(SAMPLE_FEMALE); setResults(null) }}
                  className="text-xs text-rose-500 hover:text-rose-700 font-medium px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors">
                  Female sample
                </button>
                {text && (
                  <button onClick={clear} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1">
                    <Trash size={12} />Clear
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => { setText(e.target.value); setResults(null) }}
                onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); analyze() } }}
                placeholder={"Enter or paste your text here to analyze for gender bias...\n\nTry: job advertisements, academic papers, essays, reports, or any written content."}
                className="w-full h-full p-5 text-[15px] text-gray-700 dark:text-gray-200 leading-relaxed resize-none outline-none bg-transparent editor-scroll placeholder-gray-300 dark:placeholder-gray-600"
              />
            </div>

            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                <span>{wordCount} words</span>
                <span className="text-gray-200 dark:text-gray-700">|</span>
                <span>{charCount} chars</span>
                {wordCount > 0 && wordCount < 10 && (
                  <span className="text-amber-500 flex items-center gap-1"><Info size={12} />Add more text</span>
                )}
              </div>
              <button
                onClick={analyze}
                disabled={!text.trim() || analyzing || wordCount < 3}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {analyzing
                  ? <><SpinnerGap size={15} className="animate-spin" />Analyzing…</>
                  : <><BrainIcon size={15} color="white" faceColor="#0D9488" />Analyze Text<ArrowRight size={13} weight="bold" /></>}
              </button>
            </div>
          </div>

          {/* RIGHT: Results */}
          <div className="flex-1 flex flex-col bg-gray-50/40 dark:bg-gray-900 min-h-[300px] md:min-h-0 overflow-y-auto editor-scroll">
            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 flex items-center justify-between sticky top-0">
              <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Analysis Results</span>
              {results && (
                <div className="flex items-center gap-1">
                  <button onClick={copyResults} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <Copy size={12} />{copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <DownloadSimple size={12} />Export
                  </button>
                </div>
              )}
            </div>

            {/* Empty state */}
            {!results && !analyzing && (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-16">
                <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-900/30 border border-brand-100 dark:border-brand-700 flex items-center justify-center mb-5">
                  <ClipboardText size={28} weight="duotone" className="text-brand-400" />
                </div>
                <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">No analysis yet</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs leading-relaxed">
                  Enter or paste your text on the left, then click <strong>Analyze Text</strong>.
                </p>
                <div className="mt-5 flex items-center gap-3">
                  <button onClick={() => { setText(SAMPLE_MALE); setResults(null) }}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 underline underline-offset-2">
                    Try male bias sample
                  </button>
                  <span className="text-gray-300 dark:text-gray-700">·</span>
                  <button onClick={() => { setText(SAMPLE_FEMALE); setResults(null) }}
                    className="text-sm font-medium text-rose-600 hover:text-rose-700 underline underline-offset-2">
                    Try female bias sample
                  </button>
                </div>
              </div>
            )}

            {/* Skeleton */}
            {analyzing && (
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl skeleton" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3 skeleton rounded w-1/3" />
                    <div className="h-2 skeleton rounded w-1/4" />
                  </div>
                </div>
                {[90,75,60,85,50].map((w,i) => <div key={i} className="h-3 skeleton rounded" style={{width:`${w}%`}} />)}
                <div className="pt-4 space-y-2">
                  {[1,2,3].map(j => <div key={j} className="h-12 skeleton rounded-xl" />)}
                </div>
              </div>
            )}

            {/* Results */}
            {results && (
              <div className="p-5 space-y-5">
                {/* Score row */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex items-center gap-5 flex-wrap">
                  <ScoreRing score={results.score} color={results.scoreColor} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`text-xs font-bold px-3 py-1 rounded-full border ${classColor}`}>{results.label}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {results.detected.length} pattern{results.detected.length !== 1 ? 's' : ''} in {results.words} words
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      {results.detected.length === 0
                        ? 'No significant gender bias detected in this text.'
                        : `${results.detected.length} gendered term${results.detected.length !== 1 ? 's' : ''} found. Review highlighted text and apply suggestions below.`}
                    </p>
                  </div>
                </div>

                {/* Highlighted text */}
                {results.detected.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Highlighted Text</p>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 text-[14px] text-gray-700 dark:text-gray-200 leading-[1.95]"
                      dangerouslySetInnerHTML={{ __html: results.html }} />
                    <div className="flex flex-wrap gap-4 mt-2.5">
                      {[
                        { cls:'bias-male',       label:'Male-biased'  },
                        { cls:'bias-female',     label:'Female-biased'},
                        { cls:'bias-stereotype', label:'Stereotype'   },
                      ].map(l => (
                        <div key={l.label} className="flex items-center gap-1.5">
                          <mark className={`${l.cls} text-[10px] px-1.5`}>{l.label.split('-')[0]}</mark>
                          <span className="text-xs text-gray-400 dark:text-gray-500">{l.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                {results.detected.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                        Suggestions
                      </p>
                      <button
                        onClick={applyAll}
                        className="text-[11px] font-bold text-white bg-brand-600 hover:bg-brand-700 px-3 py-1 rounded-lg transition-colors shadow-sm"
                      >
                        Apply All
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      {results.detected.map(d => (
                        <div key={d.word} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-3.5 flex items-start gap-3">
                          <CaretRight size={14} className="text-brand-500 mt-0.5 flex-shrink-0" weight="bold" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <span className="text-sm text-gray-500 dark:text-gray-400 line-through">{d.word}</span>
                              <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">{d.suggestion}</span>
                            </div>
                            <span className="text-xs text-gray-400 dark:text-gray-500">{d.reason}</span>
                          </div>
                          <button
                            onClick={() => { setText(text.replace(new RegExp(`\\b${d.word}\\b`,'gi'), d.suggestion)); setResults(null) }}
                            className="flex-shrink-0 text-[11px] font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 hover:bg-brand-100 dark:hover:bg-brand-900/50 border border-brand-100 dark:border-brand-700 px-2.5 py-1 rounded-lg transition-colors"
                          >Apply</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-brand-50 dark:bg-brand-900/20 rounded-2xl border border-brand-100 dark:border-brand-800 p-4 flex items-center gap-3">
                    <CheckCircle size={22} weight="fill" className="text-brand-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-brand-800 dark:text-brand-300">No bias detected</p>
                      <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5">Your text uses gender-inclusive language.</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
                  <WarningCircle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                    Demo analysis using mock NLP pattern matching. Full AI model coming in the next release.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
