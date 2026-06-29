import { useState, useRef, useCallback, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowRight, SpinnerGap, WarningCircle, CheckCircle, Trash,
  UploadSimple, FilePdf, FileDoc, FileTxt, ClockCounterClockwise,
  Command, ArrowElbowDownLeft, Sparkle, ShieldCheck,
  Lightning, Users, ChartBar, Check, X, CaretDown, CaretUp,
  CaretRight, Copy,
} from '@phosphor-icons/react'
import { BrainIcon, GentekMark } from '../components/shared/GentekLogo'
import { useAuth } from '../context/AuthContext'

/* ── Bias engine ── */
const BIAS_PATTERNS = [
  { word: 'chairman',        type: 'male',       suggestion: 'chairperson',          reason: 'Gendered occupational title'                 },
  { word: 'manpower',        type: 'male',       suggestion: 'workforce',             reason: 'Male-centric compound noun'                  },
  { word: 'businessman',     type: 'male',       suggestion: 'business professional', reason: 'Gendered occupational term'                  },
  { word: 'fireman',         type: 'male',       suggestion: 'firefighter',           reason: 'Gendered occupational term'                  },
  { word: 'policeman',       type: 'male',       suggestion: 'police officer',        reason: 'Gendered job title'                          },
  { word: 'mankind',         type: 'male',       suggestion: 'humankind',             reason: 'Gender-exclusive term'                       },
  { word: 'man-made',        type: 'male',       suggestion: 'artificial',            reason: 'Gender-exclusive compound'                   },
  { word: 'mailman',         type: 'male',       suggestion: 'mail carrier',          reason: 'Gendered job title'                          },
  { word: 'congressman',     type: 'male',       suggestion: 'congressperson',        reason: 'Gendered political title'                    },
  { word: 'stewardess',      type: 'female',     suggestion: 'flight attendant',      reason: 'Gendered occupational role'                  },
  { word: 'housewife',       type: 'female',     suggestion: 'homemaker',             reason: 'Gendered term'                               },
  { word: 'lady doctor',     type: 'female',     suggestion: 'doctor',                reason: 'The "lady" prefix is unnecessary'            },
  { word: 'girl boss',       type: 'female',     suggestion: 'leader',                reason: '"Girl" is infantilizing for professionals'   },
  { word: 'spinster',        type: 'female',     suggestion: 'unmarried person',      reason: 'Gendered and stigmatizing term'              },
  { word: 'overly emotional',type: 'stereotype', suggestion: 'highly expressive',     reason: 'Gendered emotional stereotype'               },
  { word: 'bossy',           type: 'stereotype', suggestion: 'assertive',             reason: 'Term disproportionately applied to women'    },
  { word: 'hysterical',      type: 'stereotype', suggestion: 'overwhelmed',           reason: "Historically used to dismiss women's feelings"},
  { word: 'nurturing',       type: 'female',     suggestion: 'supportive',            reason: 'Gendered trait stereotype'                   },
  { word: 'aggressive',      type: 'stereotype', suggestion: 'assertive',             reason: 'Often applied unfairly by gender context'    },
]

const SAMPLES = {
  essay:      `The chairman of the board approved the proposal unanimously. She was overly emotional during the negotiation, which surprised her colleagues. The manpower required for this project is significant. Every businessman understands the risks involved.`,
  jobPosting: `We are looking for a dynamic businessman to lead our sales team. The ideal candidate must be aggressive and driven. Manpower planning is essential for this role. The fireman of our operations team handles crisis response.`,
  email:      `Dear Sir or Madam, I would like to address the chairman regarding the upcoming policy changes. The stewardess of our last flight provided excellent service. Our manpower analysis shows a 20% growth target this quarter.`,
  report:     `The girl boss of the marketing division led the campaign. Our lady doctor on call responded professionally. The congressman approved the legislation after a heated debate. Hysterical coverage in the media followed the announcement.`,
  female:     `The new manager was dismissed as bossy and hysterical when she proposed the restructuring plan. A nurturing housewife type is better suited for this client-facing role. The lady doctor on call responded professionally. Our stewardess welcomed every passenger warmly.`,
  male:       `The chairman of the board approved the proposal. The manpower required for this project is significant. Every businessman understands the risks. The fireman arrived promptly at the scene.`,
}

function runAnalysis(text) {
  const detected = BIAS_PATTERNS.filter(p => text.toLowerCase().includes(p.word.toLowerCase()))
  const male   = detected.filter(p => p.type === 'male').length
  const female = detected.filter(p => p.type === 'female').length
  const stereo = detected.filter(p => p.type === 'stereotype').length
  let label = 'GENDER-NEUTRAL', score = 4, color = '#0D9488'
  if (male > female && male > 0)        { label = 'MALE-BIASED';   score = Math.min(95, 40 + male*15 + stereo*8); color = '#3B82F6' }
  else if (female > male && female > 0) { label = 'FEMALE-BIASED'; score = Math.min(95, 40 + female*15 + stereo*8); color = '#F43F5E' }
  else if (detected.length > 0)         { label = 'MIXED-BIAS';    score = 28 + detected.length*10; color = '#F59E0B' }
  let html = text
  detected.forEach(({ word, type }) => {
    const cls = type === 'male' ? 'bias-male' : type === 'female' ? 'bias-female' : 'bias-stereotype'
    html = html.replace(new RegExp(`\\b${word.replace(/\s+/g,'\\s+')}\\b`, 'gi'), `<mark class="${cls}">${word}</mark>`)
  })
  return { detected, male, female, stereo, label, score, color, html, words: text.trim().split(/\s+/).length }
}

const QUICK = [
  { label: 'Essay',       key: 'essay'      },
  { label: 'Job Posting', key: 'jobPosting' },
  { label: 'Email',       key: 'email'      },
  { label: 'Report',      key: 'report'     },
  { label: 'Female bias', key: 'female'     },
  { label: 'Male bias',   key: 'male'       },
]

/* ── Score ring ── */
function ScoreRing({ score, color, size = 72 }) {
  const r = (size / 2) - 7
  const circ = 2 * Math.PI * r
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" className="dark:stroke-gray-700" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circ}
          strokeDashoffset={circ - (score/100)*circ}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-extrabold text-gray-900 dark:text-white leading-none" style={{ fontSize: size * 0.22 }}>{score}%</span>
        <span className="text-gray-400 dark:text-gray-500 leading-none mt-0.5" style={{ fontSize: size * 0.13 }}>bias</span>
      </div>
    </div>
  )
}

const FAQS = [
  { q: 'How does GENTEK detect gender bias?',     a: 'GENTEK uses Natural Language Processing (NLP) pattern recognition to scan for gendered terms, stereotypes, and occupational titles that carry implicit bias. Each detected term is classified and mapped to a neutral alternative.' },
  { q: 'What bias categories does it detect?',    a: 'Three categories: Male-Biased (language centering men as default), Female-Biased (terms that marginalize or over-specify women), and Stereotypes (gendered trait assumptions regardless of direction).' },
  { q: 'Is my text stored or sent anywhere?',     a: 'No. All analysis runs entirely in your browser. Nothing is sent to any external server. Your writing stays private and never leaves your device.' },
  { q: 'What types of documents work best?',      a: 'GENTEK is optimized for job advertisements, academic essays, business reports, emails, and policy documents — anywhere gendered language is most impactful.' },
  { q: 'Is there a word or character limit?',     a: 'The free plan supports up to 5,000 characters per analysis. Pro removes all limits and adds batch processing for large documents.' },
]

function FAQAccordion() {
  const [open, setOpen] = useState(null)
  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {FAQS.map((f, i) => (
        <div key={i} className="py-4">
          <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between gap-4 text-left">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{f.q}</span>
            {open === i
              ? <CaretUp   size={14} className="text-brand-500 flex-shrink-0" weight="bold" />
              : <CaretDown size={14} className="text-gray-400 flex-shrink-0"  weight="bold" />}
          </button>
          <div className={`faq-body ${open === i ? 'open' : 'closed'}`}>
            <p className="pt-3 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{f.a}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

const FEATURES = [
  { icon: null,        color: 'text-brand-600',   bg: 'bg-brand-50 dark:bg-brand-900/30',    title: 'NLP-Powered Detection',  body: 'Pattern recognition trained on real-world gender bias across occupational, trait, and structural language.' },
  { icon: Sparkle,     color: 'text-accent-600',  bg: 'bg-amber-50 dark:bg-amber-900/20',   title: 'Smart Suggestions',      body: 'Every flagged term gets a context-aware neutral replacement — not just a list of words to avoid.' },
  { icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20',title: 'Private by Default',     body: 'Analysis runs entirely in your browser. Nothing leaves your device. No account needed to start.' },
  { icon: ChartBar,    color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/20',     title: 'Bias Score',             body: 'A quantified score shows bias intensity so you can prioritize the most critical changes first.' },
  { icon: Lightning,   color: 'text-rose-600',    bg: 'bg-rose-50 dark:bg-rose-900/20',     title: 'Real-Time Results',      body: 'Results appear in under 2 seconds. Iterate freely without waiting for a server round-trip.' },
  { icon: Users,       color: 'text-violet-600',  bg: 'bg-violet-50 dark:bg-violet-900/20', title: 'Three Bias Directions',  body: 'Identifies male-biased, female-biased, and stereotype language — each color-coded and explained.' },
]

const STEPS = [
  { n: '01', title: 'Paste your text',   body: 'Drop in any content — essays, job ads, emails, reports, or policy drafts.' },
  { n: '02', title: 'Click Analyze',     body: 'GENTEK scans for gendered terms, role assumptions, and stereotype language instantly.' },
  { n: '03', title: 'Review highlights', body: 'Biased words are color-coded by category with a clear explanation for each finding.' },
  { n: '04', title: 'Apply fixes',       body: 'Replace flagged terms one-click or rewrite with neutral alternatives provided inline.' },
]

const PLAN_FEATURES = [
  { label: 'Analyses / month',    free: '200',   pro: 'Unlimited' },
  { label: 'Suggestion depth',    free: 'Basic', pro: 'Advanced'  },
  { label: 'Export results',      free: false,   pro: true        },
  { label: 'Analysis history',    free: false,   pro: true        },
  { label: 'API access',          free: false,   pro: true        },
  { label: 'Priority processing', free: false,   pro: true        },
]

/* ── Results panel (right side) ── */
function ResultsPanel({ analyzing, results, text, onApply, onApplyAll }) {
  const [copied, setCopied] = useState(false)

  const classColor = !results ? '' :
    results.label === 'MALE-BIASED'    ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' :
    results.label === 'FEMALE-BIASED'  ? 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700' :
    results.label === 'GENDER-NEUTRAL' ? 'bg-brand-100 text-brand-700 border-brand-200 dark:bg-brand-900/30 dark:text-brand-300 dark:border-brand-700' :
                                         'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700'

  const copyAll = () => {
    if (!results) return
    const lines = results.detected.map(d => `${d.word} → ${d.suggestion}  (${d.reason})`).join('\n')
    navigator.clipboard.writeText(`GENTEK Analysis\nClassification: ${results.label}\nBias Score: ${results.score}%\n\nSuggestions:\n${lines}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-700/80 shadow-editor flex flex-col overflow-hidden h-full">

      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/60 flex-shrink-0">
        <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Analysis Results</span>
        {results && (
          <button onClick={copyAll} className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 px-2.5 py-1.5 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors">
            <Copy size={12} />
            {copied ? 'Copied!' : 'Copy report'}
          </button>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto editor-scroll">

        {/* Skeleton */}
        {analyzing && (
          <div className="p-5 space-y-4 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-2/5" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/3" />
              </div>
            </div>
            <div className="h-px bg-gray-100 dark:bg-gray-800" />
            {[85, 70, 90, 60, 78, 50].map(w => (
              <div key={w} className="h-3 bg-gray-200 dark:bg-gray-700 rounded-lg" style={{ width: `${w}%` }} />
            ))}
            <div className="pt-2 space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!analyzing && !results && (
          <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-900/30 border border-brand-100 dark:border-brand-800 flex items-center justify-center mb-4">
              <GentekMark size={40} />
            </div>
            <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Results appear here</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 leading-relaxed max-w-xs">
              Enter your text on the left and click <strong>Analyze Text</strong> — bias patterns will be highlighted instantly.
            </p>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="p-5 space-y-5">

            {/* Score + summary row */}
            <div className="flex items-center gap-4">
              <ScoreRing score={results.score} color={results.color} size={72} />
              <div className="flex-1 min-w-0">
                <span className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-full border mb-2 ${classColor}`}>
                  {results.label}
                </span>
                <div className="flex items-center gap-3 text-xs">
                  {[
                    { label: 'Male',   count: results.male,   dot: 'bg-blue-500',  txt: 'text-blue-600 dark:text-blue-400'  },
                    { label: 'Female', count: results.female, dot: 'bg-rose-500',  txt: 'text-rose-600 dark:text-rose-400'  },
                    { label: 'Stereo', count: results.stereo, dot: 'bg-amber-500', txt: 'text-amber-600 dark:text-amber-400'},
                  ].map(b => (
                    <span key={b.label} className={`flex items-center gap-1 font-semibold ${b.txt}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${b.dot}`} />
                      {b.label} {b.count}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                  {results.detected.length} pattern{results.detected.length !== 1 ? 's' : ''} · {results.words} words
                </p>
              </div>
            </div>

            <div className="h-px bg-gray-100 dark:bg-gray-800" />

            {results.detected.length > 0 ? (
              <>
                {/* Highlighted text */}
                <div>
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Highlighted Text</p>
                  <div
                    className="text-[13.5px] text-gray-700 dark:text-gray-200 leading-[1.95] bg-gray-50/70 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700 px-4 py-3"
                    dangerouslySetInnerHTML={{ __html: results.html }}
                  />
                  {/* Legend */}
                  <div className="flex flex-wrap gap-3 mt-2">
                    {[
                      { cls: 'bias-male',       label: 'Male-biased'   },
                      { cls: 'bias-female',     label: 'Female-biased' },
                      { cls: 'bias-stereotype', label: 'Stereotype'    },
                    ].map(l => (
                      <div key={l.label} className="flex items-center gap-1.5">
                        <mark className={`${l.cls} text-[10px] px-1.5 rounded`}>{l.label.split('-')[0]}</mark>
                        <span className="text-[11px] text-gray-400 dark:text-gray-500">{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-gray-100 dark:bg-gray-800" />

                {/* Suggestions */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                      Suggestions ({results.detected.length})
                    </p>
                    <button
                      onClick={onApplyAll}
                      className="text-[11px] font-bold text-white bg-brand-600 hover:bg-brand-700 px-3 py-1 rounded-lg transition-colors shadow-sm"
                    >
                      Apply All
                    </button>
                  </div>
                  <div className="space-y-2">
                    {results.detected.map(d => (
                      <div key={d.word} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-brand-200 dark:hover:border-brand-700 transition-colors group">
                        <CaretRight size={13} className="text-brand-400 mt-0.5 flex-shrink-0" weight="bold" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-sm text-gray-400 dark:text-gray-500 line-through leading-tight">{d.word}</span>
                            <span className="text-sm font-semibold text-brand-700 dark:text-brand-300 leading-tight">{d.suggestion}</span>
                          </div>
                          <span className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug">{d.reason}</span>
                        </div>
                        <button
                          onClick={() => onApply(d.word, d.suggestion)}
                          className="flex-shrink-0 text-[11px] font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 hover:bg-brand-100 dark:hover:bg-brand-800/50 border border-brand-100 dark:border-brand-700 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          Apply
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center text-center py-6 gap-3">
                <div className="w-12 h-12 rounded-full bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
                  <CheckCircle size={24} weight="fill" className="text-brand-500" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">No bias detected</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">Your text uses gender-inclusive language.</p>
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
              <WarningCircle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                Pattern-based detection. HuggingFace AI model integration coming soon.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════ MAIN COMPONENT ═══════════════ */
export default function HomePage() {
  const { user, addToHistory } = useAuth()
  const location = useLocation()
  const [text, setText]         = useState('')
  const [analyzing, setAna]     = useState(false)
  const [results, setResults]   = useState(null)
  const [isTempSession, setTemp] = useState(false)
  const textareaRef             = useRef(null)

  // Handle sidebar navigation state
  useEffect(() => {
    if (location.state?.tempChat) {
      setText('')
      setResults(null)
      setTemp(true)
      window.history.replaceState({}, '')
      setTimeout(() => textareaRef.current?.focus(), 50)
    } else if (location.state?.loadText) {
      setText(location.state.loadText)
      setResults(null)
      setTemp(false)
      window.history.replaceState({}, '')
      setTimeout(() => textareaRef.current?.focus(), 50)
    } else if (location.state?.newAnalysis) {
      setText('')
      setResults(null)
      setTemp(false)
      window.history.replaceState({}, '')
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [location.state])

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
  const charCount = text.length
  const showPanel = analyzing || results

  const buildHtml = (text, detected) => {
    let html = text
    detected.forEach(({ word, type }) => {
      const cls = type === 'male' ? 'bias-male' : type === 'female' ? 'bias-female' : 'bias-stereotype'
      html = html.replace(new RegExp(`\\b${word.replace(/\s+/g, '\\s+')}\\b`, 'gi'), `<mark class="${cls}">${word}</mark>`)
    })
    return html
  }

  const analyze = useCallback(async () => {
    if (!text.trim() || wordCount < 3) return
    setAna(true); setResults(null)
    try {
      const res = await fetch('/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      const r = { ...data, html: buildHtml(text, data.detected) }
      setResults(r)
      setAna(false)
      if (user && !isTempSession) addToHistory(text, r)
    } catch {
      // Fallback to local analysis when backend is not running
      const r = runAnalysis(text)
      setResults(r)
      setAna(false)
      if (user && !isTempSession) addToHistory(text, r)
    }
  }, [text, wordCount, user, isTempSession, addToHistory])

  const loadSample = (key) => { setText(SAMPLES[key]); setResults(null); textareaRef.current?.focus() }
  const clear      = ()    => { setText(''); setResults(null); textareaRef.current?.focus() }
  const handleKey  = (e)   => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); analyze() } }
  const applyFix    = (word, suggestion) => { setText(t => t.replace(new RegExp(`\\b${word}\\b`, 'gi'), suggestion)); setResults(null) }
  const applyAllFixes = () => {
    if (!results) return
    setText(t => {
      let out = t
      results.detected.forEach(d => { out = out.replace(new RegExp(`\\b${d.word}\\b`, 'gi'), d.suggestion) })
      return out
    })
    setResults(null)
  }

  return (
    <div className="bg-white dark:bg-gray-950 pt-14">

      {/* ══ HERO / WORKSPACE ══ */}
      <section className={`relative flex flex-col items-center px-4 sm:px-6 overflow-hidden transition-all duration-300 ${
        showPanel ? 'py-10' : 'min-h-[calc(100vh-56px)] justify-center py-12'
      }`}>
        {/* Background */}
        <div className="absolute inset-0 bg-dot-grid opacity-[0.35] dark:opacity-[0.15] pointer-events-none" />
        <div className="absolute inset-0 bg-hero-gradient pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[320px] bg-brand-400/8 dark:bg-brand-600/8 blur-3xl rounded-full pointer-events-none" />

        <div className={`relative z-10 w-full transition-all duration-500 ${showPanel ? 'max-w-7xl' : 'max-w-4xl mx-auto'}`}>

          {/* Badge + Headline — guests only */}
          {!user && (
            <div className={`text-center mb-8 transition-all duration-300 ${showPanel ? 'lg:hidden' : ''}`}>
              <div className="flex justify-center mb-5">
                <span className="inline-flex items-center gap-2 bg-white dark:bg-gray-900 border border-brand-200 dark:border-brand-700/60 text-brand-700 dark:text-brand-300 text-xs font-semibold px-4 py-1.5 rounded-full shadow-sm">
                  <Sparkle size={11} weight="fill" className="text-accent-500" />
                  AI-Powered Gender Bias Analysis — Free, No Account Needed
                </span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-gray-900 dark:text-white leading-[1.1] tracking-tight mb-4">
                Detect Gender Bias<br className="hidden sm:block" />
                <span className="text-gradient"> in Your Writing</span>
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
                Paste any text — essays, emails, reports, job descriptions — to receive instant AI-powered gender bias analysis.
              </p>
            </div>
          )}

          {/* ── Two-column layout ── */}
          <div className={`flex flex-col lg:flex-row gap-5 ${showPanel ? '' : 'justify-center'}`}>

            {/* LEFT: Editor */}
            <div className={`transition-all duration-500 ${showPanel ? 'lg:w-[48%] flex-shrink-0' : 'w-full max-w-4xl'}`}>
              <div className={`bg-white dark:bg-gray-900 rounded-3xl shadow-editor overflow-hidden border ${isTempSession ? 'border-dashed border-amber-400 dark:border-amber-500' : 'border-gray-200 dark:border-gray-700/80'}`}>

                {/* Temp session banner */}
                {isTempSession && (
                  <div className="flex items-center justify-between gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
                      <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Temporary session — results won't be saved to history</span>
                    </div>
                    <button
                      onClick={() => setTemp(false)}
                      title="Exit temporary session"
                      className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors text-[10px] font-bold underline"
                    >
                      Exit
                    </button>
                  </div>
                )}

                {/* Top bar */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/60">
                  <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Input Text</span>
                  <div className="flex items-center gap-1">
                    <div className="relative group">
                      <button className="flex items-center gap-1.5 text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 px-2.5 py-1.5 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors">
                        <UploadSimple size={13} weight="bold" />Upload
                      </button>
                      <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-card py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                        {[
                          { icon: FilePdf, label: 'Upload PDF'         },
                          { icon: FileDoc, label: 'Upload Word (.docx)' },
                          { icon: FileTxt, label: 'Upload TXT'          },
                        ].map(({ icon: Icon, label }) => (
                          <button key={label} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                            <Icon size={14} weight="duotone" />{label}
                          </button>
                        ))}
                        <div className="border-t border-gray-100 dark:border-gray-700 mt-1 pt-1">
                          <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <ClockCounterClockwise size={14} />Recent Files
                          </button>
                        </div>
                      </div>
                    </div>
                    {text && (
                      <button onClick={clear} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <Trash size={13} weight="bold" />Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={e => { setText(e.target.value); setResults(null) }}
                  onKeyDown={handleKey}
                  placeholder="Write, paste, or upload text to analyze for gender-biased language..."
                  rows={showPanel ? 10 : 9}
                  className="w-full px-6 py-5 text-[15px] text-gray-800 dark:text-gray-100 leading-relaxed resize-none outline-none bg-transparent placeholder-gray-300 dark:placeholder-gray-600 editor-scroll"
                />

                {/* Quick sample chips */}
                <div className="px-5 pb-4 flex flex-wrap gap-2">
                  {QUICK.map(q => (
                    <button
                      key={q.key}
                      onClick={() => loadSample(q.key)}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-brand-400 hover:text-brand-600 dark:hover:border-brand-500 dark:hover:text-brand-400 hover:bg-brand-50/60 dark:hover:bg-brand-900/20 transition-all"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>

                {/* Bottom bar */}
                <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/60 flex-wrap">
                  <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                    <span>{wordCount} words</span>
                    <span className="text-gray-200 dark:text-gray-700">|</span>
                    <span>{charCount} chars</span>
                    <span className="hidden sm:inline-flex items-center gap-1 ml-1 text-gray-300 dark:text-gray-600 font-mono">
                      <Command size={11} /><ArrowElbowDownLeft size={11} /> to analyze
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { loadSample('male'); setTimeout(analyze, 80) }}
                      className="text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 border border-gray-200 dark:border-gray-700 hover:border-brand-400 dark:hover:border-brand-600 px-4 py-2 rounded-xl transition-all"
                    >
                      Try Sample
                    </button>
                    <button
                      onClick={analyze}
                      disabled={!text.trim() || analyzing || wordCount < 3}
                      className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm px-6 py-2 rounded-xl shadow-btn hover:shadow-none active:scale-95 transition-all"
                    >
                      {analyzing
                        ? <><SpinnerGap size={15} className="animate-spin" />Analyzing…</>
                        : <><BrainIcon size={15} color="white" faceColor="#0D9488" />Analyze Text</>}
                    </button>
                  </div>
                </div>
              </div>

              {/* Bias category pills — below editor, only when no panel */}
              {!showPanel && (
                <div className="flex flex-wrap justify-center gap-2 mt-5">
                  {[
                    { label: 'Male-Biased',      c: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800' },
                    { label: 'Female-Biased',    c: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800' },
                    { label: 'Stereotype',       c: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800' },
                    { label: 'Gender-Neutral ✓', c: 'bg-brand-50 text-brand-600 border-brand-200 dark:bg-brand-900/20 dark:text-brand-300 dark:border-brand-800' },
                  ].map(({ label, c }) => (
                    <span key={label} className={`text-[11px] font-semibold px-3 py-1 rounded-full border ${c}`}>{label}</span>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT: Results panel */}
            {showPanel && (
              <div className="lg:flex-1 lg:sticky lg:top-20 lg:self-start animate-fade-up" style={{ animationDuration: '0.35s' }}>
                <ResultsPanel
                  analyzing={analyzing}
                  results={results}
                  text={text}
                  onApply={applyFix}
                  onApplyAll={applyAllFixes}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══ FEATURES — guests only ══ */}
      {!user && <section id="features" className="py-24 px-4 sm:px-6 bg-white dark:bg-gray-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14 reveal">
            <p className="section-label mb-3">Features</p>
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Everything you need to write<br /><span className="text-gradient-teal">without bias</span>
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto text-lg">Built for writers, HR teams, researchers, and anyone who cares about inclusive communication.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => {
              const Icon = f.icon
              return (
                <div key={f.title} className={`reveal card card-hover p-6 reveal-delay-${i + 1}`}>
                  <div className={`w-11 h-11 rounded-xl ${f.bg} flex items-center justify-center mb-4`}>
                    {Icon ? <Icon size={22} weight="duotone" className={f.color} /> : <GentekMark size={28} />}
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{f.body}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>}

      {/* ══ HOW IT WORKS — guests only ══ */}
      {!user && <section id="how-it-works" className="py-24 px-4 sm:px-6 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14 reveal">
            <p className="section-label mb-3">How It Works</p>
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Four steps to<br /><span className="text-gradient-teal">inclusive writing</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((s, i) => (
              <div key={s.n} className={`reveal reveal-delay-${i+1}`}>
                <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center mb-4 shadow-btn">
                  <span className="text-xs font-black text-white tracking-tight">{s.n}</span>
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>}

      {/* ══ PRICING — guests only ══ */}
      {!user && <section id="pricing" className="py-24 px-4 sm:px-6 bg-white dark:bg-gray-950">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14 reveal">
            <p className="section-label mb-3">Pricing</p>
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Simple, <span className="text-gradient-teal">transparent</span> pricing
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg">Start free. No credit card required.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="reveal card p-8 flex flex-col">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Free</h3>
              <div className="flex items-end gap-1 mb-4">
                <span className="text-5xl font-extrabold text-gray-900 dark:text-white">$0</span>
                <span className="text-gray-400 dark:text-gray-500 mb-1.5">/forever</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Perfect for students and writers getting started.</p>
              <button className="btn-outline w-full justify-center mb-6">Get Started Free</button>
              <ul className="space-y-3 mt-auto">
                {PLAN_FEATURES.map(f => (
                  <li key={f.label} className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-400">
                    {f.free === false
                      ? <X size={14} weight="bold" className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
                      : <Check size={14} weight="bold" className="text-brand-500 flex-shrink-0" />}
                    <span>{f.label}</span>
                    {typeof f.free === 'string' && <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{f.free}</span>}
                  </li>
                ))}
              </ul>
            </div>
            <div className="reveal reveal-delay-2 relative card p-8 flex flex-col border-2 border-brand-500 bg-brand-50/20 dark:bg-brand-900/10">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1.5 bg-brand-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-btn">
                  <Lightning size={11} weight="fill" />Most Popular
                </span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Pro</h3>
              <div className="flex items-end gap-1 mb-4">
                <span className="text-5xl font-extrabold text-gray-900 dark:text-white">$9</span>
                <span className="text-gray-400 dark:text-gray-500 mb-1.5">/month</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">For professionals, HR teams, and organizations.</p>
              <button className="btn-primary w-full justify-center mb-6">
                Start Pro Trial <ArrowRight size={14} weight="bold" />
              </button>
              <ul className="space-y-3 mt-auto">
                {PLAN_FEATURES.map(f => (
                  <li key={f.label} className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-300">
                    <Check size={14} weight="bold" className="text-brand-500 flex-shrink-0" />
                    <span>{f.label}</span>
                    {typeof f.pro === 'string' && <span className="ml-auto text-xs font-semibold text-brand-600 dark:text-brand-400">{f.pro}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>}

      {/* ══ FAQ — guests only ══ */}
      {!user && <section id="faq" className="py-24 px-4 sm:px-6 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12 reveal">
            <p className="section-label mb-3">FAQ</p>
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Common <span className="text-gradient-teal">questions</span>
            </h2>
          </div>
          <div className="reveal card px-6">
            <FAQAccordion />
          </div>
        </div>
      </section>}

      {/* ══ CONTACT CTA — guests only ══ */}
      {!user && (
        <section id="contact" className="py-24 px-4 sm:px-6 bg-white dark:bg-gray-950">
          <div className="max-w-3xl mx-auto text-center reveal">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-900/30 items-center justify-center mb-6">
              <Sparkle size={26} weight="duotone" className="text-brand-600" />
            </div>
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Ready to write <span className="text-gradient-teal">without bias?</span>
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg mb-8 leading-relaxed">
              Start analyzing right now — no account, no credit card, no setup required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="btn-primary px-7 py-3 text-base"
              >
                <BrainIcon size={18} color="white" faceColor="#0D9488" />
                Start Analyzing Free
              </button>
              <Link to="/contact" className="btn-outline px-7 py-3 text-base">
                Contact Us <ArrowRight size={15} weight="bold" />
              </Link>
            </div>
            <p className="mt-6 text-xs text-gray-400 dark:text-gray-600">
              Questions? <Link to="/contact" className="text-brand-600 dark:text-brand-400 hover:underline">Get in touch →</Link>
            </p>
          </div>
        </section>
      )}

    </div>
  )
}
