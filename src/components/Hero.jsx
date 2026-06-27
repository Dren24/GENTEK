import { useEffect, useState } from 'react'
import { ArrowRight } from '@phosphor-icons/react'
import { BrainIcon } from './shared/GentekLogo'

const cyclingWords = ['Essays', 'Job Postings', 'Academic Papers', 'News Articles', 'Social Media']

function DemoCard() {
  return (
    <div className="relative animate-float">
      {/* Outer glow */}
      <div className="absolute -inset-4 bg-violet-600/10 blur-3xl rounded-3xl pointer-events-none" />

      {/* Card */}
      <div className="relative rounded-2xl border border-violet-500/20 bg-navy-800/80 backdrop-blur-sm overflow-hidden shadow-2xl shadow-black/40">
        {/* Browser chrome bar */}
        <div className="px-4 py-3 bg-navy-900/70 border-b border-white/[0.06] flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-500/60" />
            <div className="w-3 h-3 rounded-full bg-amber-500/60" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
          </div>
          <div className="ml-3 flex-1 bg-navy-900 rounded-md h-5 flex items-center px-3 border border-white/[0.05]">
            <span className="text-slate-500 text-[10px] font-mono">gentek.ai/analyze</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Text with highlights */}
          <div>
            <div className="text-[11px] text-slate-500 uppercase tracking-widest mb-2 font-medium">Input Text</div>
            <div className="text-sm text-slate-300 leading-[1.85] font-normal bg-navy-900/50 rounded-lg p-3 border border-white/[0.04]">
              The{' '}
              <mark className="highlight-male">chairman</mark>
              {' '}of the board approved the budget.{' '}
              The{' '}
              <mark className="highlight-male">manpower</mark>
              {' '}required is significant. Every{' '}
              <mark className="highlight-male">businessman</mark>
              {' '}knows the risks involved.
            </div>
          </div>

          {/* Analysis result */}
          <div className="rounded-lg bg-navy-900/60 border border-white/[0.06] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">Bias Classification</span>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-600/20 text-blue-300 border border-blue-500/30 tracking-wide">
                MALE-BIASED
              </span>
            </div>

            {/* Score bar */}
            <div>
              <div className="flex justify-between text-[11px] mb-1.5">
                <span className="text-slate-500">Bias Score</span>
                <span className="text-blue-400 font-semibold">78%</span>
              </div>
              <div className="h-1.5 bg-navy-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-500"
                  style={{ width: '78%' }}
                />
              </div>
            </div>

            {/* Suggestions */}
            <div className="space-y-1.5">
              <div className="text-[11px] text-slate-500 font-medium">Suggestions</div>
              {[
                { from: 'chairman', to: 'chairperson' },
                { from: 'manpower', to: 'workforce' },
                { from: 'businessman', to: 'professional' },
              ].map((s) => (
                <div key={s.from} className="flex items-center gap-2 text-[11px]">
                  <span className="text-slate-400 line-through opacity-60">{s.from}</span>
                  <ArrowRight size={10} className="text-violet-400 flex-shrink-0" />
                  <span className="text-violet-300 font-medium">{s.to}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating badge */}
      <div className="absolute -top-3 -right-3 glass-violet rounded-xl px-3 py-2 shadow-lg shadow-violet-900/30">
        <div className="flex items-center gap-1.5">
          <div className="relative flex">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <div className="absolute top-0 left-0 w-2 h-2 rounded-full bg-emerald-400 ping-slow opacity-60" />
          </div>
          <span className="text-xs font-semibold text-emerald-400">AI Active</span>
        </div>
      </div>
    </div>
  )
}

export default function Hero() {
  const [wordIndex, setWordIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((i) => (i + 1) % cyclingWords.length)
    }, 2400)
    return () => clearInterval(interval)
  }, [])

  return (
    <section
      id="home"
      className="relative min-h-[100dvh] flex items-center overflow-hidden pt-16"
    >
      {/* Background layers */}
      <div className="absolute inset-0 bg-navy-900" />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 60% 40%, rgba(124,58,237,0.12) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 20% 80%, rgba(6,182,212,0.07) 0%, transparent 60%)',
        }}
      />
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left - Content */}
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 glass-violet rounded-full px-4 py-2 animate-fade-up">
              <BrainIcon size={14} color="#a78bfa" faceColor="#1e1b4b" />
              <span className="text-xs font-semibold text-violet-300 tracking-wide">
                AI-Powered NLP Writing Assistant
              </span>
            </div>

            {/* Headline */}
            <div className="animate-fade-up" style={{ animationDelay: '0.1s', opacity: 0, animationFillMode: 'forwards' }}>
              <h1 className="text-5xl sm:text-6xl font-bold leading-[1.07] tracking-tight text-white">
                Detect Gender Bias{' '}
                <span className="block text-gradient">Before It Spreads.</span>
              </h1>
            </div>

            {/* Subtext */}
            <p
              className="text-lg text-slate-400 leading-relaxed max-w-xl animate-fade-up"
              style={{ animationDelay: '0.2s', opacity: 0, animationFillMode: 'forwards' }}
            >
              GENTEK uses advanced NLP to analyze{' '}
              <span className="text-violet-300 font-medium transition-all duration-500">
                {cyclingWords[wordIndex]}
              </span>{' '}
              for gender-biased language and suggests inclusive alternatives in seconds.
            </p>

            {/* CTAs */}
            <div
              className="flex flex-wrap gap-3 animate-fade-up"
              style={{ animationDelay: '0.3s', opacity: 0, animationFillMode: 'forwards' }}
            >
              <a
                href="#analyzer"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all duration-200 hover:shadow-xl hover:shadow-violet-500/30 active:scale-95"
              >
                Analyze Text Free
                <ArrowRight size={16} weight="bold" />
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-white/10 hover:border-violet-500/40 text-slate-300 hover:text-white font-semibold text-sm transition-all duration-200 hover:bg-white/[0.04] active:scale-95"
              >
                See How It Works
              </a>
            </div>

            {/* Stats */}
            <div
              className="flex flex-wrap gap-6 animate-fade-up"
              style={{ animationDelay: '0.4s', opacity: 0, animationFillMode: 'forwards' }}
            >
              {[
                { value: '15+', label: 'Bias Patterns' },
                { value: '3', label: 'Categories' },
                { value: 'Real-time', label: 'Analysis' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-xl font-bold text-white">{stat.value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right - Demo card */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="w-full max-w-md">
              <DemoCard />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-navy-900 to-transparent pointer-events-none" />
    </section>
  )
}
