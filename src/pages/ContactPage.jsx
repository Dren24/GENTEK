// ── ContactPage — contact form + info sidebar ─────────────────────────────────
// Two-column layout: left (2/5) has email, location, social links, quick links;
// right (3/5) has the contact form or a success screen after submit.
// Form submit is simulated with setTimeout — no real backend endpoint yet.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EnvelopeSimple, MapPin, GithubLogo, TwitterLogo, LinkedinLogo, ArrowRight, CheckCircle } from '@phosphor-icons/react'

export default function ContactPage() {
  const [form, setForm]     = useState({ name: '', email: '', subject: '', message: '' })
  const [sent, setSent]     = useState(false)
  const [loading, setLoading] = useState(false)

  // ── Controlled form field update handler ─────────────────────────────────
  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  // ── handleSubmit — simulates a 1.4s "sending" state then shows success ───
  function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => { setLoading(false); setSent(true) }, 1400)
  }

  return (
    <main className="pt-16 bg-white dark:bg-gray-950">
      {/* ── Hero section — page title ──────────────────────────────────────── */}
      <section className="py-20 bg-hero-gradient text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 reveal">
          <p className="section-label mb-3">Contact Us</p>
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            We&rsquo;d Love to <span className="text-gradient">Hear from You</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg max-w-xl mx-auto">
            Have a question, feedback, or partnership inquiry? Reach out and we&rsquo;ll get back to you.
          </p>
        </div>
      </section>

      {/* ── Main content — info sidebar + form ───────────────────────────── */}
      <section className="py-20 bg-white dark:bg-gray-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-12 items-start">

            {/* ── Left sidebar — contact info, social links, quick links ──── */}
            <div className="lg:col-span-2 space-y-6 reveal">
              <div className="card p-6 space-y-5">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Get in Touch</h2>

                {/* Email address row */}
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <EnvelopeSimple size={18} weight="duotone" className="text-brand-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-0.5">Email</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">support@gentek.ai</p>
                  </div>
                </div>

                {/* Location row */}
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin size={18} weight="duotone" className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-0.5">Location</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">Remote — Available Worldwide</p>
                  </div>
                </div>
              </div>

              {/* Social media links — GitHub, Twitter, LinkedIn */}
              <div className="card p-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Follow GENTEK</h3>
                <div className="flex flex-col gap-3">
                  {[
                    { icon: GithubLogo,   label: 'GitHub',   handle: '@gentek-nlp',    color: 'text-gray-700 dark:text-gray-300', bg: 'bg-gray-50 dark:bg-gray-700' },
                    { icon: TwitterLogo,  label: 'Twitter',  handle: '@gentekproject', color: 'text-sky-600',                     bg: 'bg-sky-50 dark:bg-sky-900/30' },
                    { icon: LinkedinLogo, label: 'LinkedIn', handle: 'GENTEK Research',color: 'text-blue-700',                    bg: 'bg-blue-50 dark:bg-blue-900/30' },
                  ].map(({ icon: Icon, label, handle, color, bg }) => (
                    <div key={label} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer group">
                      <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon size={18} weight="fill" className={color} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{handle}</p>
                      </div>
                      {/* Arrow reveals on hover */}
                      <ArrowRight size={14} className="text-gray-300 dark:text-gray-600 group-hover:text-brand-500 ml-auto transition-colors" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick page links — detector, pricing, about */}
              <div className="card p-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Quick Links</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Try the Detector', to: '/'         },
                    { label: 'View Pricing',     to: '/#pricing' },
                    { label: 'About GENTEK',     to: '/about'    },
                  ].map((l) => (
                    <Link
                      key={l.label}
                      to={l.to}
                      className="flex items-center justify-between py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors group"
                    >
                      {l.label}
                      <ArrowRight size={13} className="text-gray-300 group-hover:text-brand-500 transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Right column — contact form or success message ─────────── */}
            <div className="lg:col-span-3 reveal reveal-delay-2">
              {sent ? (
                // ── Success screen — shown after form is submitted ─────────
                <div className="card p-10 text-center flex flex-col items-center gap-4">
                  {/* Green checkmark circle */}
                  <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle size={32} weight="duotone" className="text-green-500" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Message Sent!</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs leading-relaxed">
                    Thank you for reaching out. The GENTEK team will review your message and get back to you soon.
                  </p>
                  {/* Reset form and allow sending another */}
                  <button
                    onClick={() => { setSent(false); setForm({ name: '', email: '', subject: '', message: '' }) }}
                    className="btn-outline mt-2"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                // ── Contact form — name, email, subject dropdown, message ──
                <form onSubmit={handleSubmit} className="card p-8 space-y-5">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Send a Message</h2>

                  {/* Name + Email side by side on sm+ */}
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Your Name</label>
                      <input
                        type="text"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        required
                        placeholder="Juan dela Cruz"
                        className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Email Address</label>
                      <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        required
                        placeholder="you@example.com"
                        className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition"
                      />
                    </div>
                  </div>

                  {/* Subject dropdown */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Subject</label>
                    <select
                      name="subject"
                      value={form.subject}
                      onChange={handleChange}
                      required
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition appearance-none"
                    >
                      <option value="" disabled>Select a subject…</option>
                      <option value="general">General Inquiry</option>
                      <option value="partnership">Partnership / Collaboration</option>
                      <option value="feedback">Feedback / Suggestions</option>
                      <option value="bug">Bug Report</option>
                      <option value="enterprise">Enterprise / Team Plan</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Message textarea — 6 rows */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Message</label>
                    <textarea
                      name="message"
                      value={form.message}
                      onChange={handleChange}
                      required
                      rows={6}
                      placeholder="Write your message here…"
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition resize-none"
                    />
                  </div>

                  {/* Submit button — spinner shown during loading state */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Sending…
                      </span>
                    ) : (
                      <>
                        Send Message
                        <ArrowRight size={15} weight="bold" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
