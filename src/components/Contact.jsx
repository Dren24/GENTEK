import { useState } from 'react'
import { PaperPlaneTilt, Envelope, User, ChatText, CheckCircle } from '@phosphor-icons/react'

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setSubmitted(true)
    }, 1200)
  }

  const isValid = form.name.trim() && form.email.trim() && form.message.trim()

  return (
    <section id="contact" className="py-24 bg-navy-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-14 items-start">
          {/* Left - Copy */}
          <div className="reveal">
            <h2 className="text-4xl font-bold text-white tracking-tight mb-4">
              Get in <span className="text-gradient">Touch</span>
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed mb-10 max-w-md">
              Have questions about GENTEK, feedback on the project, or interest in collaborating? We would love to hear from you.
            </p>

            {/* Contact info cards */}
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-xl border border-violet-500/15 bg-violet-500/5">
                <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <Envelope size={18} weight="duotone" className="text-violet-400" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">Email</div>
                  <div className="text-sm text-slate-300 font-medium">support@gentek.ai</div>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-xl border border-cyan-500/15 bg-cyan-500/5">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <ChatText size={18} weight="duotone" className="text-cyan-400" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">Location</div>
                  <div className="text-sm text-slate-300 font-medium">Remote — Available Worldwide</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right - Form */}
          <div className="reveal reveal-delay-2">
            {submitted ? (
              <div className="flex flex-col items-center justify-center text-center py-16 px-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mb-5">
                  <CheckCircle size={32} weight="fill" className="text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Message Sent!</h3>
                <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
                  Thank you for reaching out. We will get back to you as soon as possible.
                </p>
                <button
                  onClick={() => { setSubmitted(false); setForm({ name: '', email: '', subject: '', message: '' }) }}
                  className="mt-6 px-5 py-2.5 rounded-lg border border-white/10 hover:border-violet-500/30 text-slate-300 hover:text-white text-sm font-medium transition-all"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="rounded-2xl border border-white/[0.08] bg-navy-800/60 p-7 space-y-5"
              >
                <div className="grid sm:grid-cols-2 gap-5">
                  {/* Name */}
                  <div>
                    <label htmlFor="name" className="block text-xs font-semibold text-slate-400 mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      <input
                        id="name"
                        name="name"
                        type="text"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Juan dela Cruz"
                        required
                        className="w-full pl-9 pr-4 py-3 rounded-xl bg-navy-900/60 border border-white/[0.08] text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-xs font-semibold text-slate-400 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Envelope size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      <input
                        id="email"
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="juan@email.com"
                        required
                        className="w-full pl-9 pr-4 py-3 rounded-xl bg-navy-900/60 border border-white/[0.08] text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label htmlFor="subject" className="block text-xs font-semibold text-slate-400 mb-2">
                    Subject
                  </label>
                  <input
                    id="subject"
                    name="subject"
                    type="text"
                    value={form.subject}
                    onChange={handleChange}
                    placeholder="Question about GENTEK..."
                    className="w-full px-4 py-3 rounded-xl bg-navy-900/60 border border-white/[0.08] text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all"
                  />
                </div>

                {/* Message */}
                <div>
                  <label htmlFor="message" className="block text-xs font-semibold text-slate-400 mb-2">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    value={form.message}
                    onChange={handleChange}
                    placeholder="Write your message here..."
                    required
                    className="w-full px-4 py-3 rounded-xl bg-navy-900/60 border border-white/[0.08] text-sm text-white placeholder-slate-600 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all leading-relaxed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!isValid || loading}
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all duration-200 hover:shadow-xl hover:shadow-violet-500/25 active:scale-[0.98]"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <PaperPlaneTilt size={16} weight="fill" />
                      Send Message
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
