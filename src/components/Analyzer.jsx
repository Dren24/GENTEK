import { useState } from 'react'
import { ArrowRight, SpinnerGap, WarningCircle, CheckCircle, ArrowClockwise } from '@phosphor-icons/react'

const SAMPLE_TEXT =
  'The chairman of the board approved the proposal. She was overly emotional during the negotiation. The manpower required for this project is significant. Every businessman understands the risks involved in this field.'

const SAMPLE_TEXT_FEMALE =
  'The new manager was dismissed as bossy and hysterical when she challenged the plan. A nurturing housewife type is preferred for this client-facing role. The lady doctor on call responded quickly. Our stewardess welcomed every passenger.'

const BIASED_WORDS = [
  { word: 'chairman',        type: 'male',       suggestion: 'chairperson',          reason: 'Gendered occupational title' },
  { word: 'manpower',        type: 'male',       suggestion: 'workforce',             reason: 'Male-centric compound noun' },
  { word: 'businessman',     type: 'male',       suggestion: 'business professional', reason: 'Gendered occupational term' },
  { word: 'overly emotional',type: 'stereotype', suggestion: 'highly expressive',     reason: 'Gender-linked emotional stereotype' },
  { word: 'bossy',           type: 'stereotype', suggestion: 'assertive',             reason: 'Disproportionately applied to women' },
  { word: 'hysterical',      type: 'stereotype', suggestion: 'overwhelmed',           reason: 'Historically used to dismiss women\'s emotions' },
  { word: 'nurturing',       type: 'female',     suggestion: 'supportive',            reason: 'Gendered trait stereotype' },
  { word: 'housewife',       type: 'female',     suggestion: 'homemaker',             reason: 'Gendered term — "homemaker" is more inclusive' },
  { word: 'lady doctor',     type: 'female',     suggestion: 'doctor',                reason: 'The "lady" prefix is unnecessary and diminishing' },
  { word: 'stewardess',      type: 'female',     suggestion: 'flight attendant',      reason: 'Gendered occupational role' },
]

function getHighlightedHTML(text, words) {
  let result = text
  words.forEach(({ word, type }) => {
    const cls =
      type === 'male'
        ? 'highlight-male'
        : type === 'female'
        ? 'highlight-female'
        : 'highlight-stereotype'
    const regex = new RegExp(`\\b${word.replace(/\s+/g, '\\s+')}\\b`, 'gi')
    result = result.replace(regex, `<mark class="${cls}">${word}</mark>`)
  })
  return result
}

export default function Analyzer() {
  const [text, setText] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [results, setResults] = useState(null)

  const handleAnalyze = () => {
    if (!text.trim()) return
    setAnalyzing(true)
    setResults(null)

    setTimeout(() => {
      const detectedWords = BIASED_WORDS.filter((w) =>
        text.toLowerCase().includes(w.word.toLowerCase())
      )
      const maleCount = detectedWords.filter((w) => w.type === 'male').length
      const femaleCount = detectedWords.filter((w) => w.type === 'female').length
      const stereoCount = detectedWords.filter((w) => w.type === 'stereotype').length

      let classification = 'GENDER-NEUTRAL'
      let score = 0
      let classColor = 'text-emerald-400'
      let classBg = 'bg-emerald-500/15 border-emerald-500/30'

      if (maleCount > femaleCount) {
        classification = 'MALE-BIASED'
        score = Math.min(95, 45 + maleCount * 15 + stereoCount * 8)
        classColor = 'text-blue-300'
        classBg = 'bg-blue-600/20 border-blue-500/30'
      } else if (femaleCount > maleCount) {
        classification = 'FEMALE-BIASED'
        score = Math.min(95, 45 + femaleCount * 15 + stereoCount * 8)
        classColor = 'text-rose-300'
        classBg = 'bg-rose-600/20 border-rose-500/30'
      } else if (detectedWords.length > 0) {
        classification = 'MIXED-BIAS'
        score = 30 + detectedWords.length * 10
        classColor = 'text-amber-300'
        classBg = 'bg-amber-600/20 border-amber-500/30'
      }

      setResults({
        highlightedText: getHighlightedHTML(text, detectedWords),
        classification,
        score,
        classColor,
        classBg,
        detectedWords,
        totalWords: text.trim().split(/\s+/).length,
      })
      setAnalyzing(false)
    }, 1800)
  }

  const handleReset = () => {
    setText('')
    setResults(null)
  }

  const loadSample = (female = false) => {
    setText(female ? SAMPLE_TEXT_FEMALE : SAMPLE_TEXT)
    setResults(null)
  }

  return (
    <section id="analyzer" className="py-24 bg-navy-800/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14 reveal">
          <h2 className="text-4xl font-bold text-white tracking-tight mb-4">
            Try the <span className="text-gradient">Live Analyzer</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
            Paste any text below and see how GENTEK detects and categorizes gender-biased language.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 items-start">
          {/* Left - Input panel */}
          <div className="reveal rounded-2xl border border-white/[0.08] bg-navy-800/60 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Text Input</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadSample(false)}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  Male bias sample
                </button>
                <span className="text-slate-600 text-xs">·</span>
                <button
                  onClick={() => loadSample(true)}
                  className="text-xs text-rose-400 hover:text-rose-300 font-medium transition-colors"
                >
                  Female bias sample
                </button>
              </div>
            </div>

            <div className="p-5">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your essay, job listing, article, or any text here to analyze for gender bias..."
                className="w-full h-52 bg-navy-900/60 border border-white/[0.06] rounded-xl p-4 text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all leading-relaxed"
              />

              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {text.trim() ? `${text.trim().split(/\s+/).length} words` : 'No text entered'}
                </span>

                <div className="flex items-center gap-2">
                  {text && (
                    <button
                      onClick={handleReset}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.08] text-xs text-slate-400 hover:text-white hover:border-white/20 transition-all"
                    >
                      <ArrowClockwise size={12} />
                      Reset
                    </button>
                  )}
                  <button
                    onClick={handleAnalyze}
                    disabled={!text.trim() || analyzing}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/25 active:scale-95"
                  >
                    {analyzing ? (
                      <>
                        <SpinnerGap size={15} className="animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        Analyze Text
                        <ArrowRight size={14} weight="bold" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Note */}
            <div className="px-5 pb-5">
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <WarningCircle size={15} className="text-amber-400/70 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-slate-500 leading-relaxed">
                  This is a UI-only demo using mock analysis logic. Real NLP model integration is planned for the next development phase.
                </p>
              </div>
            </div>
          </div>

          {/* Right - Results panel */}
          <div className="reveal reveal-delay-2 rounded-2xl border border-white/[0.08] bg-navy-800/60 overflow-hidden min-h-[24rem]">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <span className="text-sm font-semibold text-white">Analysis Results</span>
            </div>

            {!results && !analyzing && (
              <div className="flex flex-col items-center justify-center h-72 text-center px-8">
                <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/15 flex items-center justify-center mb-4">
                  <CheckCircle size={28} weight="duotone" className="text-violet-400/50" />
                </div>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Your analysis results will appear here after you click "Analyze Text".
                </p>
              </div>
            )}

            {analyzing && (
              <div className="flex flex-col items-center justify-center h-72 gap-4">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-500 animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-white mb-1">Analyzing your text</p>
                  <p className="text-xs text-slate-500">Running NLP bias detection...</p>
                </div>
              </div>
            )}

            {results && (
              <div className="p-5 space-y-5 overflow-y-auto max-h-[calc(100vh-20rem)]">
                {/* Classification + score */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <span
                    className={`text-sm font-bold px-3 py-1.5 rounded-full border ${results.classBg} ${results.classColor} tracking-wide`}
                  >
                    {results.classification}
                  </span>
                  <span className="text-xs text-slate-400">
                    {results.detectedWords.length} bias pattern{results.detectedWords.length !== 1 ? 's' : ''} found in {results.totalWords} words
                  </span>
                </div>

                {/* Score bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-400 font-medium">Bias Intensity Score</span>
                    <span className={`font-bold ${results.classColor}`}>{results.score}%</span>
                  </div>
                  <div className="h-2 bg-navy-900 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bias-bar-fill"
                      style={{
                        '--target-width': `${results.score}%`,
                        background: 'linear-gradient(90deg, #7C3AED, #8B5CF6)',
                        width: `${results.score}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Highlighted text */}
                {results.detectedWords.length > 0 && (
                  <div>
                    <div className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-widest">
                      Highlighted Text
                    </div>
                    <div
                      className="text-sm text-slate-300 leading-[1.9] p-4 rounded-xl bg-navy-900/60 border border-white/[0.04]"
                      dangerouslySetInnerHTML={{ __html: results.highlightedText }}
                    />
                    {/* Legend */}
                    <div className="mt-2 flex flex-wrap gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-blue-500/40 border-b border-blue-400 inline-block" />
                        <span className="text-xs text-slate-500">Male-biased</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/40 border-b border-rose-400 inline-block" />
                        <span className="text-xs text-slate-500">Female-biased</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/30 border-b border-amber-400 inline-block" />
                        <span className="text-xs text-slate-500">Stereotype</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                {results.detectedWords.length > 0 ? (
                  <div>
                    <div className="text-xs text-slate-500 font-medium mb-3 uppercase tracking-widest">
                      Suggestions
                    </div>
                    <div className="space-y-2">
                      {results.detectedWords.map((w) => (
                        <div
                          key={w.word}
                          className="flex items-start gap-3 p-3 rounded-xl bg-navy-900/40 border border-white/[0.04]"
                        >
                          <ArrowRight size={14} className="text-violet-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm text-slate-400 line-through">{w.word}</span>
                              <span className="text-sm font-semibold text-violet-300">{w.suggestion}</span>
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5">{w.reason}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
                    <CheckCircle size={20} weight="fill" className="text-emerald-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-300">No bias detected</p>
                      <p className="text-xs text-slate-500 mt-0.5">Your text appears to use gender-neutral language.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
