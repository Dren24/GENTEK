import { Link } from 'react-router-dom'

const SECTIONS = [
  {
    title: '1. Information We Collect',
    body: `When you create an account, we collect your name and email address. When you use the analysis feature, the text you submit is processed to generate results. We also store your analysis history (text, score, classification) in our database so you can review past results. We do not collect payment card details directly — payment processing is handled by third-party providers.`,
  },
  {
    title: '2. How We Use Your Information',
    body: `We use your name and email to identify your account, send password reset emails, and (if enabled) deliver feature update notifications. Your analysis history is stored so you can access it across sessions. We do not sell, rent, or share your personal information with third parties for marketing purposes.`,
  },
  {
    title: '3. Data Storage and Security',
    body: `Your data is stored in a secure database. Passwords are hashed using bcrypt — they are never stored or transmitted in plain text. We use HTTPS for all data in transit. While we take reasonable precautions, no system is completely secure, and we cannot guarantee absolute security of your data.`,
  },
  {
    title: '4. Email Communications',
    body: `We will send transactional emails for account actions such as password resets. If you opt in to email notifications in your Settings, we may occasionally send feature updates or tips. You can disable email notifications at any time from the Settings page. We will never send spam or sell your email to third parties.`,
  },
  {
    title: '5. Cookies and Local Storage',
    body: `GENTEK uses browser localStorage to persist your login session across page refreshes. We do not use third-party advertising cookies. We may use minimal session cookies for security purposes. You can clear your browser storage at any time, which will sign you out of your account.`,
  },
  {
    title: '6. Text You Submit for Analysis',
    body: `Text you submit is processed on our servers to generate analysis results. We store this text as part of your analysis history so you can review it later. We do not use your submitted text to train AI models, share it with third parties, or use it for any purpose other than providing the analysis service.`,
  },
  {
    title: '7. Third-Party Services',
    body: `GENTEK may use third-party services such as Gmail for transactional email delivery and Stripe for payment processing. These third parties have their own privacy policies and we encourage you to review them. We only share the minimum information necessary for these services to function.`,
  },
  {
    title: '8. Data Retention and Deletion',
    body: `We retain your account data and analysis history for as long as your account is active. You may delete your account at any time from the Settings page, which will permanently remove your profile and all associated analysis history. We may retain anonymized usage statistics after account deletion.`,
  },
  {
    title: '9. Children\'s Privacy',
    body: `GENTEK is not directed at children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us and we will delete it promptly.`,
  },
  {
    title: '10. Changes to This Policy',
    body: `We may update this Privacy Policy from time to time. We will notify registered users of significant changes via email. The "last updated" date at the top of this page indicates when changes were last made. Continued use of the Service after changes constitutes acceptance of the updated policy.`,
  },
  {
    title: '11. Your Rights',
    body: `You have the right to access, correct, or delete your personal information. You can update your display name in Settings, and delete your account and all associated data at any time. If you have questions or requests regarding your data, please contact us through the Contact page.`,
  },
  {
    title: '12. Contact',
    body: `If you have any questions about this Privacy Policy or how we handle your data, please reach out through the Contact page. We aim to respond within 2–3 business days.`,
  },
]

export default function PrivacyPage() {
  return (
    <main className="pt-16 bg-white dark:bg-gray-950 min-h-screen">

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="pt-14 pb-10 bg-hero-gradient">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <p className="section-label mb-3">Legal</p>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Privacy Policy</h1>
          <p className="text-gray-500 dark:text-gray-400 text-base leading-relaxed">
            Last updated: July 3, 2026. We value your privacy and are committed to protecting your personal information.
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
            <Link to="/terms" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">Terms of Service</Link>
            <Link to="/contact" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">Contact Us</Link>
            <Link to="/" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">Back to Home</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
