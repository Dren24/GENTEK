import { Link } from 'react-router-dom'
import { Check, ArrowRight, Lightning } from '@phosphor-icons/react'

const plans = [
  {
    name: 'Free',
    price: '0',
    period: 'forever',
    desc: 'Perfect for students and casual writers getting started.',
    cta: 'Get Started Free',
    ctaStyle: 'btn-outline w-full justify-center',
    features: ['200 analyses per month', 'Basic gender bias detection', '3 bias categories', 'Limited suggestions'],
    highlight: false,
  },
  {
    name: 'Pro',
    price: '9.99',
    period: 'per month',
    desc: 'For professionals and researchers who need full access.',
    cta: 'Start Pro Trial',
    ctaStyle: 'btn-primary w-full justify-center',
    features: [
      'Unlimited analyses',
      'Advanced AI suggestions',
      'Detailed bias reports',
      'Export results (PDF/CSV)',
      'Priority processing',
      'Analysis history',
    ],
    highlight: true,
    badge: 'Most Popular',
  },
]

export default function PricingPreview() {
  return (
    <section id="pricing-preview" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14 reveal">
          <p className="section-label mb-3">Pricing</p>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Simple, <span className="text-gradient">Transparent Plans</span>
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Start free, upgrade when you need more. No hidden fees.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-10">
          {plans.map((plan, i) => (
            <div
              key={plan.name}
              className={`reveal reveal-delay-${i + 1} relative rounded-2xl border-2 p-7 flex flex-col ${
                plan.highlight
                  ? 'border-brand-500 bg-brand-50/30 shadow-card-hover'
                  : 'border-gray-100 bg-white shadow-card'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-btn">
                    <Lightning size={11} weight="fill" />
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-5">
                <h3 className="font-bold text-gray-900 text-lg mb-1">{plan.name}</h3>
                <div className="flex items-end gap-1 mb-2">
                  <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                  <span className="text-gray-400 text-sm mb-1">/{plan.period}</span>
                </div>
                <p className="text-sm text-gray-500">{plan.desc}</p>
              </div>

              <Link to="/pricing" className={plan.ctaStyle + ' mb-5'}>
                {plan.cta}
                <ArrowRight size={14} weight="bold" />
              </Link>

              <ul className="space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                    <div className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                      <Check size={11} weight="bold" className="text-brand-600" />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="text-center reveal">
          <Link to="/pricing" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors">
            View full plan comparison
            <ArrowRight size={14} weight="bold" />
          </Link>
        </div>
      </div>
    </section>
  )
}
