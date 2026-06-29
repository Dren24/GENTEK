import { useState } from 'react'
import { X, Check, ArrowRight, Lightning, Clock } from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import PaymentModal from './PaymentModal'

const PERSONAL_PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: '/month',
    desc: 'Get started with bias detection',
    cta: 'Your current plan',
    ctaStyle: 'outline',
    features: [
      '200 analyses per month',
      'Basic gender bias detection',
      '3 classification types',
      '3 suggestions per analysis',
      'Visual word highlighting',
      'Bias score indicator',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 299,
    period: '/month',
    desc: 'For students and regular writers',
    cta: 'Upgrade to Starter',
    ctaStyle: 'outline',
    features: [
      '1,000 analyses per month',
      'Advanced bias detection',
      'All classification types',
      'Unlimited suggestions',
      'Visual word highlighting',
      'Bias score indicator',
      'Analysis history (30 days)',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 599,
    originalPrice: 870,
    period: '/month',
    badge: 'LIMITED TIME',
    promoNote: 'First month free',
    desc: 'Full power for professionals',
    cta: 'Claim free offer',
    ctaStyle: 'primary',
    featured: true,
    features: [
      'Unlimited analyses',
      'Advanced AI suggestions',
      'All classification types',
      'Unlimited suggestions',
      'Detailed bias reports',
      'Export results (PDF/CSV)',
      'Analysis history (unlimited)',
      'Priority processing',
      'API access',
      'Email support',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    price: 1149,
    period: '/user/month',
    desc: 'For organizations & teams',
    cta: 'Upgrade to Team',
    ctaStyle: 'outline',
    features: [
      'Everything in Pro',
      'Up to 25 team members',
      'Team analytics dashboard',
      'Shared analysis history',
      'Role-based access',
      'Centralized billing',
      'Priority email support',
      'Onboarding session',
    ],
  },
]

const BUSINESS_PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: '/month',
    desc: 'Get started with bias detection',
    cta: 'Your current plan',
    ctaStyle: 'outline',
    features: [
      '200 analyses per month',
      'Basic gender bias detection',
      'Bias score indicator',
      'Limited history',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: 449,
    period: '/user/month',
    desc: 'A secure workspace for growing companies',
    cta: 'Upgrade',
    ctaStyle: 'primary',
    featured: true,
    features: [
      'Everything in Pro',
      'Unlimited team members',
      'Admin dashboard',
      'SSO / SAML security',
      'Custom integrations',
      'API access with higher rate limits',
      'Centralized billing & invoicing',
      'Dedicated account manager',
      'SLA guarantee',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    customPrice: true,
    period: '',
    desc: 'For large organizations with custom needs',
    cta: 'Contact us',
    ctaStyle: 'outline',
    features: [
      'Everything in Business',
      'Custom model fine-tuning',
      'On-premise deployment option',
      'Custom retention policies',
      'Advanced audit logs',
      'Usage budgeting & controls',
      'Dedicated support team',
    ],
  },
]

function PlanCard({ plan, annual, onUpgrade }) {
  const displayPrice = plan.customPrice
    ? null
    : annual && plan.price > 0
      ? Math.round(plan.price * 0.75).toLocaleString()
      : (plan.price ?? 0).toLocaleString()

  return (
    <div className={`
      relative flex flex-col rounded-2xl p-5 transition-all
      ${plan.featured
        ? 'bg-white dark:bg-gray-800 border-2 border-blue-500 shadow-xl'
        : 'bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700'}
    `}>
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-[10px] font-bold px-3 py-1 rounded-full tracking-wider whitespace-nowrap">
            <Clock size={9} weight="fill" />
            {plan.badge}
          </span>
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">{plan.name}</h3>

        {plan.customPrice ? (
          <p className="text-2xl font-extrabold text-gray-900 dark:text-white mb-1">Custom pricing</p>
        ) : (
          <div className="flex items-end gap-1 mb-0.5">
            {plan.originalPrice && (
              <span className="text-base font-bold text-gray-400 dark:text-gray-500 line-through">₱{plan.originalPrice}</span>
            )}
            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
              {plan.price === 0 ? '₱0' : `₱${displayPrice}`}
            </span>
            <span className="text-gray-400 dark:text-gray-400 text-xs mb-1">{plan.price === 0 ? '/month' : plan.period}</span>
          </div>
        )}

        {plan.promoNote && (
          <p className="text-blue-600 dark:text-blue-400 text-[11px] font-semibold mb-0.5">{plan.promoNote}</p>
        )}
        <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">{plan.desc}</p>
      </div>

      {plan.ctaStyle === 'primary' ? (
        <button
          onClick={() => plan.price > 0 && onUpgrade(plan)}
          className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors mb-4"
        >
          {plan.cta}
        </button>
      ) : plan.id === 'free' ? (
        <button className="w-full py-2 rounded-xl text-sm font-semibold transition-colors mb-4 border border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 cursor-default">
          {plan.cta}
        </button>
      ) : plan.customPrice ? (
        <a
          href="mailto:support@gentek.ai"
          className="block w-full py-2 rounded-xl text-sm font-semibold text-center transition-colors mb-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          {plan.cta}
        </a>
      ) : (
        <button
          onClick={() => onUpgrade(plan)}
          className="w-full py-2 rounded-xl text-sm font-semibold transition-colors mb-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          {plan.cta}
        </button>
      )}

      <ul className="space-y-2 mt-auto">
        {plan.features.map(f => (
          <li key={f} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
            <Check size={12} weight="bold" className={`flex-shrink-0 mt-0.5 ${plan.featured ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'}`} />
            {f}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function PricingModal() {
  const { pricingOpen, closePricing } = useAuth()
  const [tab, setTab]         = useState('personal')
  const [annual, setAnnual]   = useState(false)
  const [paying, setPaying]   = useState(null)

  if (!pricingOpen) return null

  const plans = tab === 'personal' ? PERSONAL_PLANS : BUSINESS_PLANS

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto py-6 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={closePricing}
      />

      {/* Modal panel */}
      <div
        className="relative w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800"
        style={{ animation: 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)' }}
      >
        <style>{`
          @keyframes slideUp {
            from { opacity:0; transform:translateY(30px); }
            to   { opacity:1; transform:translateY(0); }
          }
        `}</style>

        {/* Close button */}
        <button
          onClick={closePricing}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <X size={15} weight="bold" />
        </button>

        {/* Header */}
        <div className="pt-10 pb-8 text-center px-6">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
            {tab === 'personal' ? 'Upgrade your plan' : 'Plans for your team'}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-7">Start free. Upgrade when you need more.</p>

          {/* Tabs */}
          <div className="inline-flex items-center bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full p-1 mb-5">
            {['personal', 'business'].map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); if (t === 'business') setAnnual(false) }}
                className={`px-5 py-1.5 rounded-full text-sm font-semibold capitalize transition-all ${
                  tab === t
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Annual toggle */}
          {tab === 'personal' && (
            <div className="flex items-center justify-center gap-3">
              <span className={`text-sm font-medium ${!annual ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>Monthly</span>
              <button
                onClick={() => setAnnual(o => !o)}
                className={`relative w-10 h-5 rounded-full transition-colors ${annual ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${annual ? 'translate-x-5' : ''}`} />
              </button>
              <span className={`text-sm font-medium flex items-center gap-1.5 ${annual ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                Annual
                <span className="bg-green-100 dark:bg-green-900/60 text-green-700 dark:text-green-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">Save 25%</span>
              </span>
            </div>
          )}
        </div>

        {/* Plan cards */}
        <div className="px-6 pb-8">
          <div className={`grid gap-3 ${plans.length === 4 ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-3'}`}>
            {plans.map(plan => (
              <PlanCard key={plan.id} plan={plan} annual={annual} onUpgrade={setPaying} />
            ))}
          </div>
        </div>

        {/* Footer note */}
        <div className="border-t border-gray-100 dark:border-gray-800 px-6 py-4 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            No credit card required for the free plan. Cancel anytime.
            <button onClick={closePricing} className="ml-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white underline transition-colors">
              Continue with Free
            </button>
          </p>
        </div>
      </div>

      {/* Payment modal — renders on top of pricing modal */}
      {paying && (
        <PaymentModal plan={paying} onClose={() => setPaying(null)} />
      )}
    </div>
  )
}
