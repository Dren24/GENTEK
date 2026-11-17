// ── documentText — turns an uploaded PDF / Word (.docx) / TXT file into plain
// text for the editor. Runs entirely in the browser: the original file is
// never uploaded anywhere; only the extracted text is later sent to /analyze.
//
// Mobile notes (why this file looks the way it does):
//   • PDF.js "modern" build calls brand-new JS APIs (Map.getOrInsertComputed,
//     Math.sumPrecise, Promise.try…) that most phone browsers don't have yet,
//     so it crashed on iPhone/Android. The "legacy" build ships polyfills.
//   • PDF.js and Mammoth are loaded only when a file is picked (dynamic
//     import), so the analyzer page stays light on phones.
//   • File type is detected from the name OR the MIME type — Android cloud
//     pickers sometimes hand over files whose name has no extension.
//   • Every failure becomes a readable message (UploadError) instead of a
//     silent console error.

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024   // 25 MB

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

// `accept` strings for the file input — extension AND MIME type, so iOS Files
// and Android pickers both enable the right files.
export const ACCEPT = {
  pdf:  '.pdf,application/pdf',
  docx: `.docx,${DOCX_MIME}`,
  txt:  '.txt,text/plain',
}
ACCEPT.all = [ACCEPT.pdf, ACCEPT.docx, ACCEPT.txt].join(',')

export class UploadError extends Error {}

// ── detectKind — 'pdf' | 'docx' | 'txt' | 'doc' | null ────────────────────────
export function detectKind(file) {
  const name = (file.name || '').toLowerCase().trim()
  const ext = name.includes('.') ? name.split('.').pop() : ''
  if (ext === 'pdf' || file.type === 'application/pdf') return 'pdf'
  if (ext === 'docx' || file.type === DOCX_MIME) return 'docx'
  if (ext === 'txt' || file.type === 'text/plain') return 'txt'
  if (ext === 'doc' || file.type === 'application/msword') return 'doc'
  return null
}

// ── cleanText — normalizes line endings and blank lines, drops control chars ─
export function cleanText(s) {
  return s
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

let pdfjsPromise = null
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist/legacy/build/pdf.min.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default
      return lib
    }).catch(err => { pdfjsPromise = null; throw err })
  }
  return pdfjsPromise
}

async function pdfText(data, onProgress) {
  const pdfjs = await loadPdfjs()
  const task = pdfjs.getDocument({ data, isEvalSupported: false })
  let pdf
  try {
    pdf = await task.promise
  } catch (err) {
    if (err?.name === 'PasswordException') throw new UploadError('This PDF is password-protected. Remove the password and upload it again.')
    throw new UploadError("This PDF couldn't be opened — the file may be damaged or not a real PDF.")
  }
  const pages = []
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      onProgress?.(`Reading page ${i} of ${pdf.numPages}…`)
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      // Keep the PDF's own line breaks (hasEOL) instead of one long line
      pages.push(content.items.map(it => (it.str || '') + (it.hasEOL ? '\n' : '')).join(''))
      page.cleanup()
    }
  } finally {
    task.destroy()   // frees the worker's copy of the document
  }
  return pages.join('\n\n')
}

async function docxText(data) {
  const { default: mammoth } = await import('mammoth')
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: data })
    return result.value
  } catch {
    throw new UploadError("This Word file couldn't be read — it may be damaged. Try saving it again as .docx.")
  }
}

// ── extractText — main entry. Returns cleaned text or throws UploadError. ────
export async function extractText(file, onProgress) {
  const kind = detectKind(file)
  if (kind === 'doc') throw new UploadError('Old Word (.doc) files aren\'t supported. Save it as .docx or PDF, then upload again.')
  if (!kind) throw new UploadError('Unsupported file type. Please upload a PDF, Word (.docx), or TXT file.')
  if (file.size === 0) throw new UploadError('This file is empty.')
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError(`This file is too large (${(file.size / 1048576).toFixed(1)} MB). The maximum is ${MAX_UPLOAD_BYTES / 1048576} MB.`)

  let raw
  try {
    onProgress?.('Reading file…')
    if (kind === 'txt') {
      raw = await file.text()
      // A "text" file full of NUL bytes is really a binary file renamed
      if ((raw.match(/\u0000/g) || []).length > raw.length / 10) throw new UploadError("This doesn't look like a plain-text file.")
    } else {
      const data = await file.arrayBuffer()
      raw = kind === 'pdf' ? await pdfText(data, onProgress) : await docxText(data)
    }
  } catch (err) {
    if (err instanceof UploadError) throw err
    // Couldn't read the File object at all (e.g. a cloud file that failed to download)
    if (err?.name === 'NotReadableError' || err?.name === 'NotFoundError') throw new UploadError("The file couldn't be read from your device. If it's in cloud storage, download it first and try again.")
    console.error('File parse error:', err?.name, err?.message, err)
    throw new UploadError("Something went wrong reading this file. Please try again or use a different file.")
  }

  const text = cleanText(raw)
  if (!text) {
    throw new UploadError(kind === 'pdf'
      ? 'No selectable text found in this PDF — it is probably a scanned image. Use a PDF with real text, or paste the text instead.'
      : 'No text found in this file.')
  }
  return { text, kind }
}
