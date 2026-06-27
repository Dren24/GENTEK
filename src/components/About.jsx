import { Users, Target, BookOpen, Globe } from '@phosphor-icons/react'

const highlights = [
  {
    icon: Target,
    title: 'Our Goal',
    description:
      'Build an AI-powered system that helps writers, students, and professionals identify and eliminate gender-biased language using Natural Language Processing.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/15',
  },
  {
    icon: BookOpen,
    title: 'Why It Matters',
    description:
      'Gender bias in text reinforces stereotypes and contributes to unequal treatment. GENTEK addresses this using machine learning models trained on curated bias datasets.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/15',
  },
  {
    icon: Globe,
    title: 'Built for Everyone',
    description:
      'From students to HR teams, content writers to researchers — GENTEK is designed to fit any writing workflow and make inclusive language accessible to all.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/15',
  },
]

export default function About() {
  return (
    <section id="about" className="py-24 bg-navy-800/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-14 reveal">
          <h2 className="text-4xl font-bold text-white tracking-tight mb-4">
            About <span className="text-gradient">GENTEK</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl leading-relaxed">
            An AI-powered platform built to promote fair and inclusive communication through NLP-driven language analysis.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-start">
          {/* Left - Project info */}
          <div className="space-y-5">
            {/* Image */}
            <div className="relative rounded-2xl overflow-hidden reveal">
              <img
                src="https://picsum.photos/seed/inclusive-writing-ai-tech/800/450"
                alt="AI-powered inclusive writing with GENTEK"
                className="w-full object-cover h-56 opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-800/90 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="glass-violet rounded-xl px-4 py-3 inline-flex items-center gap-2">
                  <Globe size={16} className="text-violet-400" weight="duotone" />
                  <div>
                    <div className="text-white text-xs font-bold">GENTEK — AI Gender Bias Detector</div>
                    <div className="text-slate-400 text-[11px]">Writing inclusively, powered by NLP</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Highlights grid */}
            <div className="space-y-4">
              {highlights.map((h, i) => {
                const Icon = h.icon
                return (
                  <div
                    key={h.title}
                    className={`reveal reveal-delay-${i + 1} flex gap-4 p-4 rounded-xl border ${h.border} bg-navy-800/60`}
                  >
                    <div className={`w-10 h-10 rounded-xl ${h.bg} border ${h.border} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={18} weight="duotone" className={h.color} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white mb-1">{h.title}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">{h.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right - Product stats */}
          <div className="reveal reveal-delay-2">
            {/* Core stats */}
            <div className="mb-5 grid grid-cols-2 gap-4">
              {[
                { value: '19+', label: 'Bias Patterns', color: 'text-violet-400' },
                { value: '3',   label: 'Classifications', color: 'text-cyan-400' },
                { value: '100%', label: 'Browser-based', color: 'text-emerald-400' },
                { value: 'Free', label: 'To Get Started', color: 'text-amber-400' },
              ].map((s) => (
                <div key={s.label} className="p-4 rounded-2xl border border-white/[0.06] bg-navy-800/60 text-center">
                  <div className={`text-2xl font-bold ${s.color} mb-0.5`}>{s.value}</div>
                  <div className="text-xs text-slate-500">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Team */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-4">
                <Users size={16} className="text-slate-400" />
                <span className="text-sm font-semibold text-slate-300">Built By</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                GENTEK is built by a team of AI and NLP engineers dedicated to making inclusive language accessible for everyone — from individual writers to organizations.
              </p>
            </div>

            {/* Product details */}
            <div className="p-5 rounded-2xl border border-white/[0.06] bg-navy-800/40 space-y-3">
              <h4 className="text-sm font-bold text-white">Product Details</h4>
              {[
                { label: 'Technology',      value: 'AI / NLP / Machine Learning' },
                { label: 'Language',        value: 'English' },
                { label: 'Bias Types',      value: 'Male, Female, Stereotype' },
                { label: 'Privacy',         value: 'No text stored or shared' },
                { label: 'Free Plan',       value: 'Available — no card needed' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{item.label}</span>
                  <span className="text-slate-300 font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
