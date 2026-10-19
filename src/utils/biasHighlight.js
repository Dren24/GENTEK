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
// <mark> carrying the popup's data-* attributes. Escaping every segment
// prevents XSS when the result is injected via dangerouslySetInnerHTML. ──────
export function highlightHtml(text, detected) {
  let html = ''
  let pos = 0
  for (const { start, end, item } of biasRanges(text, detected)) {
    const { word, type, suggestion, reason } = item
    const cls = type === 'male' ? 'bias-male' : 'bias-female'
    html += escapeHtml(text.slice(pos, start)) +
      `<mark class="${cls}" data-word="${escapeAttr(word)}" data-suggestion="${escapeAttr(suggestion)}" data-reason="${escapeAttr(reason)}" data-type="${escapeAttr(type)}">${escapeHtml(text.slice(start, end))}</mark>`
    pos = end
  }
  return html + escapeHtml(text.slice(pos))
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

// ── fixOne — applies one word's suggestion to exactly the ranges highlighted
// for it, and returns the new text plus the remaining detections (spans
// shifted to match; a detection whose every span was overwritten is dropped). ─
export function fixOne(text, detected, word, suggestion) {
  const key = word.toLowerCase()
  const edits = biasRanges(text, detected)
    .filter(r => r.item.word.toLowerCase() === key)
    .map(r => ({ start: r.start, end: r.end, replacement: suggestion }))
  const { text: newText, mapSpan } = applyEdits(text, edits)

  const remaining = []
  detected.forEach(d => {
    if (d.word.toLowerCase() === key) return
    if (!itemSpans(text, d)) { remaining.push(d); return }
    const spans = d.spans.map(mapSpan).filter(Boolean)
    if (spans.length) remaining.push({ ...d, spans })
  })
  return { text: newText, detected: remaining }
}

// ── rewriteAll — applies every suggestion to exactly what is highlighted. ────
export function rewriteAll(text, detected) {
  const edits = biasRanges(text, detected)
    .map(r => ({ start: r.start, end: r.end, replacement: r.item.suggestion }))
  return applyEdits(text, edits).text
}
