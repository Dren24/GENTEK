// ── Pricing plan definitions ──────────────────────────────────────────────────
// Single source of truth for plan data imported by both PricingModal and PricingPage.
// Editing here updates the modal popup AND the /pricing page simultaneously.

// ── PLANS — Free and Premium plan objects ─────────────────────────────────────
// Each plan has: id, name, price (₱/month), desc, cta,
// ctaStyle ('ghost' | 'primary'), optional featured/badge, and benefits array.
// benefits[].note is optional sub-text shown below the benefit label.
export const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    desc: 'Everything you need to check everyday writing — no credit card needed',
    cta: 'Your current plan',
    ctaStyle: 'ghost',
    benefits: [
      { label: 'Up to 500 words per analysis',      note: 'Guests without an account: 300 words, 2 analyses' },
      { label: 'AI gender bias detection',          note: 'Male, Female & Gender-Neutral' },
      { label: 'Highlighted words with explanations' },
      { label: 'Suggestions + one-click Rewrite' },
      { label: 'Upload PDF, Word or TXT files' },
      { label: 'Saved analysis history',            note: 'With a free account' },
      { label: 'No credit card required' },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 599,
    desc: 'For long essays, theses, reports and policies',
    cta: 'Upgrade to Premium',
    ctaStyle: 'primary',
    featured: true,                 // highlighted card with blue border
    badge: 'FOR LONG DOCUMENTS',
    benefits: [
      { label: 'No 500-word limit',                 note: 'Analyze a whole document at once' },
      { label: 'Everything in Free' },
      { label: 'One-time payment, 30 days',         note: "Doesn't renew automatically" },
      { label: 'Cancel anytime in Settings' },
      { label: 'Secure card payment via PayPal' },
    ],
  },
]

// ── COMPARISON — feature comparison table rows (Free vs Premium) ──────────────
// Used in PricingPage's "Full Feature Comparison" table.
// Values can be: true (✓), false (✗), or a string (displayed as text).
// Only list what the app really does — Premium is a paid product.
export const COMPARISON = [
  { label: 'Words per analysis',         free: '500 (guests 300)', premium: 'No limit' },
  { label: 'Number of analyses',         free: 'Unlimited',        premium: 'Unlimited' },
  { label: 'AI gender bias detection',   free: true,               premium: true },
  { label: 'Highlights + explanations',  free: true,               premium: true },
  { label: 'Suggestions + Rewrite Text', free: true,               premium: true },
  { label: 'Upload PDF / Word / TXT',    free: true,               premium: true },
  { label: 'Saved analysis history',     free: true,               premium: true },
  { label: 'Long documents (500+ words)', free: false,             premium: true },
]
