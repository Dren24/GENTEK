import { Link } from 'react-router-dom'
import { ArrowRight, Play } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'

const cyclingWords = ['Essays', 'Job Postings', 'Research Papers', 'News Articles', 'Social Media']

const DEMO_MODES = [
  {
    label: 'MALE-BIASED',
    labelStyle: 'bg-blue-100 text-blue-700 border border-blue-200',
    scoreStyle: 'bg-blue-100 border-blue-400 text-blue-700',
    bottomStyle: 'bg-blue-600',
    score: '78%',
    count: '3 bias patterns detected',
    barColor: 'bg-blue-500',
    input: (
      <p className="text-xs text-gray-600 leading-6">
        The{' '}<mark className="bias-male">chairman</mark>{' '}of the board approved
        the budget. The{' '}<mark className="bias-male">manpower</mark>{' '}needed is
        significant. Every{' '}<mark className="bias-male">businessman</mark>{' '}understands this.
      </p>
    ),
    suggestions: [
      { from: 'chairman', to: 'chairperson' },
      { from: 'manpower', to: 'workforce' },
      { from: 'businessman', to: 'professional' },
    ],
  },
  {
    label: 'FEMALE-BIASED',
    labelStyle: 'bg-rose-100 text-rose-700 border border-rose-200',
    scoreStyle: 'bg-rose-100 border-rose-400 text-rose-700',
    bottomStyle: 'bg-rose-500',
    score: '82%',
    count: '4 bias patterns detected',
    barColor: 'bg-rose-500',
    input: (
      <p className="text-xs text-gray-600 leading-6">
        She was called{' '}<mark className="bias-stereotype">bossy</mark>{' '}and{' '}
        <mark className="bias-stereotype">hysterical</mark>{' '}when she pushed back.
        The{' '}<mark className="bias-female">housewife</mark>{' '}segment is key.
        The{' '}<mark className="bias-female">lady doctor</mark>{' '}responded quickly.
      </p>
    ),
    suggestions: [
      { from: 'bossy', to: 'assertive' },
      { from: 'hysterical', to: 'overwhelmed' },
      { from: 'housewife', to: 'homemaker' },
      { from: 'lady doctor', to: 'doctor' },
    ],
  },
]

function MiniDetectorDemo() {
  const [modeIdx, setModeIdx] = useState(0)
  const demo = DEMO_MODES[modeIdx]

  useEffect(() => {
    const t = setInterval(() => setModeIdx(i => (i + 1) % DEMO_MODES.length), 3500)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="relative">
      <div className="absolute -inset-3 bg-gradient-to-br from-brand-200/40 to-purple-100/40 blur-2xl rounded-3xl" />
      <div className="relative bg-white rounded-2xl shadow-card-hover border border-gray-100 overflow-hidden">
        {/* Window chrome */}
        <div className="bg-gray-50 border-b border-gray-100 px-4 py-2.5 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
            <div className="w-3 h-3 rounded-full bg-green-400/70" />
          </div>
          <div className="ml-2 flex-1 bg-white rounded-md h-5 border border-gray-100 flex items-center px-2">
            <span className="text-gray-400 text-[10px] font-mono">gentek.ai/detector</span>
          </div>
          {/* Mode pills */}
          <div className="flex gap-1">
            {DEMO_MODES.map((m, i) => (
              <button
                key={m.label}
                onClick={() => setModeIdx(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === modeIdx ? 'bg-brand-500 scale-125' : 'bg-gray-300'}`}
              />
            ))}
          </div>
        </div>

        {/* Two-panel preview */}
        <div className="grid grid-cols-2 divide-x divide-gray-100 min-h-[220px]">
          {/* Input */}
          <div className="p-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Input Text</p>
            {demo.input}
          </div>

          {/* Results */}
          <div className="p-4 bg-gray-50/60">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Analysis</p>

            {/* Score */}
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${demo.scoreStyle}`}>
                <span className="font-bold text-[10px]">{demo.score}</span>
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${demo.labelStyle}`}>
                {demo.label}
              </span>
            </div>

            {/* Suggestions */}
            <div className="space-y-1.5">
              {demo.suggestions.slice(0, 3).map((s) => (
                <div key={s.from} className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-gray-400 line-through">{s.from}</span>
                  <ArrowRight size={9} className="text-brand-400 flex-shrink-0" />
                  <span className="text-brand-600 font-semibold">{s.to}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className={`${demo.bottomStyle} px-4 py-2 flex items-center justify-between transition-colors duration-500`}>
          <span className="text-white/80 text-[11px]">{demo.count}</span>
          <span className="text-white text-[11px] font-semibold">Analyze &rarr;</span>
        </div>
      </div>
    </div>
  )
}

export default function HeroSection() {
  const [wordIdx, setWordIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setWordIdx((i) => (i + 1) % cyclingWords.length), 2200)
    return () => clearInterval(t)
  }, [])

  return (
    <section className="pt-24 pb-16 bg-hero-gradient overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          {/* Left */}
          <div className="space-y-7">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-100 text-brand-700 rounded-full px-4 py-1.5 text-xs font-semibold animate-fade-up">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 inline-block" />
              AI-Powered Gender Bias Detection
            </div>

            {/* Headline */}
            <div className="animate-fade-up" style={{ animationDelay: '0.1s', opacity: 0, animationFillMode: 'forwards' }}>
              <h1 className="text-5xl lg:text-6xl font-bold leading-[1.08] tracking-tight text-gray-900">
                Write Inclusively.<br />
                <span className="text-gradient">Start with GENTEK.</span>
              </h1>
            </div>

            {/* Subtext */}
            <p
              className="text-lg text-gray-500 leading-relaxed max-w-lg animate-fade-up"
              style={{ animationDelay: '0.18s', opacity: 0, animationFillMode: 'forwards' }}
            >
              GENTEK analyzes{' '}
              <span className="text-brand-600 font-semibold transition-all duration-500">
                {cyclingWords[wordIdx]}
              </span>{' '}
              for gender-biased language and suggests inclusive alternatives powered by NLP.
            </p>

            {/* CTAs */}
            <div
              className="flex flex-wrap gap-3 animate-fade-up"
              style={{ animationDelay: '0.26s', opacity: 0, animationFillMode: 'forwards' }}
            >
              <Link to="/detector" className="btn-primary">
                Try GENTEK Free
                <ArrowRight size={15} weight="bold" />
              </Link>
              <a
                href="#how-it-works"
                className="btn-outline"
              >
                <Play size={14} weight="fill" />
                See How It Works
              </a>
            </div>

            {/* Trust line */}
            <p
              className="text-xs text-gray-400 animate-fade-up"
              style={{ animationDelay: '0.34s', opacity: 0, animationFillMode: 'forwards' }}
            >
              Free plan available &bull; No credit card required &bull; Trusted by writers worldwide
            </p>
          </div>

          {/* Right - Mini product demo */}
          <div
            className="animate-fade-up"
            style={{ animationDelay: '0.3s', opacity: 0, animationFillMode: 'forwards' }}
          >
            <MiniDetectorDemo />
          </div>
        </div>
      </div>
    </section>
  )
}
