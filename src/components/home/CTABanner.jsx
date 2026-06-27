import { Link } from 'react-router-dom'
import { ArrowRight } from '@phosphor-icons/react'

export default function CTABanner() {
  return (
    <section className="py-20 bg-brand-600 overflow-hidden relative">
      {/* Subtle pattern overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 50%, white 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center reveal">
        <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
          Start Writing Inclusively Today.
        </h2>
        <p className="text-brand-200 text-lg leading-relaxed max-w-xl mx-auto mb-8">
          Join students, writers, and professionals who use GENTEK to produce fair, gender-neutral content. Free to get started.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            to="/detector"
            className="inline-flex items-center gap-2 bg-white text-brand-700 font-bold rounded-full px-7 py-3.5 text-sm hover:bg-brand-50 transition-colors shadow-lg active:scale-95"
          >
            Try GENTEK Free
            <ArrowRight size={15} weight="bold" />
          </Link>
          <Link
            to="/about"
            className="inline-flex items-center gap-2 bg-brand-700/50 hover:bg-brand-700 text-white font-semibold rounded-full px-7 py-3.5 text-sm transition-colors active:scale-95"
          >
            Learn More
          </Link>
        </div>
      </div>
    </section>
  )
}
