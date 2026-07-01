// ── PricingModal — upgrade popup (Free vs Premium) ────────────────────────────
// Triggered by: sidebar "Upgrade →" button, Navbar Gift icon, and in-editor
// word-limit nudge. Renders over everything at z-60.
// Plan data lives in src/data/plans.js so PricingPage stays in sync.

import { useState } from 'react'
import { X, Check, Lightning, Star, ArrowRight } from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import PaymentModal from './PaymentModal'
import { PLANS } from '../../data/plans'

// ── PlanCard — renders one Free or Premium plan column ────────────────────────
// Featured (Premium) uses blue-tinted light bg in light mode, dark bg in dark mode.
function PlanCard({ plan, annual, onUpgrade }) {
  // ── Price calculation — apply 25% annual discount to Premium only ─────────
  const price = plan.price === 0 ? 0 : annual ? plan.annualPrice : plan.price

  return (
    <div className={`
      relative flex flex-col rounded-2xl p-5 transition-all h-full
      ${plan.featured
        ? 'bg-blue-50 dark:bg-gray-800 border-2 border-blue-500 shadow-2xl'
        : 'bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700'}
    `}>
      {/* ── "MOST POPULAR" badge — positioned above the card top edge ──────── */}
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full tracking-wider whitespace-nowrap">
            <Star size={9} weight="fill" />
            {plan.badge}
          </span>
        </div>
      )}

      {/* ── Plan name + price block ──────────────────────────────────────── */}
      <div className="mb-5">
        {/* Plan label — "FREE" or "PREMIUM" in small caps */}
        <p className={`text-xs font-bold uppercase tracking-widest mb-1.5 ${plan.featured ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
          {plan.name}
        </p>

        {/* Price display — "Free /forever" for free plan, "₱599 /month" for premium */}
        {plan.price === 0 ? (
          <div className="flex items-end gap-1 mb-1">
            <span className="text-4xl font-extrabold text-gray-900 dark:text-white">Free</span>
            <span className="text-gray-400 dark:text-gray-500 text-sm mb-1">/forever</span>
          </div>
        ) : (
          <>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-extrabold text-gray-900 dark:text-white">₱{price.toLocaleString()}</span>
              <span className="text-gray-500 dark:text-gray-400 text-sm mb-1">/month</span>
            </div>
            {/* Annual savings note — only visible when annual toggle is on */}
            {annual && (
              <p className="text-[11px] text-green-600 dark:text-green-400 font-semibold mb-1">
                Billed annually — save ₱{((plan.price - plan.annualPrice) * 12).toLocaleString()}/yr
              </p>
            )}
          </>
        )}

        {/* Plan description tagline */}
        <p className={`text-xs leading-relaxed ${plan.featured ? 'text-gray-600 dark:text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>{plan.desc}</p>
      </div>

      {/* ── CTA button ───────────────────────────────────────────────────── */}
      {plan.ctaStyle === 'primary' ? (
        // Premium upgrade button — opens PaymentModal
        <button
          onClick={() => onUpgrade(plan)}
          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors mb-5 flex items-center justify-center gap-1.5"
        >
          {plan.cta} <ArrowRight size={13} weight="bold" />
        </button>
      ) : (
        // Free plan "Your current plan" — non-interactive ghost button
        <button className="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors mb-5 border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-default">
          {plan.cta}
        </button>
      )}

      {/* ── Divider between CTA and benefits list ────────────────────────── */}
      <div className={`border-t mb-4 ${plan.featured ? 'border-blue-200 dark:border-gray-700' : 'border-gray-200 dark:border-gray-700'}`} />

      {/* ── Benefits list ─────────────────────────────────────────────────── */}
      <ul className="space-y-3 flex-1">
        {plan.benefits.map(b => (
          <li key={b.label} className="flex items-start gap-2.5">
            {/* Check mark — blue for premium, gray for free */}
            <Check
              size={13}
              weight="bold"
              className={`flex-shrink-0 mt-0.5 ${plan.featured ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}
            />
            <div>
              {/* Benefit label */}
              <span className={`text-xs font-medium ${plan.featured ? 'text-gray-800 dark:text-gray-200' : 'text-gray-700 dark:text-gray-300'}`}>
                {b.label}
              </span>
              {/* Optional sub-note in smaller text */}
              {b.note && (
                <span className={`block text-[11px] ${plan.featured ? 'text-gray-500 dark:text-gray-500' : 'text-gray-400 dark:text-gray-500'}`}>
                  {b.note}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ════════════════════════ PRICING MODAL ══════════════════════════════════════
export default function PricingModal() {
  const { pricingOpen, closePricing } = useAuth()
  const [annual, setAnnual]   = useState(false)   // monthly vs annual toggle
  const [paying, setPaying]   = useState(null)    // plan object passed to PaymentModal

  // ── Hidden when pricingOpen is false ─────────────────────────────────────
  if (!pricingOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto py-6 px-4">
      {/* Backdrop — click to close */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={closePricing} />

      {/* ── Modal panel — slides up on open ──────────────────────────────── */}
      <div
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800"
        style={{ animation: 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)' }}
      >
        <style>{`
          @keyframes slideUp {
            from { opacity:0; transform:translateY(30px); }
            to   { opacity:1; transform:translateY(0); }
          }
        `}</style>

        {/* Close X button — top-right corner */}
        <button
          onClick={closePricing}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors"
        >
          <X size={15} weight="bold" />
        </button>

        {/* ── Modal header — title + annual/monthly toggle ─────────────────── */}
        <div className="pt-10 pb-6 text-center px-6">
          {/* "Upgrade GENTEK" badge pill */}
          <div className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-bold px-3 py-1 rounded-full mb-3">
            <Lightning size={11} weight="fill" />
            Upgrade GENTEK
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Simple, honest pricing</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Start free. Upgrade for unlimited power.</p>

          {/* ── Monthly / Annual billing toggle ──────────────────────────── */}
          <div className="flex items-center justify-center gap-3">
            <span className={`text-sm font-medium ${!annual ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>Monthly</span>
            {/* Toggle switch */}
            <button
              onClick={() => setAnnual(o => !o)}
              className={`relative w-10 h-5 rounded-full transition-colors ${annual ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${annual ? 'translate-x-5' : ''}`} />
            </button>
            <span className={`text-sm font-medium flex items-center gap-1.5 ${annual ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
              Annual
              {/* "Save 25%" green badge */}
              <span className="bg-green-100 dark:bg-green-900/60 text-green-700 dark:text-green-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                Save 25%
              </span>
            </span>
          </div>
        </div>

        {/* ── Plan cards — Free and Premium side by side ───────────────────── */}
        <div className="px-6 pb-6">
          <div className="grid sm:grid-cols-2 gap-4 items-stretch">
            {PLANS.map(plan => (
              <PlanCard key={plan.id} plan={plan} annual={annual} onUpgrade={setPaying} />
            ))}
          </div>
        </div>

        {/* ── Footer note — reassurance for free plan users ─────────────────── */}
        <div className="border-t border-gray-100 dark:border-gray-800 px-6 py-4 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            No credit card required for the free plan. Cancel Premium anytime.
            {/* Skip upgrade link */}
            <button onClick={closePricing} className="ml-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white underline transition-colors">
              Continue with Free
            </button>
          </p>
        </div>
      </div>

      {/* ── PaymentModal — opens on top of PricingModal when user clicks upgrade ── */}
      {paying && <PaymentModal plan={paying} onClose={() => setPaying(null)} />}
    </div>
  )
}
