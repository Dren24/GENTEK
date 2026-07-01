// ── PricingPage — full /pricing page with plan cards + comparison table ────────
// Dark-themed page (bg-gray-950) intentionally different from the rest of the
// app — matches a "landing" aesthetic for plan selection.
// Data imported from src/data/plans.js (same source as PricingModal).

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, X, ArrowRight, ArrowLeft, Star, Lightning } from '@phosphor-icons/react'
import { PLANS, COMPARISON } from '../data/plans'

// ── Cell — renders a comparison table cell value ───────────────────────────────
// true → blue check, false → gray X, string → the text itself
function Cell({ val }) {
  if (val === true)  return <Check size={17} weight="bold" className="text-blue-500 mx-auto" />
  if (val === false) return <X     size={15} weight="bold" className="text-gray-300 dark:text-gray-600 mx-auto" />
  return <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">{val}</span>
}

// ── PlanCard — one plan column on the PricingPage ─────────────────────────────
// Dark variant (gray-800/gray-900) — page-level dark bg makes these stand out.
function PlanCard({ plan, annual }) {
  // ── Price — apply annual discount to premium plan only ──────────────────
  const price = plan.price === 0 ? 0 : annual ? plan.annualPrice : plan.price

  return (
    <div className={`
      relative flex flex-col rounded-2xl p-7 h-full
      ${plan.featured
        ? 'bg-gray-800 border-2 border-blue-500 shadow-2xl'
        : 'bg-gray-900 border border-gray-700'}
    `}>
      {/* "MOST POPULAR" floating badge — above card top edge */}
      {plan.badge && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full tracking-wider">
            <Star size={9} weight="fill" /> {plan.badge}
          </span>
        </div>
      )}

      {/* ── Plan name + price ────────────────────────────────────────────── */}
      <div className="mb-6">
        {/* Plan name label — "FREE" or "PREMIUM" */}
        <p className={`text-xs font-bold uppercase tracking-widest mb-1.5 ${plan.featured ? 'text-blue-400' : 'text-gray-500'}`}>
          {plan.name}
        </p>

        {/* Price display — "Free /forever" for free, "₱599 /month" for premium */}
        {plan.price === 0 ? (
          <div className="flex items-end gap-1.5 mb-1">
            <span className="text-5xl font-extrabold text-white">Free</span>
            <span className="text-gray-400 text-sm mb-1.5">/forever</span>
          </div>
        ) : (
          <>
            <div className="flex items-end gap-1.5 mb-1">
              <span className="text-5xl font-extrabold text-white">₱{price.toLocaleString()}</span>
              <span className="text-gray-400 text-sm mb-1.5">/month</span>
            </div>
            {/* Annual saving notice — only when annual toggle is on */}
            {annual && (
              <p className="text-[11px] text-green-400 font-semibold mb-1">
                Billed annually — save ₱{((plan.price - plan.annualPrice) * 12).toLocaleString()}/yr
              </p>
            )}
          </>
        )}

        {/* Plan tagline description */}
        <p className="text-gray-400 text-sm leading-relaxed">{plan.desc}</p>
      </div>

      {/* ── CTA button — links to home editor ───────────────────────────── */}
      {plan.ctaStyle === 'primary' ? (
        // Premium — solid blue button with arrow
        <Link
          to="/"
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors mb-6 flex items-center justify-center gap-1.5"
        >
          {plan.cta} <ArrowRight size={13} weight="bold" />
        </Link>
      ) : (
        // Free — ghost border button
        <Link
          to="/"
          className="w-full py-3 rounded-xl text-sm font-semibold transition-colors mb-6 border border-gray-600 text-gray-300 hover:bg-gray-800 flex items-center justify-center"
        >
          {plan.cta}
        </Link>
      )}

      {/* Divider between CTA and benefits */}
      <div className="border-t border-gray-700 mb-5" />

      {/* ── Benefits list ─────────────────────────────────────────────────── */}
      <ul className="space-y-3.5 flex-1">
        {plan.benefits.map(b => (
          <li key={b.label} className="flex items-start gap-3">
            {/* Check — blue for premium, gray for free */}
            <Check size={14} weight="bold" className={`flex-shrink-0 mt-0.5 ${plan.featured ? 'text-blue-400' : 'text-gray-500'}`} />
            <div>
              <span className="text-sm text-gray-200 font-medium">{b.label}</span>
              {/* Optional sub-note in muted text */}
              {b.note && <span className="block text-xs text-gray-500 mt-0.5">{b.note}</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ════════════════════════ PRICING PAGE ═══════════════════════════════════════
export default function PricingPage() {
  const [annual, setAnnual] = useState(false)
  const navigate            = useNavigate()

  return (
    <main className="pt-14 min-h-screen bg-gray-950">

      {/* Back button — top-left of page */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors group"
        >
          <ArrowLeft size={15} weight="bold" className="group-hover:-translate-x-0.5 transition-transform" />
          Back
        </button>
      </div>

      {/* ── Hero — page title + monthly/annual toggle ─────────────────────── */}
      <section className="py-14 text-center">
        <div className="max-w-xl mx-auto px-4">
          {/* "Simple pricing" badge pill */}
          <div className="inline-flex items-center gap-1.5 bg-blue-900/30 text-blue-400 text-xs font-bold px-3 py-1 rounded-full mb-4">
            <Lightning size={11} weight="fill" />
            Simple pricing
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">Free or Premium.<br />You decide.</h1>
          <p className="text-gray-400 text-base mb-8">
            Start free today. Upgrade whenever you need the full power of GENTEK.
          </p>

          {/* ── Monthly / Annual toggle ─────────────────────────────────── */}
          <div className="flex items-center justify-center gap-3">
            {/* Monthly text — highlighted when not annual */}
            <button
              onClick={() => setAnnual(false)}
              className={`text-sm font-medium transition-colors ${!annual ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Monthly
            </button>
            {/* Toggle pill */}
            <button
              onClick={() => setAnnual(o => !o)}
              className={`relative w-11 h-6 rounded-full transition-colors ${annual ? 'bg-blue-600' : 'bg-gray-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${annual ? 'translate-x-5' : ''}`} />
            </button>
            {/* Annual text — highlighted when annual, with "Save 25%" green badge */}
            <button
              onClick={() => setAnnual(true)}
              className={`text-sm font-medium flex items-center gap-1.5 transition-colors ${annual ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Annual
              <span className="bg-green-900/60 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full">Save 25%</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Plan cards — Free and Premium side by side ────────────────────── */}
      <section className="pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="grid sm:grid-cols-2 gap-5 items-stretch">
            {PLANS.map(plan => (
              <PlanCard key={plan.id} plan={plan} annual={annual} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison table — full feature breakdown Free vs Premium ──────── */}
      <section className="py-16 bg-gray-900 border-t border-gray-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-white text-center mb-10">Full Feature Comparison</h2>
          <div className="rounded-2xl overflow-hidden border border-gray-700">
            <table className="w-full">
              {/* Table header row — Feature | Free | Premium */}
              <thead>
                <tr className="bg-gray-800 border-b border-gray-700">
                  <th className="text-left px-5 py-4 text-sm font-semibold text-gray-300 w-1/2">Feature</th>
                  <th className="text-center px-5 py-4 text-sm font-semibold text-gray-400">Free</th>
                  <th className="text-center px-5 py-4 text-sm font-semibold text-blue-400">Premium</th>
                </tr>
              </thead>
              {/* Table body — alternating gray rows from COMPARISON data */}
              <tbody className="divide-y divide-gray-800">
                {COMPARISON.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-900/60'}>
                    <td className="px-5 py-3.5 text-sm text-gray-300">{row.label}</td>
                    <td className="px-5 py-3.5 text-center"><Cell val={row.free} /></td>
                    <td className="px-5 py-3.5 text-center"><Cell val={row.premium} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA — "Try GENTEK Free" links back to home editor ──────── */}
      <section className="py-16 text-center bg-gray-950 border-t border-gray-800">
        <div className="max-w-xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-white mb-3">Ready to get started?</h2>
          <p className="text-gray-400 mb-7 text-base">
            The free plan is available right now. No credit card required.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl px-6 py-3 transition-colors"
          >
            Try GENTEK Free <ArrowRight size={15} weight="bold" />
          </Link>
        </div>
      </section>
    </main>
  )
}
