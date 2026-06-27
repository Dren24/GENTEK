import { Link } from 'react-router-dom'
import { ClipboardText, CheckCircle, ArrowRight } from '@phosphor-icons/react'
import { GentekMark } from '../shared/GentekLogo'

const steps = [
  {
    number: '01',
    icon: ClipboardText,
    title: 'Paste Your Text',
    desc: 'Copy and paste any text into the GENTEK editor — essays, job ads, reports, social media posts, or academic papers.',
    color: 'text-brand-600',
    bg: 'bg-brand-50',
    border: 'border-brand-100',
  },
  {
    number: '02',
    icon: null,
    title: 'AI Analyzes It',
    desc: 'Our NLP engine scans every word and phrase for gender bias patterns learned from a curated bias dataset.',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
  },
  {
    number: '03',
    icon: CheckCircle,
    title: 'Get Instant Results',
    desc: 'See highlighted biased terms, your bias classification, a score, and actionable inclusive alternatives.',
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-100',
  },
]

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14 reveal">
          <p className="section-label mb-3">How It Works</p>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Bias Detection in <span className="text-gradient">Three Steps</span>
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            No setup required. Paste your text and GENTEK handles everything.
          </p>
        </div>

        {/* Steps */}
        <div className="relative grid md:grid-cols-3 gap-8 mb-14">
          {/* Connector line */}
          <div className="hidden md:block absolute top-12 left-[calc(16.7%+2.5rem)] right-[calc(16.7%+2.5rem)] h-px bg-gradient-to-r from-brand-200 via-blue-200 to-green-200" />

          {steps.map((step, i) => {
            const Icon = step.icon

            return (
              <div key={step.number} className={`reveal reveal-delay-${i + 1} flex flex-col items-center text-center`}>
                <div className={`relative z-10 w-24 h-24 rounded-2xl ${step.bg} border ${step.border} flex items-center justify-center mb-5 shadow-sm`}>
                  {Icon ? <Icon size={36} weight="duotone" className={step.color} /> : <GentekMark size={48} />}
                  <div className={`absolute -top-2.5 -right-2.5 w-7 h-7 rounded-xl bg-white border ${step.border} flex items-center justify-center shadow-sm`}>
                    <span className={`text-xs font-bold ${step.color}`}>{step.number}</span>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-xs">{step.desc}</p>
              </div>
            )
          })}
        </div>

        <div className="text-center reveal">
          <Link to="/detector" className="btn-primary inline-flex">
            Start Analyzing Now
            <ArrowRight size={15} weight="bold" />
          </Link>
        </div>
      </div>
    </section>
  )
}
