import { User, UserFocus, Scales } from '@phosphor-icons/react'

const categories = [
  {
    icon: User,
    label: 'Male-Biased',
    color: 'text-blue-300',
    accent: 'text-blue-400',
    bg: 'bg-blue-600/10',
    border: 'border-blue-500/20',
    glow: 'hover:shadow-blue-500/10',
    badge: 'bg-blue-600/20 border-blue-500/30 text-blue-300',
    description:
      'Text that favors male perspectives, uses male-generic nouns, or reinforces masculine stereotypes.',
    examples: ['chairman', 'manpower', 'businessman', 'mankind', 'policeman'],
    replacements: ['chairperson', 'workforce', 'professional', 'humankind', 'police officer'],
    sample:
      'The chairman of the board approved the expansion. Manpower is the company\'s biggest asset.',
  },
  {
    icon: UserFocus,
    label: 'Female-Biased',
    color: 'text-rose-300',
    accent: 'text-rose-400',
    bg: 'bg-rose-600/10',
    border: 'border-rose-500/20',
    glow: 'hover:shadow-rose-500/10',
    badge: 'bg-rose-600/20 border-rose-500/30 text-rose-300',
    description:
      'Text that uses female-specific role labels, reinforces feminine stereotypes, or applies gendered modifiers unnecessarily.',
    examples: ['stewardess', 'housewife', 'lady doctor', 'girl boss', 'spinster'],
    replacements: ['flight attendant', 'homemaker', 'doctor', 'leader', 'unmarried person'],
    sample:
      'The new team leader was called bossy and hysterical. The lady doctor on call responded quickly. Our stewardess welcomed every passenger.',
  },
  {
    icon: Scales,
    label: 'Gender-Neutral',
    color: 'text-emerald-300',
    accent: 'text-emerald-400',
    bg: 'bg-emerald-600/10',
    border: 'border-emerald-500/20',
    glow: 'hover:shadow-emerald-500/10',
    badge: 'bg-emerald-600/20 border-emerald-500/30 text-emerald-300',
    description:
      'Text that uses inclusive, non-gendered language that treats all genders fairly and equally.',
    examples: ['chair', 'workforce', 'professional', 'humankind', 'police officer'],
    replacements: ['Already inclusive'],
    sample:
      'The chair of the board approved the expansion. The workforce is the company\'s biggest asset.',
  },
]

export default function BiasCategories() {
  return (
    <section id="bias-categories" className="py-24 bg-navy-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14 reveal">
          <h2 className="text-4xl font-bold text-white tracking-tight mb-4">
            Three Bias <span className="text-gradient">Classifications</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
            GENTEK assigns every piece of text one of three categories based on the patterns it detects.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {categories.map((cat, i) => {
            const Icon = cat.icon
            return (
              <div
                key={cat.label}
                className={`reveal reveal-delay-${i + 1} group rounded-2xl border ${cat.border} bg-navy-800/60 hover:bg-navy-700/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${cat.glow} overflow-hidden`}
              >
                {/* Card header */}
                <div className={`p-5 border-b ${cat.border} flex items-center gap-3`}>
                  <div className={`w-10 h-10 rounded-xl ${cat.bg} border ${cat.border} flex items-center justify-center`}>
                    <Icon size={20} weight="duotone" className={cat.accent} />
                  </div>
                  <span className={`font-bold text-base px-3 py-1 rounded-full border ${cat.badge}`}>
                    {cat.label}
                  </span>
                </div>

                <div className="p-5 space-y-5">
                  {/* Description */}
                  <p className="text-slate-400 text-sm leading-relaxed">{cat.description}</p>

                  {/* Sample text */}
                  <div className={`p-3 rounded-lg ${cat.bg} border ${cat.border} text-sm italic ${cat.color} leading-relaxed`}>
                    "{cat.sample}"
                  </div>

                  {/* Biased terms */}
                  {cat.label !== 'Gender-Neutral' && (
                    <div>
                      <div className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-widest">Common terms</div>
                      <div className="flex flex-wrap gap-1.5">
                        {cat.examples.map((ex) => (
                          <span
                            key={ex}
                            className={`text-xs px-2 py-1 rounded-lg border ${cat.border} ${cat.bg} ${cat.color}`}
                          >
                            {ex}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {cat.label === 'Gender-Neutral' && (
                    <div>
                      <div className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-widest">Inclusive terms</div>
                      <div className="flex flex-wrap gap-1.5">
                        {cat.examples.map((ex) => (
                          <span
                            key={ex}
                            className={`text-xs px-2 py-1 rounded-lg border ${cat.border} ${cat.bg} ${cat.color}`}
                          >
                            {ex}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
