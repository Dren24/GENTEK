import { useState } from 'react'
import { Plus, Minus } from '@phosphor-icons/react'

const faqs = [
  {
    q: 'What is GENTEK?',
    a: 'GENTEK is a web tool that helps you find gender-biased language in English text. It highlights possible issues, explains them, and suggests more inclusive alternatives.',
  },
  {
    q: 'Is GENTEK free to use?',
    a: 'Yes. GENTEK offers a free plan that allows up to 200 analyses per month with basic bias detection and a limited number of suggestions. A Pro plan is available for unlimited analyses, advanced suggestions, and export features.',
  },
  {
    q: 'What types of text can I analyze?',
    a: 'You can analyze English essays, academic papers, job advertisements, news articles, blog posts, reports, and social media content.',
  },
  {
    q: 'How accurate is the bias detection?',
    a: 'GENTEK works best for common gendered terms, occupational titles, and stereotype phrases. Like any writing checker, it may miss subtle context or flag wording that still needs human judgment.',
  },
  {
    q: 'Does GENTEK detect other types of bias?',
    a: 'No. GENTEK focuses on gender-related bias. It does not currently check for racial, cultural, religious, political, or other forms of bias.',
  },
  {
    q: 'Is my text stored or shared?',
    a: 'Guest analysis is temporary. If you sign in, you can save recent analyses to your account history for later review.',
  },
  {
    q: 'Who built GENTEK?',
    a: 'GENTEK was created as a practical tool for students, writers, and teams who want clearer and more inclusive communication.',
  },
]

function FAQItem({ faq, isOpen, onToggle }) {
  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50/60 transition-colors"
      >
        <span className="font-semibold text-gray-900 text-sm pr-6">{faq.q}</span>
        <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${isOpen ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
          {isOpen ? <Minus size={13} weight="bold" /> : <Plus size={13} weight="bold" />}
        </div>
      </button>
      <div className={`faq-body ${isOpen ? 'open' : 'closed'}`}>
        <p className="px-5 pb-4 text-sm text-gray-500 leading-relaxed">{faq.a}</p>
      </div>
    </div>
  )
}

export default function FAQSection() {
  const [openIdx, setOpenIdx] = useState(0)

  return (
    <section id="faq" className="py-24 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 reveal">
          <p className="section-label mb-3">FAQ</p>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Frequently Asked <span className="text-gradient">Questions</span>
          </h2>
          <p className="text-gray-500 text-lg">
            Everything you need to know about GENTEK.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className={`reveal reveal-delay-${(i % 3) + 1}`}>
              <FAQItem
                faq={faq}
                isOpen={openIdx === i}
                onToggle={() => setOpenIdx(openIdx === i ? -1 : i)}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
