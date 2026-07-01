// ── Footer ────────────────────────────────────────────────────────────────────
// Shown only to guests (returns null for logged-in users — sidebar replaces it).
// Three sections: CTA strip (brand-colored top band), main grid, bottom bar.

import { Link } from 'react-router-dom'
import { ArrowRight, GithubLogo, TwitterLogo, LinkedinLogo } from '@phosphor-icons/react'
import { GentekWordmark, BrainIcon } from './GentekLogo'
import { useAuth } from '../../context/AuthContext'

// ── Footer navigation columns ─────────────────────────────────────────────────
// All items use 'href' and render as <Link to> — hash links navigate to home
// then ScrollToTop in App.jsx scrolls to the target section.
const COLS = [
  {
    title: 'Product',
    items: [
      { label: 'Features',    href: '/#features'     },
      { label: 'How It Works',href: '/#how-it-works' },
      { label: 'Pricing',     href: '/#pricing'      },
      { label: 'FAQ',         href: '/#faq'          },
    ],
  },
  {
    title: 'Company',
    items: [
      { label: 'About',   href: '/about'   },
      { label: 'Contact', href: '/contact' },
    ],
  },
]

export default function Footer() {
  const { user } = useAuth()

  // ── Hidden for logged-in users (they use the sidebar instead) ────────────
  if (user) return null

  return (
    <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">

      {/* ── CTA strip — brand-colored band with "Try Free" button ───────── */}
      <div className="bg-brand-600 dark:bg-brand-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-5">
          <div>
            <p className="text-white font-bold text-xl mb-1">Start writing without bias.</p>
            <p className="text-brand-200 text-sm">No account needed. Paste your text and get results instantly.</p>
          </div>
          {/* Navigate to homepage CTA */}
          <Link
            to="/"
            className="flex-shrink-0 inline-flex items-center gap-2 bg-white text-brand-700 font-bold rounded-xl px-6 py-3 text-sm hover:bg-brand-50 transition-colors shadow-lg active:scale-95"
          >
            Try GENTEK Free
            <ArrowRight size={15} weight="bold" />
          </Link>
        </div>
      </div>

      {/* ── Main footer grid — brand column + link columns ───────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">

          {/* Brand column — logo, tagline, NLP badge */}
          <div className="col-span-2 md:col-span-2">
            <div className="mb-4">
              <GentekWordmark size={34} textSize="text-base" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-5 max-w-xs">
              AI-powered gender bias detection using Natural Language Processing. Write fairly, communicate inclusively.
            </p>
            {/* NLP badge */}
            <div className="flex items-center gap-2">
              <BrainIcon size={13} color="#0D9488" faceColor="white" />
              <span className="text-xs text-gray-400 dark:text-gray-500">Powered by NLP & Machine Learning</span>
            </div>
          </div>

          {/* Product and Company link columns */}
          {COLS.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">{col.title}</p>
              <ul className="space-y-2.5">
                {col.items.map((item) => (
                  <li key={item.label}>
                    <Link to={item.href} className="text-sm text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom bar — copyright + social icons ─────────────────────────── */}
      <div className="border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            &copy; 2026 GENTEK. All rights reserved. AI-powered inclusive writing for everyone.
          </p>
          {/* Social icon links */}
          <div className="flex items-center gap-3">
            <a href="#" className="text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"><GithubLogo size={16} /></a>
            <a href="#" className="text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"><TwitterLogo size={16} /></a>
            <a href="#" className="text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"><LinkedinLogo size={16} /></a>
          </div>
        </div>
      </div>
    </footer>
  )
}
