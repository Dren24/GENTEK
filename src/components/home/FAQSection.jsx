import { useState } from 'react'
import { Plus, Minus } from '@phosphor-icons/react'

const faqs = [
  {
    q: 'What is GENTEK?',
    a: 'GENTEK is an AI-powered web tool that analyzes written text for gender-biased language using Natural Language Processing (NLP). It classifies text as Male-Biased, Female-Biased, or Gender-Neutral, highlights specific biased words, and suggests inclusive alternatives.',
  },
  {
    q: 'Is GENTEK free to use?',
    a: 'Yes. GENTEK offers a free plan that allows up to 200 analyses per month with basic bias detection and a limited number of suggestions. A Pro plan is available for unlimited analyses, advanced suggestions, and export features.',
  },
  {
    q: 'What types of text can I analyze?',
    a: 'You can analyze any English-language written text, including essays, academic papers, job advertisements, news articles, blog posts, reports, and social media content. The system is currently optimized for English text only.',
  },
  {
    q: 'How accurate is the bias detection?',
    a: 'GENTEK is trained on curated gender bias datasets and uses machine learning to identify patterns associated with gendered language. While the system is highly effective for common bias patterns, it may occasionally misclassify complex expressions like sarcasm, slang, or figurative language.',
  },
  {
    q: 'Does GENTEK detect other types of bias?',
    a: "No. GENTEK is specifically designed to detect gender-related bias. It does not currently identify racial, cultural, religious, political, or other forms of bias. The system's scope is focused to ensure high accuracy within the gender bias domain.",
  },
  {
    q: 'Is my text stored or shared?',
    a: 'No. In the current version, all analysis runs entirely in your browser — no text is sent to any external server. Your data stays private and is never stored or shared.',
  },
  {
    q: 'Who built GENTEK?',
    a: 'GENTEK was built by a dedicated team of AI and NLP engineers passionate about fair, inclusive communication. The product is continuously improved based on user feedback and evolving language research.',
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
