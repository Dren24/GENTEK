// ── PaymentModal — payment form for upgrading to Premium ──────────────────────
// Stacks on top of PricingModal at z-70. Four payment methods: GCash, Maya,
// Bank Transfer, Credit/Debit Card. After submit shows SuccessScreen.
// All payment details are UI-only — no real payment gateway is wired up yet.

import { useState } from 'react'
import {
  X, CheckCircle, CreditCard, Bank, Copy, ArrowRight,
  Check, UploadSimple, Warning,
} from '@phosphor-icons/react'

// ── Payment method tab definitions ────────────────────────────────────────────
const METHODS = [
  { id: 'gcash',    label: 'GCash',          color: '#0070BA' },
  { id: 'maya',     label: 'Maya',           color: '#38A169' },
  { id: 'bank',     label: 'Bank Transfer',  color: '#744210' },
  { id: 'card',     label: 'Card',           color: '#4F46E5' },
]

// ── Philippine bank options for the Bank Transfer form ────────────────────────
const BANKS = ['BDO', 'BPI', 'UnionBank', 'Metrobank', 'Security Bank', 'RCBC']

// ── GCashForm — QR/number send instructions for GCash e-wallet ───────────────
function GCashForm({ amount, name }) {
  const [copied, setCopied] = useState(false)
  const number = '0917-123-4567'
  const copy = () => { navigator.clipboard.writeText(number); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  return (
    <div className="space-y-4">
      {/* GCash brand strip */}
      <div className="flex items-center justify-center h-14 rounded-xl bg-[#0070BA]/10 border border-[#0070BA]/20">
        <span className="text-2xl font-black text-[#0070BA] tracking-tight">G<span className="text-white">Cash</span></span>
      </div>

      {/* Amount to send — user must match exactly */}
      <div className="bg-gray-800 rounded-xl p-4 text-center">
        <p className="text-xs text-gray-400 mb-1">Send exactly</p>
        <p className="text-3xl font-extrabold text-white">₱{amount.toLocaleString()}</p>
        <p className="text-xs text-gray-400 mt-1">for {name} plan</p>
      </div>

      {/* GCash number with copy-to-clipboard button */}
      <div>
        <p className="text-xs text-gray-400 mb-1.5">GCash Number</p>
        <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
          <span className="flex-1 text-white font-mono text-sm">{number}</span>
          {/* Copy icon — turns into green check on success */}
          <button onClick={copy} className="text-gray-400 hover:text-white transition-colors">
            {copied ? <Check size={15} weight="bold" className="text-green-400" /> : <Copy size={15} />}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1.5">Account Name: <span className="text-gray-300">GENTEK Inc.</span></p>
      </div>

      {/* Reference number input — user pastes their GCash ref */}
      <div>
        <p className="text-xs text-gray-400 mb-1.5">Reference / Transaction Number</p>
        <input
          placeholder="Paste your GCash reference number"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-[#0070BA] transition-colors"
        />
      </div>

      {/* Optional screenshot upload */}
      <label className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-dashed border-gray-600 hover:border-gray-400 cursor-pointer transition-colors">
        <UploadSimple size={16} className="text-gray-400" />
        <span className="text-sm text-gray-400">Upload screenshot (optional)</span>
      </label>

      {/* Verification time notice */}
      <p className="flex items-start gap-1.5 text-[11px] text-gray-500">
        <Warning size={12} className="mt-0.5 flex-shrink-0 text-amber-500" />
        Your plan activates within 5–15 minutes after verification.
      </p>
    </div>
  )
}

// ── MayaForm — same pattern as GCashForm but Maya-branded ─────────────────────
function MayaForm({ amount, name }) {
  const [copied, setCopied] = useState(false)
  const number = '0961-987-6543'
  const copy = () => { navigator.clipboard.writeText(number); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  return (
    <div className="space-y-4">
      {/* Maya brand strip */}
      <div className="flex items-center justify-center h-14 rounded-xl bg-[#38A169]/10 border border-[#38A169]/20">
        <span className="text-2xl font-black text-[#38A169]">maya</span>
      </div>
      <div className="bg-gray-800 rounded-xl p-4 text-center">
        <p className="text-xs text-gray-400 mb-1">Send exactly</p>
        <p className="text-3xl font-extrabold text-white">₱{amount.toLocaleString()}</p>
        <p className="text-xs text-gray-400 mt-1">for {name} plan</p>
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1.5">Maya Number</p>
        <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
          <span className="flex-1 text-white font-mono text-sm">{number}</span>
          <button onClick={copy} className="text-gray-400 hover:text-white transition-colors">
            {copied ? <Check size={15} weight="bold" className="text-green-400" /> : <Copy size={15} />}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1.5">Account Name: <span className="text-gray-300">GENTEK Inc.</span></p>
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1.5">Reference / Transaction Number</p>
        <input
          placeholder="Paste your Maya reference number"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-[#38A169] transition-colors"
        />
      </div>
      <label className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-dashed border-gray-600 hover:border-gray-400 cursor-pointer transition-colors">
        <UploadSimple size={16} className="text-gray-400" />
        <span className="text-sm text-gray-400">Upload screenshot (optional)</span>
      </label>
      <p className="flex items-start gap-1.5 text-[11px] text-gray-500">
        <Warning size={12} className="mt-0.5 flex-shrink-0 text-amber-500" />
        Your plan activates within 5–15 minutes after verification.
      </p>
    </div>
  )
}

// ── BankForm — PH bank transfer with selectable bank and account details ───────
function BankForm({ amount, name }) {
  const [bank, setBank] = useState('BDO')
  // Static account details per bank — update when live accounts are assigned
  const details = {
    BDO:           { account: '006-780-123456', type: 'Savings' },
    BPI:           { account: '1234-5678-90',   type: 'Savings' },
    UnionBank:     { account: '0123-4567-8901', type: 'Checking' },
    Metrobank:     { account: '012-3-45678901-2', type: 'Savings' },
    'Security Bank':{ account: '0000-1234-5678', type: 'Savings' },
    RCBC:          { account: '1234-5678-9012',  type: 'Savings' },
  }
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(details[bank].account); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  return (
    <div className="space-y-4">
      {/* Bank transfer brand strip */}
      <div className="flex items-center justify-center h-14 rounded-xl bg-amber-900/20 border border-amber-800/30">
        <Bank size={22} className="text-amber-400 mr-2" />
        <span className="text-base font-bold text-amber-300">Bank Transfer</span>
      </div>

      {/* Bank selector grid — 3 columns */}
      <div>
        <p className="text-xs text-gray-400 mb-1.5">Select your bank</p>
        <div className="grid grid-cols-3 gap-1.5">
          {BANKS.map(b => (
            <button
              key={b}
              onClick={() => setBank(b)}
              className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all border ${
                bank === b
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Account details table — updates when bank selection changes */}
      <div className="bg-gray-800 rounded-xl p-4 space-y-2.5">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Account Name</span>
          <span className="text-white font-medium">GENTEK Inc.</span>
        </div>
        <div className="flex justify-between text-sm items-center">
          <span className="text-gray-400">Account Number</span>
          <div className="flex items-center gap-2">
            <span className="text-white font-mono font-medium">{details[bank].account}</span>
            {/* Copy account number button */}
            <button onClick={copy} className="text-gray-400 hover:text-white">
              {copied ? <Check size={13} weight="bold" className="text-green-400" /> : <Copy size={13} />}
            </button>
          </div>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Account Type</span>
          <span className="text-white font-medium">{details[bank].type}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Amount</span>
          <span className="text-white font-bold">₱{amount.toLocaleString()}</span>
        </div>
      </div>

      {/* Reference / trace number input */}
      <div>
        <p className="text-xs text-gray-400 mb-1.5">Reference / Trace Number</p>
        <input
          placeholder="Enter bank reference number"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 transition-colors"
        />
      </div>
      {/* Optional deposit slip upload */}
      <label className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-dashed border-gray-600 hover:border-gray-400 cursor-pointer transition-colors">
        <UploadSimple size={16} className="text-gray-400" />
        <span className="text-sm text-gray-400">Upload deposit slip (optional)</span>
      </label>
      <p className="flex items-start gap-1.5 text-[11px] text-gray-500">
        <Warning size={12} className="mt-0.5 flex-shrink-0 text-amber-500" />
        Bank transfers may take 1–24 hours to verify on banking days.
      </p>
    </div>
  )
}

// ── CardForm — credit/debit card entry with 16-digit number formatting ─────────
function CardForm() {
  const [num, setNum] = useState('')
  // Format raw digits as groups of 4 (e.g. "1234 5678 9012 3456")
  const fmt = v => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
  return (
    <div className="space-y-4">
      {/* Card brand strip */}
      <div className="flex items-center justify-center h-14 rounded-xl bg-indigo-900/20 border border-indigo-800/30">
        <CreditCard size={22} className="text-indigo-400 mr-2" />
        <span className="text-base font-bold text-indigo-300">Credit / Debit Card</span>
      </div>
      {/* Card number field with auto-space formatting */}
      <div>
        <p className="text-xs text-gray-400 mb-1.5">Card Number</p>
        <input
          value={num}
          onChange={e => setNum(fmt(e.target.value))}
          placeholder="0000 0000 0000 0000"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition-colors font-mono tracking-widest"
        />
      </div>
      {/* Cardholder name — uppercase mirror of physical card */}
      <div>
        <p className="text-xs text-gray-400 mb-1.5">Cardholder Name</p>
        <input
          placeholder="Name as printed on card"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition-colors uppercase"
        />
      </div>
      {/* Expiry + CVV side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-400 mb-1.5">Expiry Date</p>
          <input
            placeholder="MM / YY"
            maxLength={7}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1.5">CVV</p>
          {/* Password type hides CVV digits visually */}
          <input
            placeholder="•••"
            maxLength={4}
            type="password"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>
      {/* SSL security notice */}
      <div className="flex items-center gap-2 text-[11px] text-gray-500 bg-gray-800/60 rounded-xl px-3 py-2.5">
        <span className="text-green-400">🔒</span>
        Secured by 256-bit SSL encryption. We never store your card details.
      </div>
    </div>
  )
}

// ── SuccessScreen — shown after user submits payment; replaces form ─────────────
function SuccessScreen({ plan, onClose }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
      {/* Green checkmark with confetti emoji overlay */}
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-green-900/30 border-2 border-green-500 flex items-center justify-center">
          <CheckCircle size={40} weight="fill" className="text-green-400" />
        </div>
        <div className="absolute -top-1 -right-1 text-xl">🎉</div>
      </div>
      <div>
        <h3 className="text-xl font-bold text-white mb-1">Payment Submitted!</h3>
        <p className="text-gray-400 text-sm max-w-xs">
          Your <span className="text-white font-semibold">{plan}</span> plan upgrade is being processed.
          We'll notify you once it's confirmed.
        </p>
      </div>
      {/* Status summary table */}
      <div className="w-full bg-gray-800 rounded-xl p-4 text-left space-y-2">
        {[
          { label: 'Status',    val: 'Pending verification',     color: 'text-amber-400' },
          { label: 'Plan',      val: plan,                       color: 'text-white'     },
          { label: 'Email',     val: 'Check your inbox',         color: 'text-gray-300'  },
        ].map(r => (
          <div key={r.label} className="flex justify-between text-sm">
            <span className="text-gray-500">{r.label}</span>
            <span className={`font-medium ${r.color}`}>{r.val}</span>
          </div>
        ))}
      </div>
      {/* Back to GENTEK — closes PaymentModal */}
      <button
        onClick={onClose}
        className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition-colors"
      >
        Got it — Back to GENTEK
      </button>
    </div>
  )
}

// ════════════════════════ PAYMENT MODAL ══════════════════════════════════════
export default function PaymentModal({ plan, onClose }) {
  const [method, setMethod] = useState('gcash')   // active payment method tab
  const [success, setSuccess] = useState(false)   // true after submit → show SuccessScreen

  if (!plan) return null

  // Active method's brand color — applied to Submit button background
  const methodColor = METHODS.find(m => m.id === method)?.color || '#3B82F6'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      {/* Backdrop — click to close */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* ── Modal panel — dark background (#0d1117 = GitHub-dark) ──────────── */}
      <div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#0d1117', animation: 'slideUp 0.25s cubic-bezier(0.16,1,0.3,1)' }}
      >
        {/* Close X button — top-right corner */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-7 h-7 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
        >
          <X size={13} weight="bold" />
        </button>

        <div className="p-6 max-h-[90vh] overflow-y-auto">
          {success ? (
            // ── Success screen replaces form after submit ──────────────────
            <SuccessScreen plan={plan.name} onClose={onClose} />
          ) : (
            <>
              {/* ── Header — plan name + price ───────────────────────────── */}
              <div className="mb-5">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Upgrade to</p>
                <h2 className="text-xl font-bold text-white">{plan.name} Plan</h2>
                <p className="text-2xl font-extrabold text-white mt-0.5">
                  ₱{plan.price.toLocaleString()}
                  <span className="text-sm font-normal text-gray-400 ml-1">{plan.period ?? '/month'}</span>
                </p>
              </div>

              {/* ── Payment method tabs — GCash / Maya / Bank / Card ─────── */}
              <div className="mb-5">
                <p className="text-xs text-gray-400 mb-2">Payment method</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {METHODS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setMethod(m.id)}
                      className={`py-2 px-1 rounded-xl text-[11px] font-semibold transition-all border ${
                        method === m.id
                          ? 'text-white border-transparent'
                          : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                      }`}
                      style={method === m.id ? { background: m.color, borderColor: m.color } : {}}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Active payment form — swaps based on selected method ─── */}
              <div className="mb-5">
                {method === 'gcash' && <GCashForm amount={plan.price} name={plan.name} />}
                {method === 'maya'  && <MayaForm  amount={plan.price} name={plan.name} />}
                {method === 'bank'  && <BankForm  amount={plan.price} name={plan.name} />}
                {method === 'card'  && <CardForm />}
              </div>

              {/* ── Submit button — color matches active payment method ───── */}
              <button
                onClick={() => setSuccess(true)}
                className="w-full py-3 rounded-xl text-white font-bold text-sm transition-all flex items-center justify-center gap-2 hover:opacity-90 active:scale-95"
                style={{ background: methodColor }}
              >
                {method === 'card' ? 'Pay Now' : 'Submit Payment'}
                <ArrowRight size={15} weight="bold" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
