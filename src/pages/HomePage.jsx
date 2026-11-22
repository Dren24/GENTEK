// ── HomePage — main editor workspace + guest landing page ─────────────────────
// Two modes:
//   • Guest: shows hero headline, editor, then Features / How It Works /
//             Pricing / FAQ / Contact CTA sections below.
//   • Logged-in: shows just the editor (no headline, no sections below).
// Editor expands to two-column when results are shown (input left, results right).
//
// Where to look:
//   runAnalysis()        offline fallback analysis (keyword list in BIAS_PATTERNS)
//   analyzeText()        Analyze button → POST /analyze → show results
//   normalizeApiResult() backend reply → page state (highlights, %, label)
//   parseFile()          Upload / drag-and-drop → utils/documentText.js → editor
//   applyFix()           click a suggestion → replace that word only
//   rewriteText()        "Rewrite Text" → apply every suggestion at once
//   startEditing() / saveEdits() / cancelEditing()
//                        "Edit Text" on analyzed text → Save clears the old
//                        results so the edited text is analyzed again
//   Results panel JSX    search for "Analysis percentages"

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowRight, SpinnerGap, WarningCircle, Trash,
  UploadSimple, FilePdf, FileDoc, FileTxt,
  Command, ArrowElbowDownLeft, Sparkle, ShieldCheck,
  Lightning, Users, ChartBar, Check, X, CaretDown, CaretUp,
  PencilSimple, CheckCircle, FloppyDisk, NotePencil, FileText,
} from '@phosphor-icons/react'
import { BrainIcon, GentekMark } from '../components/shared/GentekLogo'
import { useAuth } from '../context/AuthContext'
import ConfirmModal from '../components/shared/ConfirmModal'
import AuthModal from '../components/shared/AuthModal'
import { escapeRx, escapeHtml, highlightHtml, fixRange, rewriteAll } from '../utils/biasHighlight'
import { biasBreakdown } from '../utils/biasScore'
import { extractText, ACCEPT, UploadError } from '../utils/documentText'

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
  { word: 'overly emotional',type: 'male',       suggestion: 'highly expressive',     reason: 'Gendered emotional characterization'         },
  { word: 'bossy',           type: 'female',     suggestion: 'assertive',             reason: 'Term disproportionately applied to women'    },
  { word: 'hysterical',      type: 'female',     suggestion: 'overwhelmed',           reason: "Historically used to dismiss women's feelings"},
  { word: 'nurturing',       type: 'female',     suggestion: 'supportive',            reason: 'Gendered trait assumption'                   },
  { word: 'aggressive',      type: 'male',       suggestion: 'assertive',             reason: 'Often applied unfairly by gender context'    },
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

// ── runAnalysis — client-side analysis fallback (no server required) ──────────
// Mirrors the scoring logic in backend/analyzer.py — keep them in sync.
function runAnalysis(text) {
  const detected = BIAS_PATTERNS.filter(p => new RegExp(`\\b${escapeRx(p.word).replace(/\s+/g, '\\s+')}\\b`, 'i').test(text))
  const male   = detected.filter(p => p.type === 'male').length
  const female = detected.filter(p => p.type === 'female').length
  // Same score table as the backend, so percentages match either way
  const { label, score } = localScore(detected)
  const color = localColor(label)
  const html = highlightHtml(text, detected)
  return { detected, male, female, label, score, color, html, words: text.trim().split(/\s+/).length }
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
  { q: 'How does GENTEK find biased language?',   a: 'GENTEK checks your text for gendered terms and role assumptions, then explains each finding in plain language.' },
  { q: 'What results will I see?',                a: 'You will see a bias category, a score, highlighted terms, short explanations, and inclusive alternatives you can use in your rewrite.' },
  { q: 'Is my text stored or sent anywhere?',     a: 'To analyze it, your text is sent to GENTEK\'s server and to our AI provider. Guest text is not saved. If you sign in, your analyses are saved to your history, and you can delete them anytime.' },
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
  { n: '02', title: 'Run the check',     body: 'GENTEK looks for gendered terms and role assumptions in your writing.' },
  { n: '03', title: 'Review highlights', body: 'Flagged words are color-coded with a clear explanation for each finding.' },
  { n: '04', title: 'Revise with clarity', body: 'Use the suggested alternatives to make your writing more inclusive.' },
]

// ── PLAN_FEATURES — comparison rows for the inline Pricing section (guests only) ──
const PLAN_FEATURES = [
  { label: 'Words per analysis',          free: '500',       pro: 'No limit'  },
  { label: 'AI bias detection',           free: true,        pro: true        },
  { label: 'Suggestions + Rewrite',       free: true,        pro: true        },
  { label: 'File uploads',                free: '2 / day',   pro: 'Unlimited' },
  { label: 'Saved history (with account)', free: true,       pro: true        },
  { label: 'Long documents (500+ words)', free: false,       pro: true        },
]

// ── WordPopup — suggestion card for one clicked highlight ──────────────────────
// Anchored to the exact <mark> that was clicked (found by its data-start inside
// the results editor, containerRef). Its position is recomputed whenever the
// editor or page scrolls or the window/keyboard resizes, so it stays attached
// to the phrase:
//   • below the phrase, or above it when there isn't room below,
//   • horizontally inside the editor (and the screen), never under the top bar,
//   • closed automatically once the phrase scrolls out of the editor's view.
// Closes on a click/tap outside, Escape, or after a suggestion is applied.
const POPUP_GAP = 8
function WordPopup({ start, word, suggestion, reason, type, containerRef, onApply, onClose }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)

  useLayoutEffect(() => {
    let frame = 0
    const place = () => {
      frame = 0
      const container = containerRef.current
      const mark = container?.querySelector(`mark[data-start="${start}"]`)
      const popup = ref.current
      if (!container || !mark || !popup) { onClose(); return }
      const m = mark.getBoundingClientRect()
      const c = container.getBoundingClientRect()
      const vv = window.visualViewport
      const viewW = vv ? vv.width : window.innerWidth
      const viewH = vv ? vv.height : window.innerHeight
      const offTop = vv ? vv.offsetTop : 0
      // The fixed top bar (Navbar <header>) must never be covered
      const navBottom = Math.max(offTop, document.querySelector('header')?.getBoundingClientRect().bottom ?? 0)
      // Phrase scrolled out of the editor (or off screen) → nothing to point at
      const visible = m.bottom > c.top && m.top < c.bottom && m.bottom > navBottom && m.top < offTop + viewH
      if (!visible) { onClose(); return }

      const minX = Math.max(c.left, 0) + POPUP_GAP
      const maxX = Math.min(c.right, viewW) - POPUP_GAP
      const width = Math.min(256, maxX - minX)
      const left = Math.min(Math.max(m.left + m.width / 2 - width / 2, minX), maxX - width)
      const h = popup.offsetHeight
      const spaceBelow = offTop + viewH - m.bottom - POPUP_GAP
      const spaceAbove = m.top - navBottom - POPUP_GAP
      const below = spaceBelow >= h || spaceBelow >= spaceAbove
      let top = below ? m.bottom + POPUP_GAP : m.top - POPUP_GAP - h
      top = Math.min(Math.max(top, navBottom + POPUP_GAP), offTop + viewH - h - POPUP_GAP)
      setPos({ left, top, width, placement: below ? 'below' : 'above' })
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(place) }
    place()
    // Capture phase catches scrolling of the editor box as well as the page
    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('scroll', schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('scroll', schedule)
    }
  }, [start, containerRef, onClose])

  // Outside click/tap, or Escape, dismisses it. A tap on another highlight
  // also lands here first; the editor's click handler then opens that one.
  useEffect(() => {
    const outside = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    const esc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', outside)
    document.addEventListener('touchstart', outside, { passive: true })
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('touchstart', outside)
      document.removeEventListener('keydown', esc)
    }
  }, [onClose])

  const typeLabel = type === 'female' ? 'Female-biased' : 'Male-biased'
  const typeColor = type === 'female' ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`${typeLabel}: ${word}`}
      data-placement={pos?.placement}
      className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-card-hover p-4"
      // Rendered hidden at first so its height can be measured before placing
      style={pos ? { left: pos.left, top: pos.top, width: pos.width } : { left: 0, top: 0, width: 256, visibility: 'hidden' }}
    >
      {/* Header — bias type label + close */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className={`text-[10px] font-bold uppercase tracking-widest ${typeColor}`}>{typeLabel}</span>
        <button onClick={onClose} aria-label="Close suggestion" className="-m-1.5 p-1.5 text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-300 transition-colors">
          <X size={12} weight="bold" />
        </button>
      </div>
      {/* Detected term + reason */}
      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1 break-words">{word}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed mb-3">{reason}</p>
      {/* Suggested alternative — click it to replace THIS occurrence only. Some
          AI findings come without one; then there's nothing to apply. */}
      {suggestion && (
        <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Suggested</p>
          <button
            onClick={() => { onClose(); onApply(suggestion) }}
            className="block w-full min-h-[44px] sm:min-h-0 -mx-1 px-1 py-1 rounded-lg text-sm font-semibold text-brand-700 dark:text-brand-300 hover:text-brand-600 dark:hover:text-brand-200 hover:underline text-left whitespace-normal break-words"
          >
            {suggestion}
          </button>
        </div>
      )}
    </div>
  )
}

// ── uploadLimitMessage — text shown when a Free account has no uploads left ──
function uploadLimitMessage(q) {
  const when = q?.resets_at
    ? new Date(q.resets_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : 'midnight'
  return `You've used your ${q?.limit ?? 2} free uploads for today (resets at ${when}). You can still paste text, or upgrade for unlimited uploads.`
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
  // Last analysis that found no bias: { text, ai_powered }. Zero-detection
  // results aren't shown in the read-only results view (there'd be nothing to
  // rewrite and no way back to editing), so this drives a "Gender-Neutral"
  // status next to the still-editable text until the text changes.
  const [cleanResult, setCleanResult] = useState(null)
  // ── Edit mode for analyzed text — "Edit Text" opens the highlighted result
  // as a plain textarea holding a draft copy. Cancel returns to the results
  // untouched; Save Changes writes the draft back and clears the now-outdated
  // results so the user analyzes the edited version again.
  const [editing, setEditing]    = useState(false)
  const [draft, setDraft]        = useState('')
  // Hint under the editor after Rewrite Text / Save Changes: { kind, text }.
  // Only shown while the editor still holds exactly that text, unanalyzed.
  const [editNotice, setEditNotice] = useState(null)
  const draftRef                 = useRef(null)
  const textareaRef              = useRef(null)
  const resultsRef               = useRef(null)        // highlighted-results box — the word popup anchors to marks inside it
  const overlayRef               = useRef(null)        // mirrors textarea scroll for the Free-limit fade overlay
  const fileInputRef             = useRef(null)
  const analyzeRef               = useRef(null)        // always points to latest analyze fn (avoids stale closure)
  const guestAnalysisCountRef    = useRef(0)           // tracks how many analyses a guest has run
  const dragCounterRef           = useRef(0)           // tracks nested dragenter/dragleave to avoid flicker
  const [isDragging, setIsDragging] = useState(false)
  // ── File upload state — progress text while reading, a readable error, and
  // the loaded file ({ name, words, text, truncated }) for the file chip.
  const [uploading, setUploading]       = useState(null)
  const [uploadError, setUploadError]   = useState(null)
  const [uploadedFile, setUploadedFile] = useState(null)
  const uploadSeqRef             = useRef(0)           // ignores a slow file if another was picked since
  // Free plan: 2 file uploads per day (backend/uploads.py). null = not loaded
  // yet / Premium; {limit, used, remaining, resets_at} for Free accounts.
  const [uploadQuota, setUploadQuota]   = useState(null)
  const [uploadLimitHit, setUploadLimitHit] = useState(false)  // shows an Upgrade button in the error
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
  // Extraction happens in the browser (utils/documentText.js); only the
  // resulting text goes into the editor and, on Analyze, to /analyze.
  const parseFile = async (file) => {
    if (!file) return
    setUploadLimitHit(false)
    // Guests can't upload (also blocks drag-and-drop) — files need an account
    if (!user) {
      setUploadError('Log in or create a free account to upload files.')
      setShowAuthPrompt(true)
      return
    }
    if (uploadQuota && uploadQuota.limit != null && uploadQuota.remaining <= 0) {
      setUploadError(uploadLimitMessage(uploadQuota))
      setUploadLimitHit(true)
      return
    }
    const seq = ++uploadSeqRef.current
    setUploadError(null)
    setUploadedFile(null)
    setUploading('Reading file…')
    try {
      const { text: extracted, kind } = await extractText(file, msg => { if (seq === uploadSeqRef.current) setUploading(msg) })
      if (seq !== uploadSeqRef.current) return
      // Only a file that was read successfully uses one of today's uploads
      const claim = await fetch('/uploads/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ kind }),
      }).catch(() => null)
      if (seq !== uploadSeqRef.current) return
      const quota = claim ? await claim.json().catch(() => ({})) : {}
      if (!claim || !claim.ok) {
        if (claim?.status === 429) {
          setUploadQuota(quota.detail)
          setUploadError(uploadLimitMessage(quota.detail))
          setUploadLimitHit(true)
        } else {
          setUploadError("Couldn't check your upload limit. Please check your connection and try again.")
        }
        return
      }
      setUploadQuota(quota.limit == null ? null : quota)
      // Guests keep their hard word limit, same as typing/pasting
      const kept = limitGuestWords(extracted)
      const words = kept.trim().split(/\s+/).length
      setText(kept)
      setResults(null)
      setCleanResult(null)
      setEditNotice(null)
      currentHistoryIdRef.current = null      // a new document = a new analysis
      pushTextStack(kept)
      setUploadedFile({ name: file.name || 'Document', words, text: kept, truncated: kept !== extracted })
    } catch (err) {
      if (seq !== uploadSeqRef.current) return
      setUploadError(err instanceof UploadError ? err.message : 'Something went wrong reading this file. Please try again.')
    } finally {
      if (seq === uploadSeqRef.current) setUploading(null)
    }
  }

  // ── Upload quota — refreshed on login and when the plan changes ────────────
  useEffect(() => {
    if (!user?.id) { setUploadQuota(null); return }
    let alive = true
    fetch('/uploads/quota', { headers: authHeader() })
      .then(r => r.ok ? r.json() : null)
      .then(q => { if (alive && q) setUploadQuota(q.limit == null ? null : q) })
      .catch(() => {})
    return () => { alive = false }
  }, [user?.id, user?.is_premium])

  // ── removeUploadedFile — drops the loaded document so another can be chosen
  const removeUploadedFile = () => {
    if (uploadedFile && text === uploadedFile.text) clear()
    setUploadedFile(null)
  }

  // ── openFilePicker — sets the accepted types on the hidden input and opens
  // it in the SAME tap (no setTimeout/state round-trip): iPhone Safari blocks
  // a file picker that isn't opened directly inside the user's tap. ──
  const openFilePicker = (accept) => {
    const input = fileInputRef.current
    if (!input) return
    // Out of free uploads → explain instead of opening the picker (the quota is
    // already loaded, so this stays synchronous inside the tap)
    if (uploadQuota && uploadQuota.limit != null && uploadQuota.remaining <= 0) {
      setUploadError(uploadLimitMessage(uploadQuota))
      setUploadLimitHit(true)
      return
    }
    input.accept = accept
    input.click()
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
  // Word count shown in the status bar — the draft's while editing
  const shownWords = editing ? (draft.trim() ? draft.trim().split(/\s+/).length : 0) : wordCount
  const showPanel = analyzing || results   // true = compact hero + hide guest headline

  // ── classificationInfo — display label + dot color for the actual
  // classification, colored to match that classification's existing color
  // (same blue/rose/teal used to highlight words in the text and used for
  // the classification badge/color elsewhere in the app). ──────────────────
  const classificationInfo = (() => {
    const shown = results || cleanResult
    if (!shown) return null
    if (shown.label === 'MALE-BIASED')   return { label: 'Male-Biased',   dot: 'bg-blue-500' }
    if (shown.label === 'FEMALE-BIASED') return { label: 'Female-Biased', dot: 'bg-rose-500' }
    return { label: 'Gender-Neutral', dot: 'bg-brand-500' }
  })()

  // ── Free vs Premium word limit — guests use their own separate GUEST_WORD_LIMIT
  // above and are unaffected here. Premium accounts are never limited. ─────────
  const isPremium = !!user?.is_premium
  const freeLimitActive = !!user && !isPremium
  const { head: analyzableText, tail: lockedTail } = freeLimitActive
    ? splitAtWordLimit(text, FREE_WORD_LIMIT)
    : { head: text, tail: '' }

  // ── shownClean — the no-bias result for exactly the text in the editor ───
  const shownClean = !results && !analyzing && cleanResult !== null &&
    (cleanResult.text === text || cleanResult.text === analyzableText)
    ? cleanResult : null

  // ── aiCoverage — how much of the shown analysis got contextual AI review:
  //   'full'    — the AI read the whole text
  //   'partial' — the AI ran but skipped parts (rate limit, error, or over its
  //               length limit), so bias in those parts may be missed
  //   'none'    — keyword list only (model unavailable or API unreachable)
  //   null      — nothing analyzed for the current text
  const shownAnalysis = results || shownClean
  const aiCoverage = !shownAnalysis ? null
    : shownAnalysis.ai_powered === false ? 'none'
    : shownAnalysis.ai_partial ? 'partial'
    : shownAnalysis.ai_powered ? 'full' : null

  // ── breakdown — the overall score split into Male / Female / Gender-Neutral
  // shares (always totals 100). A zero-detection result is only a confirmed
  // Gender-Neutral when the AI reviewed the whole text. ─────────────────────
  const breakdown = shownAnalysis
    ? biasBreakdown(shownAnalysis.score || 0,
        shownAnalysis.detected?.filter(d => d.type === 'male').length || 0,
        shownAnalysis.detected?.filter(d => d.type === 'female').length || 0)
    : null
  const noBiasFound = !!shownAnalysis && !(shownAnalysis.detected?.length)
  const neutralConfirmed = noBiasFound && aiCoverage === 'full'

  // ── normalizeApiResult — coerces API response into a consistent result shape ──
  // Fills in derived fields (label, color, html) if the backend didn't return them.
  const normalizeApiResult = (data, inputText) => {
    const detected = Array.isArray(data.detected) ? data.detected : []
    const male = Number.isFinite(data.male) ? data.male : detected.filter(d => d.type === 'male').length
    const female = Number.isFinite(data.female) ? data.female : detected.filter(d => d.type === 'female').length
    const label = detected.length === 0
      ? 'GENDER-NEUTRAL'
      : data.label || (female > male ? 'FEMALE-BIASED' : 'MALE-BIASED')
    const score = detected.length === 0 ? 0 : Math.min(95, Math.max(1, Number(data.score) || 0))

    return {
      ...data,
      detected,
      male,
      female,
      label,
      score,
      color: data.color || (label === 'MALE-BIASED' ? '#3B82F6' : label === 'FEMALE-BIASED' ? '#F43F5E' : '#0D9488'),
      words: data.words || inputText.trim().split(/\s+/).length,
      html: highlightHtml(inputText, detected),
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

  // ── analyzeText — what happens when the user clicks "Analyze Text" ──────────
  // 1. Guests get 2 free analyses; the 3rd opens the login popup.
  // 2. POST /analyze with the text (+ login token) → backend/main.py
  //    analyze_text → backend/analyzer.py analyze() (lexicon + AI).
  // 3. normalizeApiResult() turns the reply into what the page shows:
  //    highlighted words, Male/Female/Gender-Neutral %, AI badge.
  // 4. saveToHistory() stores it for logged-in users (sidebar "Recent").
  // If the server can't be reached, runAnalysis() (keyword list built into
  // this file) is used instead, and the result is marked "Keyword check only".
  const analyzeText = useCallback(async (inputText) => {
    if (!inputText.trim()) return

    // ── Guest limit: 2 free analyses. Third attempt → show login popup ─────
    if (!user && guestAnalysisCountRef.current >= 2) {
      setShowAuthPrompt(true)
      return
    }

    setAna(true); setResults(null); setCleanResult(null); setEditNotice(null)
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
      // Zero detections: keep the editor editable and show the no-bias result
      // (indicators + Gender-Neutral message) via cleanResult; it stays until
      // the text is edited, cleared, or analyzed again. Saved to history either way.
      setResults(r.detected.length === 0 ? null : r)
      if (r.detected.length === 0) setCleanResult({ ...r, text: inputText, ai_powered: r.ai_powered !== false, ai_partial: !!r.ai_partial })
      setAna(false)
      pushTextStack(inputText)
      saveToHistory(r)
      succeeded = true
    } catch {
      const r = { ...runAnalysis(inputText), ai_powered: false }
      // Server unreachable — keyword-only result; with zero detections it is
      // shown as not confirmed (see aiCoverage), never as confirmed neutral.
      setResults(r.detected.length === 0 ? null : r)
      if (r.detected.length === 0) setCleanResult({ ...r, text: inputText, ai_powered: false, ai_partial: false })
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

  // ── applyFix — replaces the ONE highlighted occurrence the user clicked
  // ([start, end) in the text, from the mark's data-start/data-end) with the
  // chosen suggestion, entirely on the client: no re-analysis, no API call.
  // Other copies of the same word stay highlighted; the rest of the text,
  // spacing and paragraphs are untouched; score/highlighting are recomputed. ──
  const applyFix = (start, end, suggestion) => {
    if (!results) return
    const { text: newText, detected: updatedDetected } = fixRange(text, results.detected, start, end, suggestion)
    const male   = updatedDetected.filter(d => d.type === 'male').length
    const female = updatedDetected.filter(d => d.type === 'female').length
    const { label, score } = localScore(updatedDetected)

    setText(newText)
    setResults(prev => ({
      ...prev,
      detected: updatedDetected,
      male, female,
      label,
      score,
      color: localColor(label),
      html: highlightHtml(newText, updatedDetected),
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
    // Replaces exactly what is highlighted (overlaps already resolved)
    const out = rewriteAll(text, results.detected)
    setText(out)
    setResults(null)
    setCleanResult(null)
    pushTextStack(out)
    setEditNotice({ kind: 'rewritten', text: out })
    // The rewritten text lands in the normal, fully editable textarea
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  // ── Edit Text / Save Changes / Cancel — editing the analyzed text ─────────
  const limitGuestWords = (val) => {
    if (user) return val
    const words = val.trim() ? val.trim().split(/\s+/) : []
    return words.length > GUEST_WORD_LIMIT ? words.slice(0, GUEST_WORD_LIMIT).join(' ') : val
  }
  const startEditing = () => {
    setWordPopup(null)
    setDraft(text)
    setEditing(true)
    setTimeout(() => {
      const el = draftRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }, 50)
  }
  const cancelEditing = () => { setEditing(false); setDraft('') }
  const saveEdits = () => {
    if (!draft.trim()) return
    setEditing(false)
    // Nothing changed → the existing results still describe this text exactly
    if (draft === text) return
    // Text changed → every old highlight, percentage and classification is
    // stale. Drop them; the user re-runs Analyze Text on the edited version
    // (that run is what saves history, as with any other analysis).
    setText(draft)
    setResults(null)
    setCleanResult(null)
    pushTextStack(draft)
    setEditNotice({ kind: 'edited', text: draft })
    setDraft('')
    setTimeout(() => textareaRef.current?.focus(), 50)
  }
  // Any other path that clears the results (undo, upload, history, delete…)
  // also ends edit mode, so a stale draft can never be saved over new text.
  useEffect(() => { if (!results) setEditing(false) }, [results])
  const shownNotice = editNotice && !results && !analyzing && editNotice.text === text ? editNotice : null

  // ── Close the word popup whenever a new analysis result comes in ─────────
  useEffect(() => { setWordPopup(null) }, [results])

  // ── handleMarkClick — event delegation: reads data-* off the clicked <mark> ──
  const handleMarkClick = (e) => {
    const mark = e.target.closest('mark[data-start]')
    if (!mark) { setWordPopup(null); return }   // clicked plain text → dismiss
    setWordPopup({
      start: Number(mark.dataset.start),
      end: Number(mark.dataset.end),
      word: mark.dataset.word,
      suggestion: mark.dataset.suggestion,
      reason: mark.dataset.reason,
      type: mark.dataset.type,
    })
  }
  const closeWordPopup = useCallback(() => setWordPopup(null), [])

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
                Make Your Writing{' '}<br className="hidden sm:block" />
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
                  {aiCoverage === 'full' && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-700 px-2 py-0.5 rounded-full">
                      <Sparkle size={9} weight="fill" />AI
                    </span>
                  )}
                  {(aiCoverage === 'none' || aiCoverage === 'partial') && (
                    <span
                      title={aiCoverage === 'none'
                        ? "The AI model couldn't be reached, so only GENTEK's built-in keyword list was checked. Contextual bias may have been missed — try again later."
                        : "The AI couldn't review every part of this text (it was busy or the text is very long), so bias in those parts may have been missed — try again in a minute."}
                      className="flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 px-2 py-0.5 rounded-full"
                    >
                      <WarningCircle size={10} weight="fill" />
                      {aiCoverage === 'none' ? 'Keyword check only' : 'AI partially checked'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {/* Upload dropdown — logged-in users only */}
                  {user && <div className="relative group">
                    {/* Tap/click → file picker for PDF, Word and TXT at once (works
                        on phones, which have no hover). Mouse users also get the
                        per-type menu on hover. */}
                    <button
                      type="button"
                      onClick={() => openFilePicker(ACCEPT.all)}
                      disabled={!!uploading}
                      aria-label={`Upload a PDF, Word (.docx) or TXT file${uploadQuota ? ` — ${uploadQuota.remaining} of ${uploadQuota.limit} free uploads left today` : ''}`}
                      title={uploadQuota ? `${uploadQuota.remaining} of ${uploadQuota.limit} free uploads left today` : undefined}
                      className="flex items-center gap-1.5 text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 px-2.5 py-1.5 min-h-[36px] rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-50 transition-colors"
                    >
                      {uploading ? <SpinnerGap size={13} className="animate-spin" /> : <UploadSimple size={13} weight="bold" />}Upload
                      {/* Free plan: uploads left today */}
                      {uploadQuota && (
                        <span className={`ml-0.5 px-1.5 py-px rounded-full text-[10px] font-semibold ${uploadQuota.remaining > 0
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                          : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'}`}>
                          {uploadQuota.remaining}/{uploadQuota.limit}
                        </span>
                      )}
                    </button>
                    {/* Hover dropdown — file type options */}
                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-card py-2 opacity-0 invisible [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:visible transition-all z-20">
                      {[
                        { icon: FilePdf, label: 'Upload PDF',         accept: ACCEPT.pdf  },
                        { icon: FileDoc, label: 'Upload Word (.docx)', accept: ACCEPT.docx },
                        { icon: FileTxt, label: 'Upload TXT',          accept: ACCEPT.txt  },
                      ].map(({ icon: Icon, label, accept }) => (
                        <button key={label} type="button" onClick={() => openFilePicker(accept)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
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
              {results && editing ? (
                // ── Edit mode: the analyzed text as a plain, editable draft.
                // Esc = Cancel, Cmd/Ctrl+Enter = Save Changes. ──
                <textarea
                  ref={draftRef}
                  value={draft}
                  onChange={e => setDraft(limitGuestWords(e.target.value))}
                  onKeyDown={e => {
                    if (e.key === 'Escape') { e.preventDefault(); cancelEditing() }
                    else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); saveEdits() }
                  }}
                  aria-label="Edit analyzed text"
                  placeholder="Text can't be empty — use Delete to clear the editor."
                  rows={10}
                  className="w-full px-6 py-5 text-[15px] text-gray-800 dark:text-gray-100 leading-relaxed resize-none outline-none bg-brand-50/30 dark:bg-brand-900/10 ring-1 ring-inset ring-brand-300/60 dark:ring-brand-700/60 placeholder-gray-300 dark:placeholder-gray-600 editor-scroll"
                  style={{ minHeight: '15rem' }}
                />
              ) : results ? (
                <div
                  ref={resultsRef}
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

              {/* ── Upload status — reading progress, a clear error, or the loaded
                  file with its extracted word count and a Remove button ── */}
              {uploading && (
                <div role="status" className="mx-5 mb-3 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2">
                  <SpinnerGap size={14} className="animate-spin flex-shrink-0" />{uploading}
                </div>
              )}
              {uploadError && !uploading && (
                <div role="alert" className="mx-5 mb-3 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl px-3 py-2">
                  <WarningCircle size={14} weight="fill" className="flex-shrink-0 mt-px" />
                  <span className="flex-1">
                    {uploadError}
                    {uploadLimitHit && (
                      <button type="button" onClick={openPricing} className="ml-1.5 font-semibold underline hover:no-underline">Upgrade to Premium</button>
                    )}
                  </span>
                  <button type="button" onClick={() => { setUploadError(null); setUploadLimitHit(false) }} aria-label="Dismiss" className="-m-1 p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/40"><X size={12} weight="bold" /></button>
                </div>
              )}
              {uploadedFile && !uploading && !results && text === uploadedFile.text && (
                <div className="mx-5 mb-3 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl pl-3 pr-1 py-1">
                  <FileText size={14} weight="duotone" className="flex-shrink-0 text-brand-600 dark:text-brand-400" />
                  {/* Long filenames shorten with "…"; the word count always stays visible */}
                  <span className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-1.5">
                    <strong className="font-semibold text-gray-800 dark:text-gray-100 truncate max-w-full">{uploadedFile.name}</strong>
                    <span className="whitespace-nowrap">{uploadedFile.words.toLocaleString()} words extracted</span>
                    {uploadedFile.truncated && <span className="whitespace-nowrap text-amber-600 dark:text-amber-400">(guest limit: first {GUEST_WORD_LIMIT} kept)</span>}
                  </span>
                  <button type="button" onClick={removeUploadedFile} className="flex-shrink-0 inline-flex items-center gap-1 font-semibold text-gray-500 hover:text-rose-500 px-2.5 min-h-[36px] rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20">
                    <X size={12} weight="bold" />Remove
                  </button>
                </div>
              )}

              {/* ── Hint after Rewrite Text / Save Changes — the text is editable
                  and the old results are gone until it's analyzed again ── */}
              {shownNotice && (
                <div className="mx-5 mb-3 flex items-start gap-2 text-xs text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-xl px-3 py-2">
                  <NotePencil size={14} weight="bold" className="flex-shrink-0 mt-px" />
                  <span>
                    {shownNotice.kind === 'rewritten'
                      ? 'Text rewritten. You can edit it freely, then click Analyze Text to check the new version.'
                      : 'Changes saved. Previous results were cleared — click Analyze Text to get updated results.'}
                  </span>
                </div>
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
                      <span className={`font-semibold ${shownWords >= GUEST_WORD_LIMIT ? 'text-rose-500' : shownWords >= Math.round(GUEST_WORD_LIMIT * 0.8) ? 'text-amber-500' : 'text-gray-400 dark:text-gray-500'}`}>
                        {shownWords}/{GUEST_WORD_LIMIT} words
                      </span>
                      {/* "Sign up for more words" nudge — shown at ≥80% of the guest limit */}
                      {wordCount >= Math.round(GUEST_WORD_LIMIT * 0.8) && (
                        <button
                          onClick={() => setShowAuthPrompt(true)}
                          className="text-brand-600 dark:text-brand-400 hover:underline font-semibold"
                        >
                          Sign up free for 500 words →
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
                        {shownWords} words{lockedTail && !editing && ` · ${FREE_WORD_LIMIT} will be analyzed`}
                        {editing && freeLimitActive && shownWords > FREE_WORD_LIMIT && ` · ${FREE_WORD_LIMIT} will be analyzed`}
                      </span>
                      <span className="text-gray-200 dark:text-gray-700">|</span>
                      <span className="text-gray-400 dark:text-gray-500">{editing ? draft.length : charCount} chars</span>
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
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {results && editing ? (
                    <>
                      {/* Edit mode — Cancel keeps the results; Save clears them */}
                      <button
                        onClick={cancelEditing}
                        className="text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 px-4 py-2 rounded-xl transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveEdits}
                        disabled={!draft.trim()}
                        title={!draft.trim() ? "Text can't be empty — use Delete to clear the editor" : undefined}
                        className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm px-6 py-2 rounded-xl shadow-btn hover:shadow-none active:scale-95 transition-all"
                      >
                        <FloppyDisk size={15} weight="bold" />
                        Save Changes
                      </button>
                    </>
                  ) : !results ? (
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
                        disabled={!text.trim() || analyzing}
                        className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm px-6 py-2 rounded-xl shadow-btn hover:shadow-none active:scale-95 transition-all"
                      >
                        {analyzing
                          ? <><SpinnerGap size={15} className="animate-spin" />Analyzing…</>
                          : <><BrainIcon size={15} color="white" faceColor="#0D9488" />Analyze Text</>}
                      </button>
                    </>
                  ) : results.detected.length > 0 ? (
                    <>
                    {/* Edit Text — edit the analyzed text by hand, then analyze again */}
                    <button
                      onClick={startEditing}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 border border-gray-200 dark:border-gray-700 hover:border-brand-400 dark:hover:border-brand-600 px-4 py-2 rounded-xl transition-all"
                    >
                      <NotePencil size={14} weight="bold" />
                      Edit Text
                    </button>
                    {/* Rewrite Text — replaces the editor text in place, then resets to pre-analysis state */}
                    <button
                      onClick={rewriteText}
                      className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm px-6 py-2 rounded-xl shadow-btn hover:shadow-none active:scale-95 transition-all"
                    >
                      <PencilSimple size={14} weight="bold" />
                      Rewrite Text
                    </button>
                    </>
                  ) : (
                    <>
                    {/* Nothing to rewrite — confirm the text was analyzed, without
                       claiming certainty that it's guaranteed bias-free */}
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 dark:text-brand-400">
                      <CheckCircle size={16} weight="fill" />
                      Analyzed — No significant bias detected
                    </span>
                    {/* Every suggestion applied by hand — still allow editing */}
                    <button
                      onClick={startEditing}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 border border-gray-200 dark:border-gray-700 hover:border-brand-400 dark:hover:border-brand-600 px-4 py-2 rounded-xl transition-all"
                    >
                      <NotePencil size={14} weight="bold" />
                      Edit Text
                    </button>
                    </>
                  )}
                </div>
              </div>

              {/* ── Analysis percentages — Male / Female / Gender-Neutral shares of the
                  overall score (always total 100%) + Classification. Shown for every
                  result, including no-bias ones (shownClean). ───────────────────── */}
              {shownAnalysis && breakdown && (
                <div className={`px-5 py-4 border-t border-gray-100 dark:border-gray-800 transition-opacity ${editing ? 'opacity-50' : ''}`}
                  title={editing ? 'These results are for the text before your edits — save and analyze again to update them' : undefined}>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Male Bias: <strong className="text-gray-900 dark:text-white tabular-nums">{breakdown.malePct}%</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Female Bias: <strong className="text-gray-900 dark:text-white tabular-nums">{breakdown.femalePct}%</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Gender-Neutral:{' '}
                        {noBiasFound && !neutralConfirmed
                          ? <strong className="text-amber-700 dark:text-amber-400" title="The AI couldn't review this text, so this isn't a confirmed result">Unconfirmed</strong>
                          : <strong className="text-gray-900 dark:text-white tabular-nums">{breakdown.neutralPct}%</strong>}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${noBiasFound && !neutralConfirmed ? 'bg-amber-500' : classificationInfo.dot}`} />
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Classification: <strong className="text-gray-900 dark:text-white">
                          {noBiasFound && !neutralConfirmed ? 'Not confirmed' : classificationInfo.label}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* ── Proportion bar — same three colors, widths = the percentages ── */}
                  {!(noBiasFound && !neutralConfirmed) && (
                    <div
                      className="flex h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800 mt-3"
                      role="img"
                      aria-label={`Male bias ${breakdown.malePct}%, female bias ${breakdown.femalePct}%, gender-neutral ${breakdown.neutralPct}%`}
                    >
                      <span className="bg-blue-500" style={{ width: `${breakdown.malePct}%` }} />
                      <span className="bg-rose-500" style={{ width: `${breakdown.femalePct}%` }} />
                      <span className="bg-brand-500" style={{ width: `${breakdown.neutralPct}%` }} />
                    </div>
                  )}

                  {/* ── Result message — hedged: 0% means GENTEK found no patterns, not
                      that the text is guaranteed bias-free; an AI-less check is never
                      presented as a confirmed Gender-Neutral result. ──────────────── */}
                  {neutralConfirmed ? (
                    <p className="flex items-start gap-1.5 text-xs font-medium text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-xl px-3 py-2 mt-3">
                      <CheckCircle size={14} weight="fill" className="flex-shrink-0 mt-px" />
                      Gender-Neutral — no significant gender-biased patterns were detected based on GENTEK's analysis.
                    </p>
                  ) : noBiasFound ? (
                    <p className="flex items-start gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2 mt-3">
                      <WarningCircle size={14} weight="fill" className="flex-shrink-0 mt-px" />
                      {aiCoverage === 'partial'
                        ? "No bias found in the parts GENTEK could check, but the AI couldn't review all of this text. Try again shortly for a complete result."
                        : "No bias found by the keyword check, but the AI couldn't review this text, so it isn't confirmed Gender-Neutral. Try again shortly."}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                      {breakdown.malePct > 0 && breakdown.femalePct > 0
                        ? `Both male- and female-biased patterns were detected (${shownAnalysis.detected.filter(d => d.type === 'male').length} male, ${shownAnalysis.detected.filter(d => d.type === 'female').length} female).`
                        : 'Potential gender-biased patterns were detected in the text.'}
                    </p>
                  )}

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
                <span className="text-5xl font-extrabold text-gray-900 dark:text-white">₱0</span>
                <span className="text-gray-400 dark:text-gray-500 mb-1.5">/forever</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Perfect for students and everyday writing.</p>
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
            {/* Premium plan card — featured with border and badge */}
            <div className="reveal reveal-delay-2 relative card p-8 flex flex-col border-2 border-brand-500 bg-brand-50/20 dark:bg-brand-900/10">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1.5 bg-brand-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-btn">
                  <Lightning size={11} weight="fill" />For long documents
                </span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Premium</h3>
              <div className="flex items-end gap-1 mb-4">
                <span className="text-5xl font-extrabold text-gray-900 dark:text-white">₱599</span>
                <span className="text-gray-400 dark:text-gray-500 mb-1.5">/30 days</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">One-time payment. No auto-renew — cancel anytime.</p>
              <button onClick={() => setShowAuthPrompt(true)} className="btn-primary w-full justify-center mb-6">
                Sign up to upgrade <ArrowRight size={14} weight="bold" />
              </button>
              <ul className="space-y-3 mt-auto">
                {PLAN_FEATURES.map(f => (
                  <li key={f.label} className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-300">
                    {f.pro === false
                      ? <X size={14} weight="bold" className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
                      : <Check size={14} weight="bold" className="text-brand-500 flex-shrink-0" />}
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

    {/* ── Hidden file input — opened by the Upload button / menu (openFilePicker).
        sr-only rather than display:none: some mobile browsers won't open a
        picker for a display:none input. ── */}
    <input
      ref={fileInputRef}
      type="file"
      accept={ACCEPT.all}
      tabIndex={-1}
      aria-hidden="true"
      className="sr-only"
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
      <WordPopup
        key={wordPopup.start}
        {...wordPopup}
        containerRef={resultsRef}
        onApply={(suggestion) => applyFix(wordPopup.start, wordPopup.end, suggestion)}
        onClose={closeWordPopup}
      />,
      document.body
    )}
</>
  )
}
