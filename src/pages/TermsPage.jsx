import { Link } from 'react-router-dom'

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: `By accessing or using GENTEK ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service. We reserve the right to update these terms at any time, and continued use of the Service constitutes acceptance of any changes.`,
  },
  {
    title: '2. Description of Service',
    body: `GENTEK is an AI-powered writing analysis tool that detects gender-biased language in text using Natural Language Processing (NLP). The Service is provided for informational and educational purposes. Analysis results are generated automatically and should not be treated as definitive legal or compliance advice.`,
  },
  {
    title: '3. User Accounts',
    body: `You may use GENTEK as a guest (limited to a set number of analyses per session) or by creating a registered account. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You must provide accurate information when registering and notify us promptly of any unauthorized use.`,
  },
  {
    title: '4. Acceptable Use',
    body: `You agree not to use the Service to submit content that is unlawful, harmful, or infringes the rights of others. You may not attempt to reverse-engineer, scrape, or overload the Service. You may not use automated scripts to access the API without authorization. We reserve the right to suspend or terminate access for violations of these terms.`,
  },
  {
    title: '5. Intellectual Property',
    body: `All content, branding, and software that make up GENTEK — including the logo, design, and underlying NLP models — are the intellectual property of GENTEK and its creators. You retain ownership of any text you submit for analysis. By submitting text, you grant GENTEK a limited, non-exclusive license to process that text solely for the purpose of providing the analysis service.`,
  },
  {
    title: '6. Privacy',
    body: `Your use of the Service is also governed by our Privacy Policy, which is incorporated into these Terms by reference. Please review our Privacy Policy to understand how we collect, use, and protect your information.`,
  },
  {
    title: '7. Disclaimer of Warranties',
    body: `The Service is provided "as is" without warranties of any kind, express or implied. GENTEK does not warrant that the Service will be error-free, uninterrupted, or that analysis results will be accurate in all cases. NLP-based detection may produce false positives or miss certain patterns. Use the results as one tool among many in your writing process.`,
  },
  {
    title: '8. Limitation of Liability',
    body: `To the fullest extent permitted by law, GENTEK and its creators shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of or inability to use the Service. Our total liability for any claim arising out of the Service shall not exceed the amount you paid us in the twelve months prior to the claim.`,
  },
  {
    title: '9. Termination',
    body: `We reserve the right to terminate or suspend your account at any time, with or without notice, for conduct that we determine to be in violation of these Terms or harmful to other users, us, or third parties. You may delete your account at any time through the Settings page.`,
  },
  {
    title: '10. Governing Law',
    body: `These Terms shall be governed by and construed in accordance with applicable laws. Any disputes arising from these Terms or your use of the Service shall be resolved through good-faith negotiation, and if necessary, binding arbitration in the jurisdiction where GENTEK operates.`,
  },
  {
    title: '11. Contact',
    body: `If you have any questions about these Terms of Service, please contact us through the Contact page. We aim to respond within 2–3 business days.`,
  },
]

export default function TermsPage() {
  return (
    <main className="pt-16 bg-white dark:bg-gray-950 min-h-screen">

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="pt-14 pb-10 bg-hero-gradient">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <p className="section-label mb-3">Legal</p>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Terms of Service</h1>
          <p className="text-gray-500 dark:text-gray-400 text-base leading-relaxed">
            Last updated: July 3, 2026. Please read these terms carefully before using GENTEK.
          </p>
        </div>
      </section>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <section className="py-14">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-10">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">{s.title}</h2>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-sm">{s.body}</p>
            </div>
          ))}

          {/* ── Footer links ─────────────────────────────────────────────── */}
          <div className="pt-6 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-4 text-sm text-gray-400">
            <Link to="/privacy" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">Privacy Policy</Link>
            <Link to="/contact" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">Contact Us</Link>
            <Link to="/" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">Back to Home</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
