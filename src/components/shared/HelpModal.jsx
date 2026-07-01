// ── HelpModal — About GENTEK popup ───────────────────────────────────────────
// Triggered by the Help button in AppSidebar footer (both expanded and collapsed).
// Renders the About page content in a scrollable modal so users don't leave
// the workspace. Sticky header stays visible while scrolling through sections.

import { X, Target, Eye, Lightbulb, Globe, Users, ArrowRight } from '@phosphor-icons/react'
import { GentekMark } from './GentekLogo'

export default function HelpModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      {/* ── Backdrop — click anywhere outside to close ───────────────────── */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* ── Modal panel — max 90vh, scrollable body ──────────────────────── */}
      <div className="relative bg-white dark:bg-gray-950 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* ── Sticky header — logo + title + close button ──────────────────── */}
        <div className="sticky top-0 bg-white dark:bg-gray-950 z-10 flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <GentekMark size={26} />
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">About GENTEK</h2>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">AI-Powered Gender Bias Detector</p>
            </div>
          </div>
          {/* Close X button */}
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        <div className="px-6 py-6 space-y-7">

          {/* ── Intro paragraph ─────────────────────────────────────────────── */}
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            GENTEK is an AI-powered writing tool that uses Natural Language Processing to detect gender-biased language in written text and help writers communicate more inclusively — for everyone.
          </p>

          {/* ── Mission & Vision cards ────────────────────────────────────── */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Mission card */}
            <div className="p-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
              <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center mb-3">
                <Target size={18} weight="duotone" className="text-brand-600" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Our Mission</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                To build an accessible, AI-driven tool that empowers students, professionals, writers, and organizations to identify and eliminate gender-biased language from their written communication.
              </p>
            </div>
            {/* Vision card */}
            <div className="p-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                <Eye size={18} weight="duotone" className="text-blue-600" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Our Vision</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                A world where written communication is free from gender bias — where all individuals are represented fairly regardless of gender, in academic, professional, and everyday contexts.
              </p>
            </div>
          </div>

          {/* ── Product feature tiles ─────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">The Product</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: null,      bg: 'bg-brand-50 dark:bg-brand-900/30', label: 'NLP-Powered Analysis' },
                { icon: Lightbulb, bg: 'bg-blue-50 dark:bg-blue-900/30',   label: 'Smart Suggestions',   color: 'text-blue-600' },
                { icon: Globe,     bg: 'bg-green-50 dark:bg-green-900/30', label: 'English Text Support', color: 'text-green-600' },
                { icon: Target,    bg: 'bg-rose-50 dark:bg-rose-900/30',   label: 'Gender Bias Focus',    color: 'text-rose-600' },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="flex items-center gap-2.5 p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
                    <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0`}>
                      {Icon ? <Icon size={15} weight="duotone" className={item.color} /> : <GentekMark size={18} />}
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{item.label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Quick stats table ─────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Quick Stats</p>
            <div className="rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              {[
                { label: 'Bias Patterns',    value: '19+ detected' },
                { label: 'Classifications',   value: 'Male, Female, Stereotype' },
                { label: 'Language Support',  value: 'English' },
                { label: 'Analysis Speed',    value: 'Real-time' },
                { label: 'Free Plan',         value: 'Available — no card needed' },
              ].map((row, i, arr) => (
                <div key={row.label} className={`flex justify-between items-center px-4 py-3 text-xs ${i < arr.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}>
                  <span className="text-gray-400 dark:text-gray-500">{row.label}</span>
                  <span className="text-gray-700 dark:text-gray-200 font-medium">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Who It's For — four audience tiles ───────────────────────── */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Who It's For</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Users,  label: 'Students',    desc: 'Essays, thesis papers, and academic work.',  bg: 'bg-brand-50 dark:bg-brand-900/30', color: 'text-brand-600' },
                { icon: null,   label: 'HR Teams',    desc: 'Inclusive job postings for diverse hiring.', bg: 'bg-blue-50 dark:bg-blue-900/30',   color: 'text-blue-600' },
                { icon: Target, label: 'Writers',     desc: 'Blogs, journalism, and balanced content.',   bg: 'bg-rose-50 dark:bg-rose-900/30',   color: 'text-rose-600' },
                { icon: Globe,  label: 'Researchers', desc: 'Objective papers, surveys, publications.',   bg: 'bg-green-50 dark:bg-green-900/30', color: 'text-green-600' },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                    <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center mb-2`}>
                      {Icon ? <Icon size={16} weight="duotone" className={item.color} /> : <GentekMark size={20} />}
                    </div>
                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200 mb-0.5">{item.label}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">{item.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── CTA — closes modal and returns user to the editor ─────────── */}
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Start analyzing <ArrowRight size={14} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  )
}
