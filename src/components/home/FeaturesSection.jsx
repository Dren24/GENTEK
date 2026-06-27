import { MagnifyingGlass, Tag, Highlighter, Lightbulb, FileText, ShieldCheck } from '@phosphor-icons/react'

const features = [
  {
    icon: MagnifyingGlass,
    title: 'Real-time Bias Detection',
    desc: 'Instantly identify gender-biased words, phrases, and structural patterns in any text using a trained NLP model.',
    color: 'text-brand-600',
    bg: 'bg-brand-50',
  },
  {
    icon: Tag,
    title: 'Text Classification',
    desc: 'Get a clear verdict: Male-Biased, Female-Biased, or Gender-Neutral, with a confidence score for each analysis.',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    icon: Highlighter,
    title: 'Visual Word Highlighting',
    desc: 'Biased terms are highlighted inline in your text so you can see exactly where the problem words appear.',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
  },
  {
    icon: Lightbulb,
    title: 'Smart Suggestions',
    desc: 'Receive AI-generated inclusive alternatives for every flagged word or phrase, ranked by relevance.',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    icon: FileText,
    title: 'Bias Report',
    desc: 'Generate a complete analysis report with bias scores, category breakdown, and a full list of suggestions.',
    color: 'text-teal-600',
    bg: 'bg-teal-50',
  },
  {
    icon: ShieldCheck,
    title: 'English Text Support',
    desc: 'Optimized for English text across essays, academic articles, job advertisements, reports, and social media.',
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
]

export default function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14 reveal">
          <p className="section-label mb-3">Features</p>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Everything You Need to Write<br />
            <span className="text-gradient">Without Bias</span>
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto leading-relaxed">
            GENTEK combines multiple layers of NLP analysis to give you the most thorough gender bias assessment available.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                className={`reveal reveal-delay-${(i % 3) + 1} card card-hover p-6 flex flex-col gap-4`}
              >
                <div className={`w-11 h-11 rounded-xl ${f.bg} flex items-center justify-center`}>
                  <Icon size={22} weight="duotone" className={f.color} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1.5">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
