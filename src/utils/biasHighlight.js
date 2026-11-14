// ── biasHighlight — locating, highlighting, and replacing detected bias in text ──
// Everything works on [start, end) ranges over the plain text. Most detections
// (gendered job titles, stereotype phrases) apply to every whole-word match of
// their word. AI-detected generic pronouns instead carry exact `spans` from the
// backend, because the same word ("he", "her") is usually ordinary elsewhere in
// the text — only the flagged occurrences are highlighted and replaced.

export function escapeRx(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── itemSpans — the item's backend spans if they still point at its word in
// this text, else null (callers then fall back to whole-word matching). ──────
function itemSpans(text, item) {
  if (!Array.isArray(item.spans) || item.spans.length === 0) return null
  const word = String(item.word).toLowerCase()
  const ok = item.spans.every(s =>
    Array.isArray(s) && Number.isInteger(s[0]) && Number.isInteger(s[1]) &&
    s[0] >= 0 && s[1] <= text.length && s[0] < s[1] &&
    text.slice(s[0], s[1]).toLowerCase() === word)
  return ok ? item.spans : null
}

// ── biasRanges — every range the analysis flags, sorted, with overlaps removed
// (an earlier/longer range wins). Computing this on the plain text — rather than
// regex-replacing word by word into HTML that already holds <mark> tags — keeps
// marks from nesting or matching inside another mark's data-reason text. ──────
export function biasRanges(text, detected) {
  const ranges = []
  detected.forEach(item => {
    if (!item.word) return
    const spans = itemSpans(text, item)
    if (spans) {
      spans.forEach(([start, end]) => ranges.push({ start, end, item }))
      return
    }
    const rx = new RegExp(`\\b${escapeRx(item.word).replace(/\s+/g, '\\s+')}\\b`, 'gi')
    for (const m of text.matchAll(rx)) {
      if (m[0]) ranges.push({ start: m.index, end: m.index + m[0].length, item })
    }
  })
  ranges.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start))
  const out = []
  let lastEnd = -1
  for (const r of ranges) {
    if (r.start >= lastEnd) { out.push(r); lastEnd = r.end }
  }
  return out
}

// ── highlightHtml — HTML-escapes user text and wraps each flagged range in a
// <mark> carrying the popup's data-* attributes. data-start/data-end are the
// range's position in the plain text: they identify exactly which occurrence
// was clicked, so the popup can anchor to it and fixRange() can replace only
// it. Escaping every segment prevents XSS when the result is injected via
// dangerouslySetInnerHTML. ─────────────────────────────────────────────────────
export function highlightHtml(text, detected) {
  let html = ''
  let pos = 0
  for (const { start, end, item } of biasRanges(text, detected)) {
    const { word, type, suggestion, reason } = item
    const cls = type === 'male' ? 'bias-male' : 'bias-female'
    html += escapeHtml(text.slice(pos, start)) +
      `<mark class="${cls}" data-start="${start}" data-end="${end}" data-word="${escapeAttr(word)}" data-suggestion="${escapeAttr(suggestion)}" data-reason="${escapeAttr(reason)}" data-type="${escapeAttr(type)}">${escapeHtml(text.slice(start, end))}</mark>`
    pos = end
  }
  return html + escapeHtml(text.slice(pos))
}

// ── Capitalization ─────────────────────────────────────────────────────────────
// Replacements must produce correctly capitalized text (real letters, not CSS):
//   • at a sentence start (start of text, a new line, or after . ? !) the
//     inserted word gets a capital first letter: "male employee" → "Female employee"
//   • a replaced word that was Capitalized or ALL CAPS keeps that style:
//     "Chairman" → "Chairperson", "MANKIND" → "HUMANKIND"
//   • mid-sentence, a suggestion that arrives Capitalized ("People can excel")
//     is lowered, unless its first word is a proper noun — mixed case like
//     "iPhone", "I", or a word the text itself writes capitalized mid-sentence.
// capitalizeSentences() (used by Rewrite Text) also capitalizes the first
// word of every sentence in the whole text.

// Common abbreviations whose period does NOT end a sentence ("e.g. the ...")
const ABBREVIATIONS = new Set(['e.g', 'i.e', 'etc', 'vs', 'a.m', 'p.m', 'mr', 'mrs', 'ms', 'dr', 'st', 'no', 'fig', 'approx'])

// ── isSentenceStart — true if position `i` begins a sentence: only spaces,
// quotes or opening brackets lie between it and the start of the text, a line
// break, or sentence-ending punctuation (that isn't an abbreviation). ─────────
export function isSentenceStart(text, i) {
  let j = i - 1
  while (j >= 0 && /[\s"'“‘(\[]/.test(text[j]) && text[j] !== '\n') j--
  if (j < 0 || text[j] === '\n') return true
  if (!/[.?!…]/.test(text[j])) return false
  if (text[j] === '.') {
    // "e.g. the", "Dr. smith" — the period belongs to an abbreviation
    const before = text.slice(0, j).match(/([A-Za-z.]+)$/)
    if (before && ABBREVIATIONS.has(before[1].toLowerCase())) return false
  }
  // The punctuation must be followed by whitespace before position i
  return /\s/.test(text.slice(j + 1, i))
}

const firstWord = (s) => (s.match(/[A-Za-zÀ-ÿ'’]+/) || [''])[0]
const upperFirst = (s) => s.replace(/[A-Za-zÀ-ÿ]/, c => c.toUpperCase())
const lowerFirst = (s) => s.replace(/[A-Za-zÀ-ÿ]/, c => c.toLowerCase())
// Mixed case inside the word ("iPhone", "McDonald", "GENTEK") — never re-case it
const hasInnerCaps = (w) => /[a-zà-ÿ]/.test(w) && /.[A-ZÀ-Þ]/.test(w)

// A word is treated as a proper noun if the text writes it capitalized
// somewhere that is NOT a sentence start ("... from Manila ...").
function isProperNounIn(text, word) {
  if (!word || word === 'I' || hasInnerCaps(word)) return true
  const rx = new RegExp(`(?<![\\w'’])${escapeRx(word)}(?![\\w'’])`, 'g')
  for (const m of text.matchAll(rx)) {
    if (/^[A-ZÀ-Þ]/.test(m[0]) && !isSentenceStart(text, m.index)) return true
  }
  return false
}

// ── matchCase — the suggestion, capitalized for where it is being inserted.
// `original` is the text it replaces; `start` its position in `text`. ─────────
export function matchCase(suggestion, text, start, original) {
  if (!suggestion) return suggestion
  const w = firstWord(suggestion)
  // ALL-CAPS original (and more than one letter) → ALL-CAPS replacement
  if (/[A-Z]/.test(original) && original === original.toUpperCase() && /[A-Z].*[A-Z]/.test(original)) {
    return suggestion.toUpperCase()
  }
  if (isSentenceStart(text, start) || /^[A-ZÀ-Þ]/.test(firstWord(original))) {
    return hasInnerCaps(w) ? suggestion : upperFirst(suggestion)
  }
  // Mid-sentence: lower a capitalized first word unless it's a proper noun
  if (/^[A-ZÀ-Þ][a-zà-ÿ'’]*$/.test(w) && w !== 'I' && !isProperNounIn(text, w)) return lowerFirst(suggestion)
  return suggestion
}

// ── capitalizeSentences — capital letter at the start of every sentence.
// Words with inner capitals ("iPhone") are left alone. Length never changes,
// so highlight ranges stay valid. ───────────────────────────────────────────────
export function capitalizeSentences(text) {
  return text.replace(/[A-Za-zÀ-ÿ][\w'’-]*/g, (word, i) => {
    if (!/^[a-zà-ÿ]/.test(word) || hasInnerCaps(word) || !isSentenceStart(text, i)) return word
    const up = upperFirst(word)
    return up.length === word.length ? up : word
  })
}

// ── applyEdits — replaces non-overlapping, sorted ranges in one pass. Returns
// the new text plus mapSpan, which moves a range from the old text to the new
// one (null if an edit touched it), so other items' spans stay accurate. ──────
function applyEdits(text, edits) {
  let out = ''
  let pos = 0
  for (const e of edits) {
    out += text.slice(pos, e.start) + e.replacement
    pos = e.end
  }
  out += text.slice(pos)

  const mapSpan = ([s, end]) => {
    let shift = 0
    for (const e of edits) {
      if (e.end <= s) shift += e.replacement.length - (e.end - e.start)
      else if (e.start < end) return null
    }
    return [s + shift, end + shift]
  }
  return { text: out, mapSpan }
}

// ── fixRange — replaces ONE highlighted occurrence (the one the user clicked,
// identified by its [start, end) range) with a suggestion. Everything else in
// the text is untouched. Returns the new text plus the detections that still
// apply: span-based items get their spans shifted (the replaced span is
// dropped); word-based items stay only if their word still occurs somewhere,
// so other copies of the same word remain highlighted. ─────────────────────────
export function fixRange(text, detected, start, end, suggestion) {
  if (!(start >= 0 && end <= text.length && start < end)) return { text, detected }
  const replacement = matchCase(suggestion, text, start, text.slice(start, end))
  const { text: newText, mapSpan } = applyEdits(text, [{ start, end, replacement }])

  const remaining = []
  detected.forEach(d => {
    if (itemSpans(text, d)) {
      const spans = d.spans.map(mapSpan).filter(Boolean)
      if (spans.length) remaining.push({ ...d, spans })
    } else if (biasRanges(newText, [d]).length) {
      remaining.push(d)
    }
  })
  return { text: newText, detected: remaining }
}

// ── rewriteAll — applies every suggestion to exactly what is highlighted
// (each capitalized for its position), then capitalizes every sentence start.
// A finding without a suggestion is left as written, never deleted. ────────
export function rewriteAll(text, detected) {
  const edits = biasRanges(text, detected)
    .filter(r => r.item.suggestion)
    .map(r => ({ start: r.start, end: r.end,
                 replacement: matchCase(r.item.suggestion, text, r.start, text.slice(r.start, r.end)) }))
  return capitalizeSentences(applyEdits(text, edits).text)
}
