// ── PaymentModal — pay for Premium with a card or PayPal ─────────────────────
// Stacks on top of PricingModal at z-70. Shows only PayPal's "Debit or
// Credit Card" button (fundingSource CARD); the card form is PayPal's, inside
// PayPal's frame, so GENTEK never sees or stores card numbers.
//
// Flow (server side is backend/payments.py):
//   open → GET /payments/config (public client ID, prices, test/live mode)
//        → load PayPal's script → render buttons
//   click → createOrder → POST /payments/orders {plan}  (server sets the price)
//   paid  → onApprove   → POST /payments/orders/{id}/capture
//        → server confirms the money with PayPal and turns Premium on
//        → applyPlan(new plan fields) → SuccessScreen
// Premium is one-time: 30 days (monthly) or 365 days (annual), no auto-renew.

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { X, CheckCircle, SpinnerGap, Warning, LockSimple, Info } from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'

// ── loadPayPal — adds PayPal's script once and resolves with window.paypal ────
let sdkPromise = null
let sdkUrl = null
function loadPayPal(clientId, currency) {
  const url = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}`
    + `&currency=${currency}&intent=capture&components=buttons&disable-funding=paylater,venmo`
  if (sdkPromise && sdkUrl === url) return sdkPromise
  sdkUrl = url
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = url
    script.async = true
    script.dataset.namespace = 'paypal'
    script.onload = () => window.paypal ? resolve(window.paypal) : reject(new Error('PayPal failed to load'))
    script.onerror = () => { sdkPromise = null; script.remove(); reject(new Error('PayPal failed to load')) }
    document.head.appendChild(script)
  })
  return sdkPromise
}

const peso = (amount) => `₱${Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

// ── SuccessScreen — shown after the server confirmed the payment ──────────────
function SuccessScreen({ premiumUntil, testMode, onDone }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
      <div className="w-20 h-20 rounded-full bg-green-50 dark:bg-green-900/30 border-2 border-green-500 flex items-center justify-center">
        <CheckCircle size={40} weight="fill" className="text-green-500 dark:text-green-400" />
      </div>
      <div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">You're Premium!</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs">
          Payment received{testMode ? ' (test mode — no real money)' : ''}. Unlimited analyses, advanced detection and full history are unlocked now.
        </p>
      </div>
      <div className="w-full bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-left space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-gray-500">Status</span><span className="font-medium text-green-600 dark:text-green-400">Active</span></div>
        {premiumUntil && (
          <div className="flex justify-between"><span className="text-gray-500">Premium until</span><span className="font-medium text-gray-900 dark:text-white">{formatDate(premiumUntil)}</span></div>
        )}
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">A receipt was sent to your email.</p>
      <button
        onClick={onDone}
        className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition-colors"
      >
        Got it — Back to GENTEK
      </button>
    </div>
  )
}

// ════════════════════════ PAYMENT MODAL ══════════════════════════════════════
export default function PaymentModal({ plan, annual = false, onClose, onUpgraded }) {
  const { user, authHeader, applyPlan, logout } = useAuth()
  const [billing, setBilling] = useState(annual ? 'annual' : 'monthly')
  const [config, setConfig]   = useState(null)       // /payments/config response
  const [status, setStatus]   = useState('loading')  // loading | ready | unavailable
  const [busy, setBusy]       = useState(false)      // capturing the payment
  const [error, setError]     = useState('')
  const [notice, setNotice]   = useState('')
  const [done, setDone]       = useState(null)       // plan fields after success

  const buttonsRef = useRef(null)
  // PayPal keeps the callbacks it was rendered with — read live values via refs
  const billingRef = useRef(billing); billingRef.current = billing
  const headerRef  = useRef(authHeader); headerRef.current = authHeader
  const lastErrRef = useRef('')

  // ── Load prices + client ID, then PayPal's script ───────────────────────────
  useEffect(() => {
    let alive = true
    fetch('/payments/config')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(cfg => {
        if (!alive) return
        setConfig(cfg)
        if (!cfg.enabled) { setStatus('unavailable'); return }
        return loadPayPal(cfg.client_id, cfg.currency).then(() => alive && setStatus('ready'))
      })
      .catch(() => alive && setStatus('unavailable'))
    return () => { alive = false }
  }, [])

  // ── Render PayPal's buttons (again when the billing period changes) ────────
  useEffect(() => {
    if (status !== 'ready' || !user || done || !buttonsRef.current || !window.paypal) return
    const fail = (msg) => { lastErrRef.current = msg; throw new Error(msg) }

    const buttons = window.paypal.Buttons({
      fundingSource: window.paypal.FUNDING.CARD,   // card only — no "Pay with PayPal" button
      style: { layout: 'vertical', shape: 'rect', height: 44 },

      createOrder: async () => {
        setError(''); setNotice(''); lastErrRef.current = ''
        const res = await fetch('/payments/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headerRef.current() },
          body: JSON.stringify({ plan: billingRef.current }),
        })
        if (res.status === 401) { logout(); fail('Your session expired. Please log in again.') }
        const data = await res.json().catch(() => ({}))
        if (!res.ok) fail(data.detail || "Couldn't start the payment. Please try again.")
        return data.id
      },

      onApprove: async (data, actions) => {
        setBusy(true)
        try {
          const res = await fetch(`/payments/orders/${encodeURIComponent(data.orderID)}/capture`, {
            method: 'POST',
            headers: headerRef.current(),
          })
          const body = await res.json().catch(() => ({}))
          // Card declined → reopen PayPal's window so the buyer can use another card
          if (res.status === 402 && body.detail === 'INSTRUMENT_DECLINED') {
            setNotice('That card was declined. Please try another card or payment method.')
            return actions.restart()
          }
          if (!res.ok) { setError(body.detail || "The payment couldn't be confirmed. Please contact us."); return }
          applyPlan(body)
          setDone(body)
        } catch {
          setError("We couldn't confirm the payment because the connection dropped. If you were charged, refresh the page — Premium turns on once PayPal confirms it.")
        } finally {
          setBusy(false)
        }
      },

      onCancel: () => setNotice("Payment cancelled — you weren't charged."),
      onError: () => setError(lastErrRef.current || 'PayPal ran into a problem. Please try again.'),
    })

    const el = buttonsRef.current
    el.innerHTML = ''
    // PayPal decides per buyer/browser whether card payment is offered
    if (buttons.isEligible && !buttons.isEligible()) {
      setError("Card payment isn't available in this browser right now. Please try another browser or device.")
      return
    }
    buttons.render(el).catch(() => { /* modal closed mid-render */ })
    return () => { try { buttons.close() } catch { /* already gone */ } }
  }, [status, user?.id, billing, done])

  // ── Close on Escape ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  if (!plan) return null

  const planInfo = config?.plans?.[billing]
  const amount = planInfo?.amount ?? (billing === 'annual' ? plan.annualPrice * 12 : plan.price)
  const testMode = config?.mode === 'sandbox'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !busy && onClose?.()} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-title"
        className="relative w-full max-w-sm max-h-full flex flex-col rounded-2xl overflow-hidden shadow-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800"
        style={{ animation: 'slideUp 0.25s cubic-bezier(0.16,1,0.3,1)' }}
      >
        <button
          onClick={onClose}
          disabled={busy}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors disabled:opacity-50"
        >
          <X size={14} weight="bold" />
        </button>

        <div className="p-6 overflow-y-auto overscroll-contain">
          {done ? (
            <SuccessScreen premiumUntil={done.premium_until} testMode={testMode} onDone={onUpgraded || onClose} />
          ) : (
            <>
              {/* ── Header — plan + price ───────────────────────────────────── */}
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Upgrade to</p>
              <h2 id="payment-title" className="text-xl font-bold text-gray-900 dark:text-white pr-10">{plan.name}</h2>
              <p className="text-3xl font-extrabold text-gray-900 dark:text-white mt-1">
                {peso(amount)}
                <span className="text-sm font-normal text-gray-400 ml-1">{billing === 'annual' ? 'for 1 year' : 'for 1 month'}</span>
              </p>

              {/* ── Monthly / Annual ────────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-1 p-1 mt-4 rounded-xl bg-gray-100 dark:bg-gray-800" role="radiogroup" aria-label="Billing period">
                {['monthly', 'annual'].map(b => (
                  <button
                    key={b}
                    role="radio"
                    aria-checked={billing === b}
                    disabled={busy}
                    onClick={() => setBilling(b)}
                    className={`py-2 rounded-lg text-xs font-semibold transition-colors ${billing === b
                      ? 'bg-white dark:bg-gray-950 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}
                  >
                    {b === 'monthly' ? '1 month' : '1 year · save 25%'}
                  </button>
                ))}
              </div>

              <p className="flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-3">
                <Info size={14} className="flex-shrink-0 mt-px" />
                One-time payment. Premium lasts {billing === 'annual' ? '365' : '30'} days and does not renew automatically.
              </p>

              {testMode && status === 'ready' && (
                <p className="mt-3 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
                  <strong>Test mode</strong> — no real money is charged. Use a test card from PayPal's sandbox Credit Card Generator.
                </p>
              )}

              {/* ── Messages ────────────────────────────────────────────────── */}
              {error && (
                <p role="alert" className="mt-3 flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl px-3 py-2">
                  <Warning size={14} className="flex-shrink-0 mt-px" />{error}
                </p>
              )}
              {notice && !error && (
                <p role="status" className="mt-3 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2">{notice}</p>
              )}

              {/* ── Payment buttons ─────────────────────────────────────────── */}
              <div className="mt-4">
                {!user ? (
                  <p className="text-sm text-center text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-5">
                    Please log in or create an account first, so Premium can be added to it.
                  </p>
                ) : status === 'loading' ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500 dark:text-gray-400">
                    <SpinnerGap size={16} className="animate-spin" /> Loading secure checkout…
                  </div>
                ) : status === 'unavailable' ? (
                  <p className="text-sm text-center text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-5">
                    Payments aren't available right now. Please try again later.
                  </p>
                ) : (
                  <div className="relative">
                    {/* PayPal's card button sits on white in both themes (the button is black) */}
                    <div ref={buttonsRef} className={`rounded-xl bg-white p-3 min-h-[72px] ${busy ? 'opacity-40 pointer-events-none' : ''}`} />
                    {busy && (
                      <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                        <SpinnerGap size={16} className="animate-spin" /> Confirming payment…
                      </div>
                    )}
                  </div>
                )}
              </div>

              <p className="flex items-start gap-1.5 text-[11px] text-gray-400 dark:text-gray-500 mt-4 leading-relaxed">
                <LockSimple size={13} className="flex-shrink-0 mt-px" />
                <span>
                  Card payments are processed securely by PayPal. GENTEK never sees or stores your card details.
                  See our <Link to="/terms#payments" onClick={onClose} className="underline hover:text-gray-600 dark:hover:text-gray-300">payment &amp; refund terms</Link>.
                </span>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
