import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, X, ArrowRight, ArrowLeft, Lightning, Clock } from '@phosphor-icons/react'

/* ── Personal plans ── */
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

/* ── Business plans ── */
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

const allFeatures = [
  { label: 'Analyses per month',       free: '200',          pro: 'Unlimited'    },
  { label: 'Bias detection accuracy',  free: 'Basic',        pro: 'Advanced'     },
  { label: 'Classification types',     free: '3 categories', pro: 'All types'    },
  { label: 'Suggestions per analysis', free: '3',            pro: 'Unlimited'    },
  { label: 'Visual word highlighting', free: true,           pro: true           },
  { label: 'Bias score indicator',     free: true,           pro: true           },
  { label: 'Export results',           free: false,          pro: true           },
  { label: 'Analysis history',         free: false,          pro: true           },
  { label: 'Detailed bias report',     free: false,          pro: true           },
  { label: 'Priority processing',      free: false,          pro: true           },
  { label: 'API access',               free: false,          pro: true           },
  { label: 'Email support',            free: false,          pro: true           },
]

function Cell({ val }) {
  if (val === true)  return <Check size={17} weight="bold" className="text-brand-600 mx-auto" />
  if (val === false) return <X     size={15} weight="bold" className="text-gray-300 dark:text-gray-600 mx-auto" />
  return <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">{val}</span>
}

function PlanCard({ plan, annual }) {
  const displayPrice = plan.customPrice
    ? null
    : annual && plan.price > 0
      ? Math.round(plan.price * 0.75).toLocaleString()
      : (plan.price ?? 0).toLocaleString()

  return (
    <div className={`
      relative flex flex-col rounded-2xl p-6 transition-all
      ${plan.featured
        ? 'bg-gray-800 dark:bg-gray-800 border-2 border-blue-500 shadow-2xl'
        : 'bg-gray-900 dark:bg-gray-900 border border-gray-700 dark:border-gray-700'}
    `}>
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 bg-gray-600 text-gray-200 text-[10px] font-bold px-3 py-1 rounded-full tracking-wider">
            <Clock size={10} weight="fill" />
            {plan.badge}
          </span>
        </div>
      )}

      <div className="mb-5">
        <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>

        {/* Price */}
        {plan.customPrice ? (
          <div className="mb-3">
            <span className="text-3xl font-extrabold text-white">Usage pricing</span>
          </div>
        ) : (
          <div className="flex items-end gap-1.5 mb-1">
            {plan.originalPrice && (
              <span className="text-xl font-bold text-gray-500 line-through">
                ₱{plan.originalPrice}
              </span>
            )}
            <span className="text-4xl font-extrabold text-white">
              {plan.price === 0 ? '₱0' : `₱${displayPrice}`}
            </span>
            {plan.price > 0 && (
              <span className="text-gray-400 text-sm mb-1">{plan.period}</span>
            )}
            {plan.price === 0 && (
              <span className="text-gray-400 text-sm mb-1">/month</span>
            )}
          </div>
        )}

        {plan.promoNote && (
          <p className="text-blue-400 text-xs font-semibold mb-1">{plan.promoNote}</p>
        )}
        <p className="text-gray-400 text-sm leading-relaxed">{plan.desc}</p>
      </div>

      {/* CTA */}
      {plan.ctaStyle === 'primary' ? (
        <button className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors mb-5">
          {plan.cta}
        </button>
      ) : (
        <button className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors mb-5 border ${
          plan.id === 'free'
            ? 'border-gray-600 text-gray-300 hover:bg-gray-800'
            : 'border-gray-500 text-gray-200 hover:bg-gray-800'
        }`}>
          {plan.cta}
        </button>
      )}

      {/* Features */}
      <ul className="space-y-2.5 mt-auto">
        {plan.features.map(f => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
            <Check size={14} weight="bold" className={`flex-shrink-0 mt-0.5 ${plan.featured ? 'text-blue-400' : 'text-gray-500'}`} />
            {f}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function PricingPage() {
  const [tab, setTab]       = useState('personal')
  const [annual, setAnnual] = useState(false)
  const navigate            = useNavigate()
  const plans = tab === 'personal' ? PERSONAL_PLANS : BUSINESS_PLANS

  return (
    <main className="pt-14 min-h-screen bg-gray-950">

      {/* Back button */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors group"
        >
          <ArrowLeft size={15} weight="bold" className="group-hover:-translate-x-0.5 transition-transform" />
          Back
        </button>
      </div>

      {/* Hero */}
      <section className="py-12 text-center">
        <div className="max-w-xl mx-auto px-4">
          <h1 className="text-4xl font-bold text-white mb-2">
            {tab === 'personal' ? 'Upgrade your plan' : 'Plans for your team'}
          </h1>
          <p className="text-gray-400 text-base mb-8">
            Start free. Upgrade when you need more.
          </p>

          {/* Personal / Business tabs */}
          <div className="inline-flex items-center bg-gray-800 border border-gray-700 rounded-full p-1 mb-6">
            {['personal', 'business'].map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); if (t === 'business') setAnnual(false) }}
                className={`px-6 py-2 rounded-full text-sm font-semibold capitalize transition-all ${
                  tab === t
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Annual toggle (personal only) */}
          {tab === 'personal' && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setAnnual(false)}
                className={`text-sm font-medium transition-colors ${!annual ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setAnnual(o => !o)}
                className={`relative w-11 h-6 rounded-full transition-colors ${annual ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${annual ? 'translate-x-5' : ''}`} />
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${annual ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Annual
                <span className="bg-green-900/60 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Save 25%
                </span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Plan cards */}
      <section className="pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`grid gap-4 ${plans.length === 4 ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
            {plans.map(plan => (
              <PlanCard key={plan.id} plan={plan} annual={annual} />
            ))}
          </div>
        </div>
      </section>

      {/* Comparison table (personal only) */}
      {tab === 'personal' && (
        <section className="py-16 bg-gray-900 border-t border-gray-800">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-white text-center mb-10">
              Full Feature Comparison
            </h2>
            <div className="rounded-2xl overflow-hidden border border-gray-700">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-800 border-b border-gray-700">
                    <th className="text-left px-5 py-3.5 text-sm font-semibold text-gray-300">Feature</th>
                    <th className="text-center px-5 py-3.5 text-sm font-semibold text-gray-400">Free</th>
                    <th className="text-center px-5 py-3.5 text-sm font-semibold text-blue-400">Pro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {allFeatures.map((row, i) => (
                    <tr key={row.label} className={i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-900/60'}>
                      <td className="px-5 py-3.5 text-sm text-gray-300">{row.label}</td>
                      <td className="px-5 py-3.5 text-center"><Cell val={row.free} /></td>
                      <td className="px-5 py-3.5 text-center"><Cell val={row.pro} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Bottom CTA */}
      <section className="py-16 text-center bg-gray-950 border-t border-gray-800">
        <div className="max-w-xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-white mb-3">
            Ready to get started?
          </h2>
          <p className="text-gray-400 mb-7 text-base">
            The free plan is available right now. No credit card required.
          </p>
          <Link to="/" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl px-6 py-3 transition-colors">
            Try GENTEK Free
            <ArrowRight size={15} weight="bold" />
          </Link>
        </div>
      </section>
    </main>
  )
}
