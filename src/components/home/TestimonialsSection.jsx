import { Star, Quotes } from '@phosphor-icons/react'

const testimonials = [
  {
    name: 'Maria Santos',
    role: 'Thesis Student, Communication Arts',
    avatar: 'MS',
    color: 'from-brand-500 to-brand-700',
    stars: 5,
    quote:
      'GENTEK helped me review my thesis for gender bias before submission. It flagged terms like "lady doctor" and "bossy" that I never noticed — the female-bias detection was especially eye-opening.',
  },
  {
    name: 'Andrea Villanueva',
    role: 'HR Director, Talent & Inclusion',
    avatar: 'AV',
    color: 'from-rose-500 to-rose-700',
    stars: 5,
    quote:
      'We run all job postings through GENTEK before publishing. It caught female-biased language like "nurturing" in role descriptions that we didn\'t realize were limiting our applicant pool.',
  },
  {
    name: 'Lorraine Quizon',
    role: 'Content Writer & Blogger',
    avatar: 'LQ',
    color: 'from-purple-500 to-purple-700',
    stars: 5,
    quote:
      'As a content creator I always want my writing to feel fair. GENTEK detects both male and female bias — it caught "housewife" in a piece I was sure was inclusive. Really useful tool.',
  },
]

export default function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14 reveal">
          <p className="section-label mb-3">Testimonials</p>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Trusted by Students,<br />
            <span className="text-gradient">Writers, and Professionals</span>
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            See how GENTEK is helping people write more fairly and inclusively.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div key={t.name} className={`reveal reveal-delay-${i + 1} card card-hover p-6 flex flex-col gap-4`}>
              {/* Stars */}
              <div className="flex items-center gap-0.5">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star key={j} size={14} weight="fill" className="text-amber-400" />
                ))}
              </div>

              {/* Quote */}
              <div className="relative flex-1">
                <Quotes size={28} weight="fill" className="text-brand-100 absolute -top-1 -left-1" />
                <p className="text-sm text-gray-600 leading-relaxed relative z-10 pl-4 pt-1">
                  {t.quote}
                </p>
              </div>

              {/* Author */}
              <div className="flex items-center gap-3 pt-2 border-t border-gray-50">
                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
