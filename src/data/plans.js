// ── Pricing plan definitions ──────────────────────────────────────────────────
// Single source of truth for plan data imported by both PricingModal and PricingPage.
// Editing here updates the modal popup AND the /pricing page simultaneously.

// ── PLANS — Free and Premium plan objects ─────────────────────────────────────
// Each plan has: id, name, price (₱/month), annualPrice (25% off), desc, cta,
// ctaStyle ('ghost' | 'primary'), optional featured/badge, and benefits array.
// benefits[].note is optional sub-text shown below the benefit label.
export const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    desc: 'Perfect for getting started — no credit card needed',
    cta: 'Your current plan',
    ctaStyle: 'ghost',
    benefits: [
      { label: '200 analyses per month',          note: 'Resets every month' },
      { label: 'Up to 100 words per analysis',     note: 'For guests without an account' },
      { label: 'Basic gender bias detection',      note: 'Male, Female & Neutral' },
      { label: '3 smart suggestions per analysis' },
      { label: 'Visual word highlighting' },
      { label: 'Bias score indicator' },
      { label: '7-day analysis history' },
      { label: 'No credit card required' },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 599,
    annualPrice: 449,               // billed annually (25% saving)
    desc: 'For serious writers, researchers & professionals',
    cta: 'Upgrade to Premium',
    ctaStyle: 'primary',
    featured: true,                 // highlighted card with blue border
    badge: 'MOST POPULAR',
    benefits: [
      { label: 'Unlimited analyses',               note: 'No monthly cap — ever' },
      { label: 'Unlimited word count',              note: 'Analyze texts of any length' },
      { label: 'Advanced AI bias detection',        note: 'Higher accuracy model' },
      { label: 'Unlimited smart suggestions',       note: 'Per analysis' },
      { label: 'Stereotype detection',              note: '+ all Free classifications' },
      { label: 'Detailed bias reports',             note: 'Download as PDF or CSV' },
      { label: 'Export results' },
      { label: 'Unlimited analysis history' },
      { label: 'Priority processing speed' },
      { label: 'API access' },
      { label: 'Priority email support' },
      { label: 'Early access to new features' },
    ],
  },
]

// ── COMPARISON — feature comparison table rows (Free vs Premium) ──────────────
// Used in PricingPage's "Full Feature Comparison" table.
// Values can be: true (✓), false (✗), or a string (displayed as text).
export const COMPARISON = [
  { label: 'Analyses per month',        free: '200',          premium: 'Unlimited'        },
  { label: 'Words per analysis',        free: '100 words',    premium: 'Unlimited'        },
  { label: 'Bias detection accuracy',   free: 'Basic',        premium: 'Advanced AI'      },
  { label: 'Classification types',      free: '3 types',      premium: 'All + Stereotype' },
  { label: 'Suggestions per analysis',  free: '3',            premium: 'Unlimited'        },
  { label: 'Visual word highlighting',  free: true,           premium: true               },
  { label: 'Bias score indicator',      free: true,           premium: true               },
  { label: 'Analysis history',          free: '7 days',       premium: 'Unlimited'        },
  { label: 'Export results',            free: false,          premium: true               },
  { label: 'Detailed bias reports',     free: false,          premium: true               },
  { label: 'Priority processing',       free: false,          premium: true               },
  { label: 'API access',                free: false,          premium: true               },
  { label: 'Priority email support',    free: false,          premium: true               },
  { label: 'Early feature access',      free: false,          premium: true               },
]
