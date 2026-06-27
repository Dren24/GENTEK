import { Check, X, ArrowRight, Lightning } from '@phosphor-icons/react'

const plans = [
  {
    name: 'Free',
    price: '0',
    period: 'forever',
    description: 'Perfect for students and casual users exploring gender bias detection.',
    cta: 'Get Started Free',
    ctaStyle: 'border border-white/10 hover:border-violet-500/40 text-white hover:bg-white/[0.04]',
    highlighted: false,
    features: [
      { text: '500 words per analysis', included: true },
      { text: 'Basic bias detection', included: true },
      { text: '3 categories (Male/Female/Neutral)', included: true },
      { text: '3 suggestions per analysis', included: true },
      { text: 'Word highlighting', included: true },
      { text: 'Unlimited analyses', included: false },
      { text: 'Detailed bias report', included: false },
      { text: 'Export results (PDF/CSV)', included: false },
      { text: 'API access', included: false },
      { text: 'Priority support', included: false },
    ],
  },
  {
    name: 'Pro',
    price: '9.99',
    period: 'per month',
    description: 'For professionals, researchers, and organizations who need full access.',
    cta: 'Start Pro Trial',
    ctaStyle: 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40',
    highlighted: true,
    badge: 'Most Popular',
    features: [
      { text: 'Unlimited words per analysis', included: true },
      { text: 'Advanced bias detection', included: true },
      { text: '3 categories (Male/Female/Neutral)', included: true },
      { text: 'Unlimited suggestions', included: true },
      { text: 'Word highlighting', included: true },
      { text: 'Unlimited analyses', included: true },
      { text: 'Detailed bias report', included: true },
      { text: 'Export results (PDF/CSV)', included: true },
      { text: 'API access', included: true },
      { text: 'Priority support', included: true },
    ],
  },
]

export default function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-navy-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14 reveal">
          <h2 className="text-4xl font-bold text-white tracking-tight mb-4">
            Simple, <span className="text-gradient">Transparent Pricing</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
            Start free with no credit card required. Upgrade when you need more power.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {plans.map((plan, i) => (
            <div
              key={plan.name}
              className={`reveal reveal-delay-${i + 1} relative rounded-2xl border transition-all duration-300 ${
                plan.highlighted
                  ? 'border-violet-500/40 bg-navy-800/80 animate-pulse-glow'
                  : 'border-white/[0.08] bg-navy-800/40 hover:border-white/15'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-600 text-white text-xs font-bold shadow-lg shadow-violet-600/30">
                    <Lightning size={11} weight="fill" />
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="p-7">
                {/* Plan header */}
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                  <div className="flex items-end gap-1 mb-3">
                    <span className="text-4xl font-bold text-white">${plan.price}</span>
                    <span className="text-slate-400 text-sm mb-1">/{plan.period}</span>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed">{plan.description}</p>
                </div>

                {/* CTA */}
                <a
                  href="#analyzer"
                  className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95 mb-7 ${plan.ctaStyle}`}
                >
                  {plan.cta}
                  <ArrowRight size={14} weight="bold" />
                </a>

                {/* Feature list */}
                <div className="space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature.text} className="flex items-center gap-3">
                      {feature.included ? (
                        <div className="w-5 h-5 rounded-full bg-violet-500/15 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                          <Check size={11} weight="bold" className="text-violet-400" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                          <X size={11} weight="bold" className="text-slate-600" />
                        </div>
                      )}
                      <span
                        className={`text-sm ${
                          feature.included ? 'text-slate-300' : 'text-slate-600'
                        }`}
                      >
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <p className="text-center text-slate-500 text-sm mt-10 reveal">
          All plans include access to the web application. No credit card required to start.
          Pricing shown is for the planned release.
        </p>
      </div>
    </section>
  )
}
