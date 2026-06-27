import { Link } from 'react-router-dom'
import { Target, Eye, ArrowRight, Lightbulb, Globe, Users } from '@phosphor-icons/react'
import { GentekMark } from '../components/shared/GentekLogo'

export default function AboutPage() {
  return (
    <main className="pt-16 bg-white dark:bg-gray-950">

      {/* Hero */}
      <section className="py-20 bg-hero-gradient">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center reveal">
          <p className="section-label mb-3">About GENTEK</p>
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-5">
            Promoting Inclusive Writing<br />
            <span className="text-gradient">Through AI</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed max-w-2xl mx-auto">
            GENTEK is an AI-powered writing tool that uses Natural Language Processing to detect gender-biased language in written text and help writers communicate more inclusively — for everyone.
          </p>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20 bg-white dark:bg-gray-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="reveal card card-hover p-8">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center mb-5">
                <Target size={24} weight="duotone" className="text-brand-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Our Mission</h2>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                To build an accessible, AI-driven tool that empowers students, professionals, writers, and organizations to identify and eliminate gender-biased language from their written communication. Inclusive language promotes equality, reduces stereotypes, and creates a fairer world.
              </p>
            </div>
            <div className="reveal reveal-delay-2 card card-hover p-8">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-5">
                <Eye size={24} weight="duotone" className="text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Our Vision</h2>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                A world where written communication is free from gender bias — where all individuals are represented fairly regardless of gender. GENTEK aims to be the leading AI writing assistant for gender-inclusive language in academic, professional, and everyday contexts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* About the product */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div className="reveal">
              <p className="section-label mb-3">The Product</p>
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-5">
                Built to Make Writing<br />
                <span className="text-gradient">Fair for Everyone</span>
              </h2>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed mb-5">
                GENTEK addresses a real and growing challenge: the presence of unconscious gender bias in everyday written communication. From job advertisements to academic papers, biased language shapes perceptions in ways writers rarely notice.
              </p>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed mb-7">
                Using Natural Language Processing and machine learning, GENTEK analyzes text and classifies it as Male-Biased, Female-Biased, or Gender-Neutral — then provides specific, actionable suggestions to help writers improve the inclusivity of their work instantly.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: null,     color: 'text-brand-600', bg: 'bg-brand-50 dark:bg-brand-900/30', label: 'NLP-Powered Analysis' },
                  { icon: Lightbulb,color: 'text-blue-600',  bg: 'bg-blue-50 dark:bg-blue-900/30',  label: 'Smart Suggestions' },
                  { icon: Globe,    color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/30', label: 'English Text Support' },
                  { icon: Target,   color: 'text-rose-600',  bg: 'bg-rose-50 dark:bg-rose-900/30',  label: 'Gender Bias Focus' },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.label} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                      <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center flex-shrink-0`}>
                        {Icon ? <Icon size={18} weight="duotone" className={item.color} /> : <GentekMark size={22} />}
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{item.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Product stats card */}
            <div className="reveal reveal-delay-2">
              <div className="card p-6 space-y-5">
                <img
                  src="https://picsum.photos/seed/inclusive-writing-workspace/600/300"
                  alt="Inclusive writing with GENTEK"
                  className="w-full h-44 object-cover rounded-xl"
                />
                <div>
                  <p className="font-bold text-gray-900 dark:text-white mb-0.5">GENTEK — AI Gender Bias Detector</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">Helping writers communicate more fairly, every day.</p>
                </div>
                <div className="space-y-2.5">
                  {[
                    { label: 'Bias Patterns',     value: '19+ detected' },
                    { label: 'Classifications',    value: 'Male, Female, Stereotype' },
                    { label: 'Language Support',   value: 'English' },
                    { label: 'Analysis Speed',     value: 'Real-time' },
                    { label: 'Free Plan',          value: 'Available — no card needed' },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between text-sm border-b border-gray-50 dark:border-gray-700 pb-2.5">
                      <span className="text-gray-400 dark:text-gray-500">{row.label}</span>
                      <span className="text-gray-700 dark:text-gray-200 font-medium">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="py-20 bg-white dark:bg-gray-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="reveal mb-12">
            <p className="section-label mb-3">Who It's For</p>
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Built for <span className="text-gradient">Every Writer</span></h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg max-w-xl mx-auto">GENTEK fits into any writing workflow — from students to seasoned professionals.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Users,    label: 'Students',      desc: 'Review essays, thesis papers, and academic work before submission.', color: 'text-brand-600', bg: 'bg-brand-50 dark:bg-brand-900/30' },
              { icon: null,     label: 'HR Teams',       desc: 'Write inclusive job postings that attract a diverse talent pool.',     color: 'text-blue-600',  bg: 'bg-blue-50 dark:bg-blue-900/30' },
              { icon: Target,   label: 'Writers',        desc: 'Produce fair, balanced content for blogs, journalism, and media.',     color: 'text-rose-600',  bg: 'bg-rose-50 dark:bg-rose-900/30' },
              { icon: Globe,    label: 'Researchers',    desc: 'Maintain objectivity in papers, surveys, and publications.',           color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/30' },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="reveal card card-hover p-6 text-left">
                  <div className={`w-11 h-11 rounded-xl ${item.bg} flex items-center justify-center mb-4`}>
                    {Icon ? <Icon size={22} weight="duotone" className={item.color} /> : <GentekMark size={28} />}
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2">{item.label}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{item.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 bg-brand-50 dark:bg-brand-900/20 text-center reveal">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Try GENTEK for Free</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-7 text-lg leading-relaxed">
            Paste your text and get instant gender bias analysis — no account required.
          </p>
          <Link to="/detector" className="btn-primary inline-flex">
            Open the Detector
            <ArrowRight size={15} weight="bold" />
          </Link>
        </div>
      </section>
    </main>
  )
}
