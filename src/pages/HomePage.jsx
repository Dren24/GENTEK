// ── HomePage — main editor workspace + guest landing page ─────────────────────
// Two modes:
//   • Guest: shows hero headline, editor, then Features / How It Works /
//             Pricing / FAQ / Contact CTA sections below.
//   • Logged-in: shows just the editor (no headline, no sections below).
// Editor expands to two-column when results are shown (input left, results right).

import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowRight, ArrowLeft, SpinnerGap, WarningCircle, Trash,
  UploadSimple, FilePdf, FileDoc, FileTxt,
  Command, ArrowElbowDownLeft, Sparkle, ShieldCheck,
  Lightning, Users, ChartBar, Check, X, CaretDown, CaretUp,
  PencilSimple, CheckCircle,
} from '@phosphor-icons/react'
import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
import { BrainIcon, GentekMark } from '../components/shared/GentekLogo'
import { useAuth } from '../context/AuthContext'
import ConfirmModal from '../components/shared/ConfirmModal'
import AuthModal from '../components/shared/AuthModal'

// ── FREE_WORD_LIMIT — max words a Free (non-premium) logged-in user can have
// analyzed in one go. Configurable without a code change via VITE_FREE_WORD_LIMIT;
// falls back to 500. Guests keep their own separate GUEST_WORD_LIMIT below —
// this only applies to logged-in accounts that aren't Premium.
const FREE_WORD_LIMIT = Number(import.meta.env.VITE_FREE_WORD_LIMIT) || 500

// ── BIAS_PATTERNS — client-side fallback patterns (mirrors backend/analyzer.py) ──
// Used when the /analyze API is unreachable (network error or dev mode).
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

// ── SAMPLES — pre-written example texts for each quick-load chip ──────────────
const SAMPLES = {
  essay:      `The chairman of the board approved the proposal unanimously. She was overly emotional during the negotiation, which surprised her colleagues. The manpower required for this project is significant. Every businessman understands the risks involved.`,
  jobPosting: `We are looking for a dynamic businessman to lead our sales team. The ideal candidate must be aggressive and driven. Manpower planning is essential for this role. The fireman of our operations team handles crisis response.`,
  email:      `Dear Sir or Madam, I would like to address the chairman regarding the upcoming policy changes. The stewardess of our last flight provided excellent service. Our manpower analysis shows a 20% growth target this quarter.`,
  report:     `The girl boss of the marketing division led the campaign. Our lady doctor on call responded professionally. The congressman approved the legislation after a heated debate. Hysterical coverage in the media followed the announcement.`,
  female:     `The new manager was dismissed as bossy and hysterical when she proposed the restructuring plan. A nurturing housewife type is better suited for this client-facing role. The lady doctor on call responded professionally. Our stewardess welcomed every passenger warmly.`,
  male:       `The chairman of the board approved the proposal. The manpower required for this project is significant. Every businessman understands the risks. The fireman arrived promptly at the scene.`,
}

// ── runAnalysis — client-side analysis fallback (no server required) ──────────
// Mirrors the scoring logic in backend/analyzer.py — keep them in sync.
function escapeRx(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ── escapeAttr — escapes a string for safe use inside an HTML attribute value ──
function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── escapeHtml — escapes a string for safe use as HTML text content ──────────
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── splitAtWordLimit — splits text into the first `limit` words ("head") and
// everything after ("tail"). head + tail always reconstructs the exact
// original text — nothing is ever deleted or altered, only split for display.
function splitAtWordLimit(text, limit) {
  if (!Number.isFinite(limit)) return { head: text, tail: '' }
  const matches = [...text.matchAll(/\S+/g)]
  if (matches.length <= limit) return { head: text, tail: '' }
  if (limit <= 0) return { head: '', tail: text }
  const boundary = matches[limit - 1].index + matches[limit - 1][0].length
  return { head: text.slice(0, boundary), tail: text.slice(boundary) }
}

// ── localScore — mirrors backend/analyzer.py's _score() so a single local word
// fix can update the score/classification instantly, without an API call.
// Only three classifications exist — Male-Biased, Female-Biased, Gender-Neutral
// — no fourth "Mixed" category; an exact tie resolves to Male-Biased. ────────
function localScore(detected) {
  const male   = detected.filter(d => d.type === 'male').length
  const female = detected.filter(d => d.type === 'female').length
  const n = detected.length
  if (n === 0) return { label: 'GENDER-NEUTRAL', score: 0 }
  const label = female > male ? 'FEMALE-BIASED' : 'MALE-BIASED'
  let score
  if      (n === 1) score = 20
  else if (n === 2) score = 35
  else if (n === 3) score = 50
  else if (n === 4) score = 60
  else if (n === 5) score = 70
  else if (n === 6) score = 78
  else if (n === 7) score = 84
  else              score = Math.min(95, 84 + (n - 7) * 3)
  return { label, score }
}

// ── localColor — mirrors backend/analyzer.py's COLOR_MAP ─────────────────────
function localColor(label) {
  return label === 'MALE-BIASED'    ? '#3B82F6'
       : label === 'FEMALE-BIASED'  ? '#F43F5E'
       : '#0D9488'
}

function runAnalysis(text) {
  const detected = BIAS_PATTERNS.filter(p => new RegExp(`\\b${escapeRx(p.word).replace(/\s+/g, '\\s+')}\\b`, 'i').test(text))
  const male   = detected.filter(p => p.type === 'male').length
  const female = detected.filter(p => p.type === 'female').length
  const stereo = detected.filter(p => p.type === 'stereotype').length
  let label = 'GENDER-NEUTRAL', score = 0, color = '#0D9488'
  if (detected.length > 0) {
    label = female > male ? 'FEMALE-BIASED' : 'MALE-BIASED'
    score = Math.min(95, 40 + Math.max(male, female) * 15 + stereo * 8)
    color = label === 'FEMALE-BIASED' ? '#F43F5E' : '#3B82F6'
  }
  // Build highlighted HTML — escape user text first to prevent XSS, then wrap bias words in <mark>
  let html = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  detected.forEach(({ word, type, suggestion, reason }) => {
    const cls = type === 'male' ? 'bias-male' : type === 'female' ? 'bias-female' : 'bias-stereotype'
    // Data attributes let the results panel show a popup with the original match's casing preserved
    html = html.replace(new RegExp(`\\b${escapeRx(word).replace(/\s+/g,'\\s+')}\\b`, 'gi'), (m) =>
      `<mark class="${cls}" data-word="${escapeAttr(word)}" data-suggestion="${escapeAttr(suggestion)}" data-reason="${escapeAttr(reason)}" data-type="${escapeAttr(type)}">${m}</mark>`)
  })
  return { detected, male, female, stereo, label, score, color, html, words: text.trim().split(/\s+/).length }
}

// ── Quick-load chip definitions — maps label → sample key ─────────────────────
const QUICK = [
  { label: 'Essay',       key: 'essay'      },
  { label: 'Job Posting', key: 'jobPosting' },
  { label: 'Email',       key: 'email'      },
  { label: 'Report',      key: 'report'     },
  { label: 'Female bias', key: 'female'     },
  { label: 'Male bias',   key: 'male'       },
]

// ── FAQS — accordion questions for the FAQ section ────────────────────────────
const FAQS = [
  { q: 'How does GENTEK find biased language?',   a: 'GENTEK checks your text for gendered terms, role assumptions, and stereotype phrases, then explains each finding in plain language.' },
  { q: 'What results will I see?',                a: 'You will see a bias category, a score, highlighted terms, short explanations, and inclusive alternatives you can use in your rewrite.' },
  { q: 'Is my text stored or sent anywhere?',     a: 'Guest analysis is temporary. If you sign in, you can save recent analyses to your account history for later review.' },
  { q: 'What types of writing work best?',        a: 'GENTEK works best with English essays, emails, job posts, reports, policy drafts, and other professional or academic text.' },
  { q: 'Do I need an account?',                   a: 'No. You can start analyzing text right away. An account is useful when you want to keep analysis history.' },
]

// ── FAQAccordion — expand/collapse FAQ items one at a time ───────────────────
function FAQAccordion() {
  const [open, setOpen] = useState(null)
  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {FAQS.map((f, i) => (
        <div key={i} className="py-4">
          {/* Question row — toggle on click */}
          <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between gap-4 text-left">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{f.q}</span>
            {/* Caret changes direction when open */}
            {open === i
              ? <CaretUp   size={14} className="text-brand-500 flex-shrink-0" weight="bold" />
              : <CaretDown size={14} className="text-gray-400 flex-shrink-0"  weight="bold" />}
          </button>
          {/* Answer — CSS class controls open/closed height transition */}
          <div className={`faq-body ${open === i ? 'open' : 'closed'}`}>
            <p className="pt-3 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{f.a}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── FEATURES — feature cards data for the Features section ───────────────────
const FEATURES = [
  { icon: null,        color: 'text-brand-600',   bg: 'bg-brand-50 dark:bg-brand-900/30',     title: 'Bias Detection',         body: 'Find gendered words, phrases, and role assumptions that can make writing feel less inclusive.' },
  { icon: Sparkle,     color: 'text-accent-600',  bg: 'bg-amber-50 dark:bg-amber-900/20',    title: 'Inclusive Suggestions',  body: 'Every flagged term includes a clearer alternative, so you can revise with confidence.' },
  { icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', title: 'Guest-Friendly',         body: 'Start without an account, or sign in when you want to keep your recent analysis history.' },
  { icon: ChartBar,    color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/20',      title: 'Bias Score',             body: 'A simple score helps you understand how much attention the text may need.' },
  { icon: Lightning,   color: 'text-rose-600',    bg: 'bg-rose-50 dark:bg-rose-900/20',      title: 'Fast Results',           body: 'Paste your text, run the check, and review highlighted results in seconds.' },
  { icon: Users,       color: 'text-violet-600',  bg: 'bg-violet-50 dark:bg-violet-900/20',  title: 'Clear Categories',       body: 'See whether the text leans male-biased, female-biased, or gender-neutral.' },
]

// ── STEPS — how-it-works numbered step cards ─────────────────────────────────
const STEPS = [
  { n: '01', title: 'Paste your text',   body: 'Drop in any content — essays, job ads, emails, reports, or policy drafts.' },
  { n: '02', title: 'Run the check',     body: 'GENTEK looks for gendered terms, role assumptions, and stereotype language.' },
  { n: '03', title: 'Review highlights', body: 'Flagged words are color-coded with a clear explanation for each finding.' },
  { n: '04', title: 'Revise with clarity', body: 'Use the suggested alternatives to make your writing more inclusive.' },
]

// ── PLAN_FEATURES — comparison rows for the inline Pricing section (guests only) ──
const PLAN_FEATURES = [
  { label: 'Analyses / month',    free: '200',   pro: 'Unlimited' },
  { label: 'Suggestion depth',    free: 'Basic', pro: 'Advanced'  },
  { label: 'Analysis history',    free: false,   pro: true        },
  { label: 'API access',          free: false,   pro: true        },
  { label: 'Priority processing', free: false,   pro: true        },
]

// ── WordPopup — floating card shown when a highlighted word/phrase is clicked ──
// Closes on outside click. Positioned near the clicked mark via fixed coords.
function WordPopup({ word, suggestion, reason, type, x, y, onApply, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  const typeLabel = type === 'male' ? 'Male-biased' : type === 'female' ? 'Female-biased' : 'Stereotype'
  const typeColor = type === 'male' ? 'text-blue-600 dark:text-blue-400' : type === 'female' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'

  return (
    <div
      ref={ref}
      className="fixed z-50 w-64 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-card-hover p-4"
      style={{ left: x, top: y, transform: 'translate(-50%, 0)' }}
    >
      {/* Header — bias type label + close */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className={`text-[10px] font-bold uppercase tracking-widest ${typeColor}`}>{typeLabel}</span>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-300 transition-colors">
          <X size={12} weight="bold" />
        </button>
      </div>
      {/* Detected term + reason */}
      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">{word}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed mb-3">{reason}</p>
      {/* Suggested alternative — click the word itself to apply it */}
      <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
        <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Suggested</p>
        <button
          onClick={() => { onApply(word, suggestion); onClose() }}
          className="text-sm font-semibold text-brand-700 dark:text-brand-300 hover:text-brand-600 dark:hover:text-brand-200 hover:underline truncate text-left"
        >
          {suggestion}
        </button>
      </div>
    </div>
  )
}

// ════════════════════════ HOMEPAGE ════════════════════════════════════════════
export default function HomePage() {
  const { user, addToHistory, updateHistory, deleteHistory, lastDeletedId, openPricing, authHeader } = useAuth()
  // ── Guest word limit — enforced in onChange, counter turns red at 100 ────
  const GUEST_WORD_LIMIT = 300
  const location = useLocation()
  const [text, setText]          = useState('')
  const [analyzing, setAna]      = useState(false)
  const [results, setResults]    = useState(null)
  const [wordPopup, setWordPopup]         = useState(null) // floating popup for a clicked highlighted word
  const [isTempSession, setTemp] = useState(false)    // true = skip history save
  const [canBack, setCanBack]       = useState(false)
  const [canForward, setCanForward] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)  // login popup on 2nd guest analysis
  const textareaRef              = useRef(null)
  const overlayRef               = useRef(null)        // mirrors textarea scroll for the Free-limit fade overlay
  const fileInputRef             = useRef(null)
  const analyzeRef               = useRef(null)        // always points to latest analyze fn (avoids stale closure)
  const guestAnalysisCountRef    = useRef(0)           // tracks how many analyses a guest has run
  const dragCounterRef           = useRef(0)           // tracks nested dragenter/dragleave to avoid flicker
  const [isDragging, setIsDragging] = useState(false)
  const [fileAccept, setFileAccept] = useState('*')
  const currentHistoryIdRef      = useRef(null)       // id of currently-loaded history item
  const textStackRef             = useRef([])          // undo/redo text snapshots
  const stackIdxRef              = useRef(-1)          // current position in stack
  const sessionStacksRef         = useRef({})          // saved stacks keyed by historyId

  // ── pushTextStack — adds a snapshot to the undo/redo stack ───────────────
  const pushTextStack = useCallback((t) => {
    // Skip duplicates to avoid polluting the stack with no-op changes
    if (stackIdxRef.current >= 0 && textStackRef.current[stackIdxRef.current] === t) return
    // Discard any forward entries (branch off current position)
    textStackRef.current = textStackRef.current.slice(0, stackIdxRef.current + 1)
    textStackRef.current.push(t)
    // Cap at 50 entries to avoid unbounded memory growth
    if (textStackRef.current.length > 50) textStackRef.current.shift()
    stackIdxRef.current = textStackRef.current.length - 1
    setCanBack(stackIdxRef.current > 0)
    setCanForward(false)
  }, [])

  // ── goBack / goForward — navigate through text undo/redo stack ───────────
  const goBack = () => {
    if (stackIdxRef.current <= 0) return
    stackIdxRef.current--
    setText(textStackRef.current[stackIdxRef.current])
    setResults(null)
    setCanBack(stackIdxRef.current > 0)
    setCanForward(true)
  }

  // ── goForward — step forward in undo/redo stack ──────────────────────────
  const goForward = () => {
    if (stackIdxRef.current >= textStackRef.current.length - 1) return
    stackIdxRef.current++
    setText(textStackRef.current[stackIdxRef.current])
    setResults(null)
    setCanBack(true)
    setCanForward(stackIdxRef.current < textStackRef.current.length - 1)
  }

  // ── clearTextStack — resets undo/redo stack entirely (used on delete) ────
  const clearTextStack = useCallback(() => {
    textStackRef.current = []
    stackIdxRef.current = -1
    setCanBack(false)
    setCanForward(false)
  }, [])

  // ── parseFile — extracts text from a dropped or selected file ───────────────
  const parseFile = async (file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    try {
      let extracted = ''
      if (ext === 'txt') {
        extracted = await file.text()
      } else if (ext === 'pdf') {
        const data  = await file.arrayBuffer()
        const pdf   = await pdfjsLib.getDocument({ data }).promise
        const pages = []
        for (let i = 1; i <= pdf.numPages; i++) {
          const page    = await pdf.getPage(i)
          const content = await page.getTextContent()
          pages.push(content.items.map(it => it.str).join(' '))
        }
        extracted = pages.join('\n\n').trim()
      } else if (ext === 'docx') {
        const data   = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer: data })
        extracted    = result.value.trim()
      }
      if (extracted) {
        setText(extracted)
        setResults(null)
        pushTextStack(extracted)
        setTimeout(() => textareaRef.current?.focus(), 50)
      }
    } catch (err) {
      console.error('File parse error:', err)
    }
  }

  // ── openFilePicker — triggers hidden file input with the given MIME accept ──
  const openFilePicker = (accept) => {
    setFileAccept(accept)
    setTimeout(() => fileInputRef.current?.click(), 10)
  }

  // ── Drag-and-drop handlers — counter avoids false "leave" on child elements ──
  const onDragEnter = (e) => { e.preventDefault(); dragCounterRef.current++; setIsDragging(true) }
  const onDragLeave = (e) => { e.preventDefault(); dragCounterRef.current--; if (dragCounterRef.current === 0) setIsDragging(false) }
  const onDragOver  = (e) => e.preventDefault()
  const onDrop      = (e) => { e.preventDefault(); dragCounterRef.current = 0; setIsDragging(false); parseFile(e.dataTransfer.files[0]) }

  // ── Reset all editor state when user logs out — component stays mounted ──────
  useEffect(() => {
    if (!user) {
      setTemp(false)
      setText('')
      setResults(null)
      currentHistoryIdRef.current = null
      clearTextStack()
    }
  }, [user, clearTextStack])

  // ── Clear editor when the loaded history item is deleted from the sidebar ─
  useEffect(() => {
    if (lastDeletedId !== null && lastDeletedId === currentHistoryIdRef.current) {
      delete sessionStacksRef.current[lastDeletedId]
      setText('')
      setResults(null)
      currentHistoryIdRef.current = null
      clearTextStack()
      setConfirmDelete(false)
    }
  }, [lastDeletedId, clearTextStack])

  // ── Handle sidebar navigation state — tempChat, loadText, newAnalysis ────
  useEffect(() => {
    if (location.state?.tempChat) {
      // Temporary session: results won't be saved to history
      setText('')
      setResults(null)
      setTemp(true)
      currentHistoryIdRef.current = null
      window.history.replaceState({}, '')
      setTimeout(() => textareaRef.current?.focus(), 50)
    } else if (location.state?.loadText) {
      const loaded = location.state.loadText
      const incomingId = location.state.historyId ?? null

      // Save the current session's stack before switching history items
      if (currentHistoryIdRef.current !== null) {
        sessionStacksRef.current[currentHistoryIdRef.current] = {
          stack: [...textStackRef.current],
          idx: stackIdxRef.current,
        }
      }

      // Restore this item's saved stack, or start fresh with the loaded text
      const saved = incomingId !== null ? sessionStacksRef.current[incomingId] : null
      if (saved && saved.stack.length > 0) {
        textStackRef.current = [...saved.stack]
        stackIdxRef.current = saved.idx
        setCanBack(saved.idx > 0)
        setCanForward(saved.idx < saved.stack.length - 1)
      } else {
        textStackRef.current = [loaded]
        stackIdxRef.current = 0
        setCanBack(false)
        setCanForward(false)
      }

      setText(saved ? saved.stack[saved.idx] : loaded)
      setResults(null)
      setTemp(false)
      currentHistoryIdRef.current = incomingId
      window.history.replaceState({}, '')
      setTimeout(() => textareaRef.current?.focus(), 50)
    } else if (location.state?.newAnalysis) {
      // New Analysis button in sidebar — clear editor
      setText('')
      setResults(null)
      setTemp(false)
      currentHistoryIdRef.current = null
      window.history.replaceState({}, '')
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [location.state, pushTextStack])

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
  const charCount = text.length
  const showPanel = analyzing || results   // true = compact hero + hide guest headline

  // ── classificationInfo — display label + dot color for the actual
  // classification, colored to match that classification's existing color
  // (same blue/rose/teal used to highlight words in the text and used for
  // the classification badge/color elsewhere in the app). ──────────────────
  const classificationInfo = (() => {
    if (!results) return null
    if (results.label === 'MALE-BIASED')   return { label: 'Male-Biased',   dot: 'bg-blue-500' }
    if (results.label === 'FEMALE-BIASED') return { label: 'Female-Biased', dot: 'bg-rose-500' }
    return { label: 'Gender-Neutral', dot: 'bg-brand-500' }
  })()

  // ── Free vs Premium word limit — guests use their own separate GUEST_WORD_LIMIT
  // above and are unaffected here. Premium accounts are never limited. ─────────
  const isPremium = !!user?.is_premium
  const freeLimitActive = !!user && !isPremium
  const { head: analyzableText, tail: lockedTail } = freeLimitActive
    ? splitAtWordLimit(text, FREE_WORD_LIMIT)
    : { head: text, tail: '' }

  // ── buildHtml — HTML-escapes user text first, then wraps bias words in <mark>
  // Escaping first prevents XSS when text is injected via dangerouslySetInnerHTML.
  const buildHtml = (text, detected) => {
    let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    detected.forEach(({ word, type, suggestion, reason }) => {
      const cls = type === 'male' ? 'bias-male' : type === 'female' ? 'bias-female' : 'bias-stereotype'
      html = html.replace(new RegExp(`\\b${escapeRx(word).replace(/\s+/g, '\\s+')}\\b`, 'gi'), (m) =>
        `<mark class="${cls}" data-word="${escapeAttr(word)}" data-suggestion="${escapeAttr(suggestion)}" data-reason="${escapeAttr(reason)}" data-type="${escapeAttr(type)}">${m}</mark>`)
    })
    return html
  }

  // ── normalizeApiResult — coerces API response into a consistent result shape ──
  // Fills in derived fields (label, color, html) if the backend didn't return them.
  const normalizeApiResult = (data, inputText) => {
    const detected = Array.isArray(data.detected) ? data.detected : []
    const male = Number.isFinite(data.male) ? data.male : detected.filter(d => d.type === 'male').length
    const female = Number.isFinite(data.female) ? data.female : detected.filter(d => d.type === 'female').length
    const stereo = Number.isFinite(data.stereo) ? data.stereo : detected.filter(d => d.type === 'stereotype').length
    const label = detected.length === 0
      ? 'GENDER-NEUTRAL'
      : data.label || (female > male ? 'FEMALE-BIASED' : 'MALE-BIASED')
    const score = detected.length === 0 ? 0 : Math.min(95, Math.max(1, Number(data.score) || 0))

    return {
      ...data,
      detected,
      male,
      female,
      stereo,
      label,
      score,
      color: data.color || (label === 'MALE-BIASED' ? '#3B82F6' : label === 'FEMALE-BIASED' ? '#F43F5E' : '#0D9488'),
      words: data.words || inputText.trim().split(/\s+/).length,
      html: buildHtml(inputText, detected),
    }
  }

  // ── saveToHistory — persist result to backend (skipped for temp sessions) ──
  const saveToHistory = useCallback(async (r) => {
    if (!user || isTempSession || !r?.label) return
    if (currentHistoryIdRef.current !== null) {
      updateHistory(currentHistoryIdRef.current, r)
    } else {
      const id = await addToHistory(text, r)
      currentHistoryIdRef.current = id
    }
  }, [user, isTempSession, text, addToHistory, updateHistory])

  // ── analyze — calls /analyze API, falls back to client runAnalysis on error ──
  // ── analyzeText — core analysis logic, accepts text directly ────────────
  const analyzeText = useCallback(async (inputText) => {
    if (!inputText.trim() || inputText.trim().split(/\s+/).length < 3) return

    // ── Guest limit: 2 free analyses. Third attempt → show login popup ─────
    if (!user && guestAnalysisCountRef.current >= 2) {
      setShowAuthPrompt(true)
      return
    }

    setAna(true); setResults(null)
    let succeeded = false
    try {
      const res = await fetch('/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ text: inputText }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const r = normalizeApiResult(data, inputText)
      // Zero detections: reset to the plain pre-analysis state instead of
      // leaving an "Analyzed — no bias" status up — same behavior as after
      // Rewrite Text. The result is still saved to history either way.
      setResults(r.detected.length === 0 ? null : r)
      setAna(false)
      pushTextStack(inputText)
      saveToHistory(r)
      succeeded = true
    } catch {
      const r = runAnalysis(inputText)
      // Zero detections: reset to the plain pre-analysis state instead of
      // leaving an "Analyzed — no bias" status up — same behavior as after
      // Rewrite Text. The result is still saved to history either way.
      setResults(r.detected.length === 0 ? null : r)
      setAna(false)
      pushTextStack(inputText)
      saveToHistory(r)
      succeeded = true
    }
    // Only count successful analyses against the guest quota
    if (!user && succeeded) guestAnalysisCountRef.current += 1
  }, [user, saveToHistory, pushTextStack, authHeader])

  // ── analyze — Free users over the word limit only ever send the analyzable
  // head to /analyze; the full text (including the locked tail) stays intact
  // in the editor and is what gets saved to history untouched. ─────────────
  const analyze = useCallback(
    () => analyzeText(freeLimitActive && lockedTail ? analyzableText : text),
    [analyzeText, text, freeLimitActive, lockedTail, analyzableText]
  )

  // ── Keep analyzeRef current so setTimeout-based callers get the latest fn ──
  useEffect(() => { analyzeRef.current = analyze }, [analyze])

  // ── loadSample — fills textarea with a pre-written sample text ───────────
  const loadSample = (key) => {
    setText(SAMPLES[key])
    setResults(null)
    currentHistoryIdRef.current = null
    pushTextStack(SAMPLES[key])
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  // ── clear — empties editor and clears current history association ─────────
  const clear = () => {
    if (currentHistoryIdRef.current !== null) {
      delete sessionStacksRef.current[currentHistoryIdRef.current]
    }
    setText('')
    setResults(null)
    currentHistoryIdRef.current = null
    clearTextStack()
    setConfirmDelete(false)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  // ── confirmAndDelete — called by ConfirmModal's onConfirm ────────────────
  const confirmAndDelete = () => {
    if (currentHistoryIdRef.current !== null) {
      deleteHistory(currentHistoryIdRef.current)
    }
    clear()
  }

  // ── Keyboard shortcut — Cmd/Ctrl+Enter triggers analysis ─────────────────
  const handleKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); analyze() } }

  // ── replaceBias — robust replacement that handles single words and phrases ──
  const replaceBias = (src, word, suggestion) => {
    // Sort longest-first to prevent partial-word clobbering across replacements
    const escaped = escapeRx(word).replace(/\s+/g, '\\s+')
    const rx = new RegExp(`(?<![\\w])${escaped}(?![\\w])`, 'gi')
    const result = src.replace(rx, suggestion)
    // If lookahead/behind didn't match (old browser), fall back to \b version
    return result !== src ? result : src.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), suggestion)
  }

  // ── applyFix — replaces one detected word/phrase with its suggestion,
  // entirely on the client: no re-analysis, no API/LLM call. Only that term's
  // entry is dropped from `detected` and the score/highlighting recomputed
  // locally from the remaining items; the rest of the text is untouched. ────
  const applyFix = (word, suggestion) => {
    if (!results) return
    const newText = replaceBias(text, word, suggestion)
    const updatedDetected = results.detected.filter(d => d.word.toLowerCase() !== word.toLowerCase())
    const male   = updatedDetected.filter(d => d.type === 'male').length
    const female = updatedDetected.filter(d => d.type === 'female').length
    const stereo = updatedDetected.filter(d => d.type === 'stereotype').length
    const { label, score } = localScore(updatedDetected)

    setText(newText)
    setResults(prev => ({
      ...prev,
      detected: updatedDetected,
      male, female, stereo,
      label,
      score,
      color: localColor(label),
      html: buildHtml(newText, updatedDetected),
      words: newText.trim() ? newText.trim().split(/\s+/).length : 0,
    }))
    pushTextStack(newText)
  }

  // ── rewriteText — replaces the editor text in place with a revised version
  // built from every suggested alternative, then resets to the pre-analysis
  // state (results cleared) so the button goes back to "Analyze Text" and the
  // user can re-run analysis on the rewritten version whenever they choose. ──
  const rewriteText = () => {
    if (!results || !results.detected?.length) return
    // Apply longest phrases first to avoid partial replacements
    const sorted = [...results.detected].sort((a, b) => b.word.length - a.word.length)
    let out = text
    sorted.forEach(d => { out = replaceBias(out, d.word, d.suggestion) })
    setText(out)
    setResults(null)
    pushTextStack(out)
  }

  // ── Close the word popup whenever a new analysis result comes in ─────────
  useEffect(() => { setWordPopup(null) }, [results])

  // ── handleMarkClick — event delegation: reads data-* off the clicked <mark> ──
  const handleMarkClick = (e) => {
    const mark = e.target.closest('mark[data-word]')
    if (!mark) return
    const rect = mark.getBoundingClientRect()
    const clampedX = Math.min(Math.max(rect.left + rect.width / 2, 140), window.innerWidth - 140)
    setWordPopup({
      word: mark.dataset.word,
      suggestion: mark.dataset.suggestion,
      reason: mark.dataset.reason,
      type: mark.dataset.type,
      x: clampedX,
      y: rect.bottom + 8,
    })
  }

  return (
    <>
    <div className="bg-white dark:bg-gray-950 pt-14">

      {/* ══ HERO / WORKSPACE section ══════════════════════════════════════ */}
      {/* Shrinks to compact when results panel is showing (showPanel=true) */}
      <section className={`relative flex flex-col items-center px-4 sm:px-6 overflow-hidden transition-all duration-300 ${
        showPanel ? 'py-10' : 'min-h-[calc(100vh-56px)] justify-center py-12'
      }`}>
        {/* Decorative backgrounds — dot grid + gradient + glow orb */}
        <div className="absolute inset-0 bg-dot-grid opacity-[0.35] dark:opacity-[0.15] pointer-events-none" />
        <div className="absolute inset-0 bg-hero-gradient pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[320px] bg-brand-400/8 dark:bg-brand-600/8 blur-3xl rounded-full pointer-events-none" />

        <div className="relative z-10 w-full max-w-4xl mx-auto transition-all duration-500">

          {/* Hero headline + badge — hidden for logged-in users and when panel open */}
          {!user && (
            <div className={`text-center mb-8 transition-all duration-300 ${showPanel ? 'lg:hidden' : ''}`}>
              {/* "AI-Powered" badge pill */}
              <div className="flex justify-center mb-5">
                <span className="inline-flex items-center gap-2 bg-white dark:bg-gray-900 border border-brand-200 dark:border-brand-700/60 text-brand-700 dark:text-brand-300 text-xs font-semibold px-4 py-1.5 rounded-full shadow-sm">
                  <Sparkle size={11} weight="fill" className="text-accent-500" />
                  Gender Bias Checker — Free, No Account Needed
                </span>
              </div>
              {/* Main headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-gray-900 dark:text-white leading-[1.1] tracking-tight mb-4">
                Make Your Writing<br className="hidden sm:block" />
                <span className="text-gradient">More Inclusive</span>
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
                Paste an essay, email, report, or job post. GENTEK highlights gender-biased language and suggests clearer, more inclusive alternatives.
              </p>
            </div>
          )}

          {/* ── Combined Input + Analysis card — one connected analyzer surface ── */}
          <div
            className="relative"
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            {/* Drag-over overlay — shown when a file is dragged over the editor */}
            {isDragging && (
              <div className="absolute inset-0 z-20 rounded-3xl bg-brand-500/10 border-2 border-dashed border-brand-400 flex flex-col items-center justify-center gap-3 pointer-events-none">
                <UploadSimple size={36} className="text-brand-500" weight="duotone" />
                <p className="text-sm font-bold text-brand-600 dark:text-brand-400">Drop your file here</p>
                <p className="text-xs text-brand-400 dark:text-brand-500">PDF, Word (.docx), or TXT</p>
              </div>
            )}
            <div className={`bg-white dark:bg-gray-900 rounded-3xl shadow-editor overflow-hidden border ${isDragging ? 'border-brand-400 dark:border-brand-500' : isTempSession ? 'border-dashed border-amber-400 dark:border-amber-500' : 'border-gray-200 dark:border-gray-700/80'}`}>

              {/* Temporary session indicator banner */}
              {isTempSession && (
                <div className="flex items-center justify-between gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2">
                    {/* Pulsing amber dot */}
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Temporary session — results won't be saved to history</span>
                  </div>
                  {/* Exit temporary mode button */}
                  <button
                    onClick={() => setTemp(false)}
                    title="Exit temporary session"
                    className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors text-[10px] font-bold underline"
                  >
                    Exit
                  </button>
                </div>
              )}

              {/* ── Top bar — "Input Text" label + AI badge + Upload + Delete ── */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/60">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Input Text</span>
                  {results?.ai_powered && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-700 px-2 py-0.5 rounded-full">
                      <Sparkle size={9} weight="fill" />AI
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {/* Upload dropdown — logged-in users only */}
                  {user && <div className="relative group">
                    <button className="flex items-center gap-1.5 text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 px-2.5 py-1.5 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors">
                      <UploadSimple size={13} weight="bold" />Upload
                    </button>
                    {/* Hover dropdown — file type options */}
                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-card py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                      {[
                        { icon: FilePdf, label: 'Upload PDF',         accept: '.pdf'  },
                        { icon: FileDoc, label: 'Upload Word (.docx)', accept: '.docx' },
                        { icon: FileTxt, label: 'Upload TXT',          accept: '.txt'  },
                      ].map(({ icon: Icon, label, accept }) => (
                        <button key={label} onClick={() => openFilePicker(accept)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                          <Icon size={14} weight="duotone" />{label}
                        </button>
                      ))}
                    </div>
                  </div>}
                  {/* Delete button — opens ConfirmModal */}
                  {text && (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-rose-500 dark:hover:text-rose-400 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                    >
                      <Trash size={13} weight="bold" />Delete
                    </button>
                  )}
                </div>
              </div>

              {/* ── Main text area — editable textarea before analysis; the same
                  spot shows the highlighted, clickable analyzed text afterwards.
                  Free-tier users past FREE_WORD_LIMIT see the overflow faded and
                  locked out of analysis, in both states, without losing a word. ── */}
              {results ? (
                <div
                  onClick={handleMarkClick}
                  className="w-full px-6 py-5 text-[15px] text-gray-800 dark:text-gray-100 leading-relaxed whitespace-pre-wrap editor-scroll cursor-default"
                  style={{ minHeight: '15rem', maxHeight: '26rem', overflowY: 'auto' }}
                  dangerouslySetInnerHTML={{
                    __html: results.html + (lockedTail
                      ? `<span class="inline-flex items-center gap-1 mx-1 align-middle text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap">🔒 Free limit reached</span><span class="opacity-40">${escapeHtml(lockedTail)}</span>`
                      : '')
                  }}
                />
              ) : lockedTail ? (
                // ── Free limit exceeded: a transparent textarea (still the real,
                // fully-editable input) layered over a matching overlay that shows
                // the same text with the overflow faded — nothing is truncated. ──
                <div className="relative">
                  <div
                    ref={overlayRef}
                    aria-hidden="true"
                    className="absolute inset-0 w-full px-6 py-5 text-[15px] leading-relaxed whitespace-pre-wrap break-words pointer-events-none overflow-hidden editor-scroll"
                  >
                    <span className="text-gray-800 dark:text-gray-100">{analyzableText}</span>
                    <span className="inline-flex items-center gap-1 mx-1 align-middle text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                      🔒 Free limit reached
                    </span>
                    <span className="text-gray-400 dark:text-gray-500 opacity-40">{lockedTail}</span>
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={e => {
                      setText(e.target.value)
                      setResults(null)
                    }}
                    onScroll={e => {
                      if (overlayRef.current) {
                        overlayRef.current.scrollTop = e.target.scrollTop
                        overlayRef.current.scrollLeft = e.target.scrollLeft
                      }
                    }}
                    onKeyDown={handleKey}
                    placeholder="Write, paste, or upload text to analyze for gender-biased language..."
                    rows={10}
                    className="relative w-full px-6 py-5 text-[15px] leading-relaxed resize-none outline-none bg-transparent placeholder-gray-300 dark:placeholder-gray-600 editor-scroll text-transparent caret-gray-800 dark:caret-gray-100"
                    style={{ WebkitTextFillColor: 'transparent' }}
                  />
                </div>
              ) : (
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={e => {
                    const val = e.target.value
                    if (!user) {
                      // Hard word limit for non-logged-in users
                      const words = val.trim() ? val.trim().split(/\s+/) : []
                      if (words.length > GUEST_WORD_LIMIT) {
                        setText(words.slice(0, GUEST_WORD_LIMIT).join(' '))
                        setResults(null)
                        return
                      }
                    }
                    setText(val)
                    setResults(null)
                  }}
                  onKeyDown={handleKey}
                  placeholder="Write, paste, or upload text to analyze for gender-biased language..."
                  rows={10}
                  className="w-full px-6 py-5 text-[15px] text-gray-800 dark:text-gray-100 leading-relaxed resize-none outline-none bg-transparent placeholder-gray-300 dark:placeholder-gray-600 editor-scroll"
                />
              )}

              {/* ── Quick sample chips — guests only ─────────────────────── */}
              {!user && (
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
              )}

              {/* ── Bottom status bar — word counter + Analyze / Rewrite button ── */}
              <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/60 flex-wrap">
                <div className="flex items-center gap-3 text-xs">
                  {!user ? (
                    <>
                      {/* Guest word counter — red at limit, amber at 80% */}
                      <span className={`font-semibold ${wordCount >= GUEST_WORD_LIMIT ? 'text-rose-500' : wordCount >= Math.round(GUEST_WORD_LIMIT * 0.8) ? 'text-amber-500' : 'text-gray-400 dark:text-gray-500'}`}>
                        {wordCount}/{GUEST_WORD_LIMIT} words
                      </span>
                      {/* "Upgrade for unlimited" nudge — shown at ≥80 words */}
                      {wordCount >= Math.round(GUEST_WORD_LIMIT * 0.8) && (
                        <button
                          onClick={openPricing}
                          className="text-brand-600 dark:text-brand-400 hover:underline font-semibold"
                        >
                          Upgrade for unlimited →
                        </button>
                      )}
                      {/* nudge after both free analyses are used */}
                      {guestAnalysisCountRef.current >= 2 && wordCount < 80 && (
                        <button
                          onClick={() => setShowAuthPrompt(true)}
                          className="text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                        >
                          Sign up to analyze again →
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Logged-in: show word count, char count, keyboard shortcut */}
                      <span className={lockedTail ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}>
                        {wordCount} words{lockedTail && ` · ${FREE_WORD_LIMIT} will be analyzed`}
                      </span>
                      <span className="text-gray-200 dark:text-gray-700">|</span>
                      <span className="text-gray-400 dark:text-gray-500">{charCount} chars</span>
                      {/* Upgrade nudge — Free users who exceeded the word limit */}
                      {lockedTail && (
                        <button onClick={openPricing} className="text-brand-600 dark:text-brand-400 hover:underline font-semibold">
                          Upgrade to Premium →
                        </button>
                      )}
                      {/* Cmd+Enter keyboard shortcut hint — only relevant before analysis */}
                      {!results && !lockedTail && (
                        <span className="hidden sm:inline-flex items-center gap-1 ml-1 text-gray-300 dark:text-gray-600 font-mono">
                          <Command size={11} /><ArrowElbowDownLeft size={11} /> to analyze
                        </span>
                      )}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!results ? (
                    <>
                      {/* Try Sample — guests only, loads male-biased sample */}
                      {!user && (
                        <button
                          onClick={() => loadSample('male')}
                          className="text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 border border-gray-200 dark:border-gray-700 hover:border-brand-400 dark:hover:border-brand-600 px-4 py-2 rounded-xl transition-all"
                        >
                          Try Sample
                        </button>
                      )}
                      {/* Analyze button — primary CTA, disabled while analyzing */}
                      <button
                        onClick={analyze}
                        disabled={!text.trim() || analyzing || wordCount < 3}
                        className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm px-6 py-2 rounded-xl shadow-btn hover:shadow-none active:scale-95 transition-all"
                      >
                        {analyzing
                          ? <><SpinnerGap size={15} className="animate-spin" />Analyzing…</>
                          : <><BrainIcon size={15} color="white" faceColor="#0D9488" />Analyze Text</>}
                      </button>
                    </>
                  ) : results.detected.length > 0 ? (
                    /* Rewrite Text — replaces the editor text in place, then resets to pre-analysis state */
                    <button
                      onClick={rewriteText}
                      className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm px-6 py-2 rounded-xl shadow-btn hover:shadow-none active:scale-95 transition-all"
                    >
                      <PencilSimple size={14} weight="bold" />
                      Rewrite Text
                    </button>
                  ) : (
                    /* Nothing to rewrite — confirm the text was analyzed, without
                       claiming certainty that it's guaranteed bias-free */
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 dark:text-brand-400">
                      <CheckCircle size={16} weight="fill" />
                      Analyzed — No significant bias detected
                    </span>
                  )}
                </div>
              </div>

              {/* ── Analysis percentages — Bias Detected / Gender-Neutral / Classification ── */}
              {results && (
                <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Bias Detected: <strong className="text-gray-900 dark:text-white tabular-nums">{results.score}%</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Gender-Neutral: <strong className="text-gray-900 dark:text-white tabular-nums">{100 - results.score}%</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${classificationInfo.dot}`} />
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Classification: <strong className="text-gray-900 dark:text-white">{classificationInfo.label}</strong>
                      </span>
                    </div>
                  </div>

                  {/* ── Result message — deliberately hedged: a 0% score means GENTEK's
                      analysis found no patterns, not that the text is guaranteed
                      bias-free. Never claims certainty either way. ─────────────────── */}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    {results.score === 0
                      ? "No significant gender-biased patterns were detected based on GENTEK's analysis."
                      : 'Potential gender-biased patterns were detected in the text.'}
                  </p>

                  {/* ── Compact color legend — same classes used to highlight words above,
                      so colors always match exactly. Sits right under the percentages,
                      handy after scrolling down through a long analyzed text. ────────── */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-gray-50 dark:border-gray-800">
                    <span className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                      <mark className="bias-male text-[9px] font-bold px-1.5 py-0 rounded leading-[1.4]">Male</mark>
                      Male-Biased
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                      <mark className="bias-female text-[9px] font-bold px-1.5 py-0 rounded leading-[1.4]">Female</mark>
                      Female-Biased
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                      <mark className="bias-stereotype text-[9px] font-bold px-1.5 py-0 rounded leading-[1.4]">Stereo</mark>
                      Stereotype
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                      <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />
                      Normal / Gender-Neutral
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Bias category legend pills — shown below the card, only before analysis */}
            {!results && !analyzing && (
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
        </div>
      </section>

      {/* ══ FEATURES section — guests only ═══════════════════════════════ */}
      {!user && <section id="features" className="py-24 px-4 sm:px-6 bg-white dark:bg-gray-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14 reveal">
            <p className="section-label mb-3">Features</p>
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Everything you need to write<br /><span className="text-gradient-teal">without bias</span>
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto text-lg">Built for writers, HR teams, researchers, and anyone who cares about inclusive communication.</p>
          </div>
          {/* 3-column feature grid */}
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

      {/* ══ HOW IT WORKS section — guests only ════════════════════════════ */}
      {!user && <section id="how-it-works" className="py-24 px-4 sm:px-6 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14 reveal">
            <p className="section-label mb-3">How It Works</p>
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Four steps to<br /><span className="text-gradient-teal">inclusive writing</span>
            </h2>
          </div>
          {/* 4-column numbered step cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((s, i) => (
              <div key={s.n} className={`reveal reveal-delay-${i+1}`}>
                {/* Step number badge */}
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

      {/* ══ PRICING section — guests only ════════════════════════════════ */}
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
            {/* Free plan card */}
            <div className="reveal card p-8 flex flex-col">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Free</h3>
              <div className="flex items-end gap-1 mb-4">
                <span className="text-5xl font-extrabold text-gray-900 dark:text-white">$0</span>
                <span className="text-gray-400 dark:text-gray-500 mb-1.5">/forever</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Perfect for students and writers getting started.</p>
              <button onClick={() => setShowAuthPrompt(true)} className="btn-outline w-full justify-center mb-6">Get Started Free</button>
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
            {/* Pro plan card — featured with border and badge */}
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
              <button onClick={() => setShowAuthPrompt(true)} className="btn-primary w-full justify-center mb-6">
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

      {/* ══ FAQ section — guests only ════════════════════════════════════ */}
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

      {/* ══ CONTACT CTA section — guests only ════════════════════════════ */}
      {!user && (
        <section id="contact" className="py-24 px-4 sm:px-6 bg-white dark:bg-gray-950">
          <div className="max-w-3xl mx-auto text-center reveal">
            {/* Sparkle icon badge */}
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
              {/* Scroll to top CTA — returns user to the editor */}
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="btn-primary px-7 py-3 text-base"
              >
                <BrainIcon size={18} color="white" faceColor="#0D9488" />
                Start Analyzing Free
              </button>
              {/* Contact page link */}
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

    {/* ── Hidden file input — triggered by Upload dropdown or drag-and-drop ── */}
    <input
      ref={fileInputRef}
      type="file"
      accept={fileAccept}
      className="hidden"
      onChange={e => { if (e.target.files?.[0]) parseFile(e.target.files[0]); e.target.value = '' }}
    />

    {/* ── ConfirmModal — shown when Delete button is clicked in the editor ── */}
    {confirmDelete && (
      <ConfirmModal
        title="Delete analysis?"
        description="This will clear the editor and remove the entry from your recent history."
        onConfirm={confirmAndDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    )}

    {/* ── Auth prompt — shown when guest tries a second analysis ────────────── */}
    {showAuthPrompt && (
      <AuthModal mode="login" onClose={() => setShowAuthPrompt(false)} />
    )}

    {/* ── Floating popup for the clicked highlighted word ─────────────────
        Portaled to <body> so it isn't clipped/mispositioned by any
        transformed ancestor, which would break position:fixed. ─────────── */}
    {wordPopup && createPortal(
      <WordPopup {...wordPopup} onApply={applyFix} onClose={() => setWordPopup(null)} />,
      document.body
    )}
</>
  )
}
