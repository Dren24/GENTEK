import { ArrowRight } from '@phosphor-icons/react'
import { BrainIcon } from './shared/GentekLogo'

const footerLinks = {
  Product: [
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Features', href: '#features' },
    { label: 'Live Analyzer', href: '#analyzer' },
    { label: 'Pricing', href: '#pricing' },
  ],
  Learn: [
    { label: 'Bias Categories', href: '#bias-categories' },
    { label: 'Use Cases', href: '#use-cases' },
    { label: 'About Project', href: '#about' },
    { label: 'Contact', href: '#contact' },
  ],
}

export default function Footer() {
  return (
    <footer className="bg-navy-950 border-t border-white/[0.05]">
      {/* CTA banner */}
      <div className="border-b border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/10 to-cyan-600/5 p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Start writing without bias today.
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
                GENTEK is free to try. No account required. Paste your text and get results in seconds.
              </p>
            </div>
            <a
              href="#analyzer"
              className="flex-shrink-0 inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all duration-200 hover:shadow-xl hover:shadow-violet-500/30 active:scale-95"
            >
              Try GENTEK Free
              <ArrowRight size={15} weight="bold" />
            </a>
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand col */}
          <div className="col-span-2 md:col-span-2">
            {/* Logo */}
            <a href="#" className="inline-flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <span className="text-white font-bold text-sm">G</span>
              </div>
              <span className="text-white font-bold text-xl tracking-tight">
                GEN<span className="text-violet-400">TEK</span>
              </span>
            </a>

            <p className="text-slate-500 text-sm leading-relaxed max-w-xs mb-5">
              An AI-powered gender bias detection platform using Natural Language Processing — built for writers, teams, and organizations.
            </p>

            <div className="flex items-center gap-2 p-3 rounded-xl border border-white/[0.06] bg-navy-800/40 inline-flex w-fit">
              <BrainIcon size={14} color="#a78bfa" faceColor="#1e1b4b" />
              <span className="text-xs text-slate-400">
                Powered by NLP and Machine Learning
              </span>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group}>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
                {group}
              </div>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-slate-500 hover:text-white transition-colors duration-200"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-slate-600 text-xs">
            &copy; 2026 GENTEK. All rights reserved.
          </p>
          <p className="text-slate-600 text-xs">
            AI-powered inclusive writing for everyone.
          </p>
        </div>
      </div>
    </footer>
  )
}
