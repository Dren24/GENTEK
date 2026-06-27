import { ClipboardText, CheckCircle } from '@phosphor-icons/react'
import { GentekMark } from './shared/GentekLogo'

const steps = [
  {
    number: '01',
    icon: ClipboardText,
    title: 'Paste Your Text',
    description:
      'Upload or paste any text - essays, job listings, academic papers, social media posts, or business documents.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
  },
  {
    number: '02',
    icon: null,
    title: 'AI Analyzes for Bias',
    description:
      'Our NLP engine scans for gender-biased words, phrases, and expressions, detecting patterns learned from curated datasets.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
  },
  {
    number: '03',
    icon: CheckCircle,
    title: 'Get Actionable Results',
    description:
      'Receive a bias classification, highlighted terms, inclusive alternatives, and a detailed bias report you can act on immediately.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-navy-800/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16 reveal">
          <h2 className="text-4xl font-bold text-white tracking-tight mb-4">
            From Text to Insights in{' '}
            <span className="text-gradient">Three Steps</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
            No complex setup. Paste your text and GENTEK handles the rest.
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connecting line (desktop only) */}
          <div
            className="hidden md:block absolute top-10 left-[calc(16.67%+2rem)] right-[calc(16.67%+2rem)] h-px"
            style={{
              background:
                'linear-gradient(90deg, rgba(139,92,246,0.4), rgba(34,211,238,0.4), rgba(52,211,153,0.4))',
            }}
          />

          {steps.map((step, i) => {
            const Icon = step.icon
            return (
              <div
                key={step.number}
                className={`reveal reveal-delay-${i + 1} relative flex flex-col items-center text-center group`}
              >
                {/* Step number circle */}
                <div className={`relative z-10 w-20 h-20 rounded-2xl ${step.bg} border ${step.border} flex items-center justify-center mb-6 group-hover:-translate-y-1 transition-transform duration-300`}>
                  {Icon ? <Icon size={32} weight="duotone" className={step.color} /> : <GentekMark size={40} />}
                  <div className={`absolute -top-3 -right-3 w-7 h-7 rounded-lg bg-navy-800 border ${step.border} flex items-center justify-center`}>
                    <span className={`text-xs font-bold ${step.color}`}>{step.number}</span>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-white mb-3">{step.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed max-w-xs">{step.description}</p>
              </div>
            )
          })}
        </div>

        {/* CTA row */}
        <div className="mt-16 text-center reveal">
          <a
            href="#analyzer"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-all duration-200 hover:shadow-xl hover:shadow-violet-500/30 active:scale-95"
          >
            Try the Analyzer Now
          </a>
        </div>
      </div>
    </section>
  )
}
