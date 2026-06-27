import { GraduationCap, Briefcase, PenNib, Flask } from '@phosphor-icons/react'

const useCases = [
  {
    icon: GraduationCap,
    title: 'Students',
    subtitle: 'Academic Writing',
    description:
      'Ensure your essays, research papers, and academic reports use inclusive, bias-free language before submission.',
    examples: ['Research papers', 'Thesis documents', 'Essay assignments', 'Literature reviews'],
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/15',
    image: 'https://picsum.photos/seed/student-academic-library/600/400',
  },
  {
    icon: Briefcase,
    title: 'Employers',
    subtitle: 'HR and Recruitment',
    description:
      'Review job advertisements to attract diverse talent by ensuring postings use gender-inclusive language.',
    examples: ['Job advertisements', 'HR policies', 'Performance reviews', 'Company announcements'],
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/15',
    image: 'https://picsum.photos/seed/office-professional-workplace/600/400',
  },
  {
    icon: PenNib,
    title: 'Writers',
    subtitle: 'Content and Media',
    description:
      'Produce fair, balanced, and respectful written content for blogs, journalism, books, and online media.',
    examples: ['Blog articles', 'News reports', 'Social media content', 'Press releases'],
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/15',
    image: 'https://picsum.photos/seed/writer-content-creator/600/400',
  },
  {
    icon: Flask,
    title: 'Researchers',
    subtitle: 'Academic and Scientific',
    description:
      'Maintain objectivity and neutrality in research papers, surveys, and scientific publications.',
    examples: ['Journal articles', 'Survey instruments', 'Research proposals', 'Grant applications'],
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/15',
    image: 'https://picsum.photos/seed/researcher-laboratory-data/600/400',
  },
]

export default function UseCases() {
  return (
    <section id="use-cases" className="py-24 bg-navy-800/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14 reveal">
          <h2 className="text-4xl font-bold text-white tracking-tight mb-4">
            Built for <span className="text-gradient">Every Writer</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
            Whether you are a student, professional, or researcher, GENTEK fits your workflow.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {useCases.map((uc, i) => {
            const Icon = uc.icon
            return (
              <div
                key={uc.title}
                className={`reveal reveal-delay-${i + 1} group rounded-2xl border ${uc.border} bg-navy-800/60 hover:bg-navy-700/60 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-black/30 overflow-hidden flex flex-col`}
              >
                {/* Image */}
                <div className="relative h-40 overflow-hidden">
                  <img
                    src={uc.image}
                    alt={`${uc.title} use case`}
                    className="w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity duration-300 group-hover:scale-105"
                    style={{ transition: 'transform 0.4s ease, opacity 0.3s ease' }}
                  />
                  <div className={`absolute inset-0 bg-gradient-to-t from-navy-800 via-navy-800/60 to-transparent`} />
                  <div className={`absolute bottom-3 left-3 w-9 h-9 rounded-xl ${uc.bg} border ${uc.border} flex items-center justify-center`}>
                    <Icon size={18} weight="duotone" className={uc.color} />
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 flex flex-col flex-1">
                  <div className="mb-3">
                    <div className={`text-xs font-semibold ${uc.color} mb-1 uppercase tracking-widest`}>
                      {uc.subtitle}
                    </div>
                    <h3 className="text-base font-bold text-white">{uc.title}</h3>
                  </div>

                  <p className="text-slate-400 text-sm leading-relaxed mb-4">{uc.description}</p>

                  <div className="mt-auto space-y-1.5">
                    {uc.examples.map((ex) => (
                      <div key={ex} className="flex items-center gap-2">
                        <div className={`w-1 h-1 rounded-full ${uc.bg} ${uc.color} flex-shrink-0`}
                          style={{ background: 'currentColor', width: 4, height: 4 }} />
                        <span className="text-xs text-slate-500">{ex}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
