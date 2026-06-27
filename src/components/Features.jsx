import {
  MagnifyingGlass,
  Tag,
  Highlighter,
  Lightbulb,
  FileText,
  ShieldCheck,
} from '@phosphor-icons/react'

const features = [
  {
    icon: MagnifyingGlass,
    title: 'Real-time Bias Detection',
    description:
      'Instantly scan any text for gender-biased words, phrases, and structural patterns using a trained NLP model.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/15',
    size: 'large',
  },
  {
    icon: Tag,
    title: 'Text Classification',
    description:
      'Classify your content into Male-Biased, Female-Biased, or Gender-Neutral with confidence scores.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/15',
    size: 'small',
  },
  {
    icon: Highlighter,
    title: 'Visual Word Highlighting',
    description:
      'Biased terms are highlighted inline so you can see exactly where the problem words appear.',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/15',
    size: 'small',
  },
  {
    icon: Lightbulb,
    title: 'Smart Suggestions',
    description:
      'Get AI-generated inclusive alternatives for every flagged word or phrase.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/15',
    size: 'small',
  },
  {
    icon: FileText,
    title: 'Bias Report',
    description:
      'Generate a complete analysis report with bias scores, category breakdown, and a full list of suggestions.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/15',
    size: 'small',
  },
  {
    icon: ShieldCheck,
    title: 'English Language Support',
    description:
      'Optimized for English text across essays, academic articles, job ads, reports, and social media.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/15',
    size: 'small',
  },
]

function FeatureCard({ feature, delay }) {
  const Icon = feature.icon
  const isLarge = feature.size === 'large'

  return (
    <div
      className={`reveal reveal-delay-${delay} group rounded-2xl border ${feature.border} bg-navy-800/60 hover:bg-navy-700/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30 p-6 flex flex-col gap-4 ${
        isLarge ? 'md:col-span-2 md:row-span-1' : ''
      }`}
    >
      <div className={`w-12 h-12 rounded-xl ${feature.bg} border ${feature.border} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
        <Icon size={24} weight="duotone" className={feature.color} />
      </div>

      <div>
        <h3 className={`font-bold text-white mb-2 ${isLarge ? 'text-xl' : 'text-base'}`}>
          {feature.title}
        </h3>
        <p className={`text-slate-400 leading-relaxed ${isLarge ? 'text-base max-w-lg' : 'text-sm'}`}>
          {feature.description}
        </p>
      </div>

      {isLarge && (
        <div className="mt-auto">
          <div className={`inline-flex items-center gap-2 text-sm font-semibold ${feature.color}`}>
            <span>Core capability</span>
            <div className={`w-1.5 h-1.5 rounded-full ${feature.bg} border ${feature.border} bg-current`} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function Features() {
  return (
    <section id="features" className="py-24 bg-navy-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 reveal">
          <h2 className="text-4xl font-bold text-white tracking-tight mb-4">
            Everything You Need to Write{' '}
            <span className="text-gradient">Without Bias</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl leading-relaxed">
            GENTEK combines multiple layers of analysis to give you the most thorough gender bias assessment available.
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid md:grid-cols-3 gap-5">
          {/* Row 1: large + small */}
          <FeatureCard feature={features[0]} delay={1} />
          <FeatureCard feature={features[1]} delay={2} />

          {/* Row 2: three smalls */}
          <FeatureCard feature={features[2]} delay={1} />
          <FeatureCard feature={features[3]} delay={2} />
          <FeatureCard feature={features[4]} delay={3} />
          <FeatureCard feature={features[5]} delay={4} />
        </div>
      </div>
    </section>
  )
}
