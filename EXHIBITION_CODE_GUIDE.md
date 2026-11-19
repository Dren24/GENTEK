# GENTEK — Exhibition Code Guide

A map of GENTEK's code for the system exhibition and defense: where everything lives, how a request travels through the system, and simple answers to the questions panelists usually ask.

> **Tip:** line numbers below are correct as of this version. If code moves, search for the **function name** (Cmd+Shift+F in VS Code); names don't change.

---

## 1. What GENTEK is (one-paragraph pitch)

GENTEK checks writing for **gender-biased language**. The user pastes or uploads text (essays, messages, song lyrics, Tagalog/Bisaya too), clicks **Analyze**, and GENTEK highlights biased words and phrases, explains why each one is biased, suggests a neutral alternative, and classifies the whole text as **Male-Biased, Female-Biased, or Gender-Neutral** with a percentage breakdown. It combines two detection methods: a **rule-based word list** (fast, always works) and an **AI language model** (understands context, e.g. stereotypes, implied gender roles, a generic "he").

**Tech stack:** React 18 + Vite + Tailwind (frontend) · Python FastAPI + SQLAlchemy (backend) · PostgreSQL on Neon (database) · Hugging Face (Llama 3.1 8B) and Groq (backup) for the AI · Brevo / Gmail for email · deployed on Render with Docker.

---

## 2. Project folder structure

```
GENTEK/
├── src/                        ← FRONTEND (React)
│   ├── main.jsx                  entry point: mounts the app
│   ├── App.jsx                   layout (sidebar/navbar/footer) + all page routes
│   ├── index.css                 global styles (highlight colors, cards, buttons)
│   ├── context/
│   │   └── AuthContext.jsx       session + every login/history API call
│   ├── pages/                    one file per URL
│   │   ├── HomePage.jsx            "/"  the analyzer (the core screen)
│   │   ├── DashboardPage.jsx       "/dashboard" stats from your history
│   │   ├── SettingsPage.jsx        "/settings" name, password, delete account
│   │   ├── ResetPasswordPage.jsx   "/reset-password" set a new password
│   │   ├── AboutPage, ContactPage, PricingPage, TermsPage, PrivacyPage
│   ├── components/shared/        reusable pieces used across pages
│   │   ├── AuthModal.jsx           Log in / Sign up / code entry / forgot password
│   │   ├── AppSidebar.jsx          left sidebar (history, search) for logged-in users
│   │   ├── Navbar.jsx, Footer.jsx, GentekLogo.jsx, ConfirmModal.jsx
│   │   └── PricingModal.jsx, PaymentModal.jsx   upgrade flow (real PayPal card/PayPal checkout)
│   ├── utils/
│   │   ├── biasHighlight.js        highlight / replace detected words in the text
│   │   └── biasScore.js            Male % / Female % / Neutral % split
│   ├── hooks/                    small reusable behaviors
│   │   ├── useDarkMode.js, useIsMobile.js, useScrollReveal.js
│   └── data/plans.js             Free vs Premium plan details
│
├── backend/                    ← BACKEND (Python FastAPI)
│   ├── main.py                   app start-up, POST /analyze, serves the built frontend
│   ├── analyzer.py               ★ THE BIAS-DETECTION ALGORITHM (lexicon + AI)
│   ├── auth.py                   accounts, login, email codes, history, contact form
│   ├── models.py                 database tables (SQLAlchemy classes)
│   ├── database.py               database connection (Neon PostgreSQL / local SQLite)
│   ├── evaluate_accuracy.py      runs the 92-case accuracy evaluation
│   ├── test_analyzer.py          automated tests for the algorithm
│   ├── test_auth.py              automated tests for login/sign-up/security
│   └── requirements.txt          Python libraries
│
├── docs/                       evaluation dataset (CSV), evaluation notes, diagrams
├── public/                     logo and favicon
├── Dockerfile                  how Render builds and runs everything in one container
├── vite.config.js              dev server: forwards /analyze and /auth to the backend
└── EXHIBITION_CODE_GUIDE.md    this file
```

**Why this structure:** each folder has one job. `pages/` = screens, `components/shared/` = parts reused by several screens, `context/` = shared state + API calls, `utils/` = pure helper functions with no UI, `backend/` = everything that runs on the server. The backend stays flat (a few files) because it is small; the Dockerfile and Render's start command depend on these paths.

---

## 3. Main system flow — "What happens when I click Analyze?"

```
User types text, clicks "Analyze Text"
  → src/pages/HomePage.jsx        analyzeText()           (line ~541)
  → fetch POST /analyze {text}    + login token if logged in
  → backend/main.py               analyze_text()          (line ~110)
        checks Free-plan word limit (500 words; Premium unlimited)
  → backend/analyzer.py           analyze()               (line ~974)
        Step 1  _pattern_detect()   rule-based word list
        Step 2  _llm_analyze()      AI model (Llama → Groq backup)
        Step 3  _merge()            combine, remove duplicates
        Step 4  _score() + bias_breakdown()   label + percentages
  → JSON response {detected, label, score, male_pct, female_pct, neutral_pct, ai_powered, ...}
  → HomePage.jsx                  normalizeApiResult()    (line ~499)
        → utils/biasHighlight.js highlightHtml()  colors the words
        → results panel shows Male / Female / Gender-Neutral %
  → saveToHistory() → POST /auth/history/{id} → database "analyses" table
        (logged-in users; appears in the sidebar "Recent")
```

**If the server is unreachable**, HomePage uses `runAnalysis()` (line ~120), a small built-in word list, and marks the result **"Keyword check only"** so it's never mistaken for a full AI check.

---

## 4. The core algorithm — `backend/analyzer.py`

| Function | Line | What it does |
|---|---|---|
| `analyze(text)` | ~974 | Main entry: runs the 4 steps above and returns the result |
| `BIAS_PATTERNS` | ~170 | The lexicon: **61 entries** (34 male, 19 female, 8 context-dependent), incl. Tagalog/Bisaya |
| `_pattern_detect(text)` | ~302 | Finds lexicon words in the text. Coded words like "bossy" only count if a gendered word ("she", "men", "babae") is nearby |
| `_context_gender()` | ~276 | Decides male/female for those coded words from the nearest gendered word |
| `_llm_analyze(text)` | ~842 | Splits long text into chunks (3,000 chars, max 12) and asks the AI about each |
| `_llm_analyze_chunk()` | ~779 | Tries each model in order; retries; skips a provider that's out of credits |
| `_build_chain()` | ~84 | Builds the model order: Hugging Face Llama 3.1 → Groq gpt-oss-120b → gpt-oss-20b |
| `_SYSTEM_PROMPT` | ~385 | The instructions given to the AI (what counts as bias, what does NOT) |
| `_find_span_fuzzy()` | ~582 | **Typos & merged words**: if the AI quotes a phrase with the writer's typos fixed ("Girls are" for "Girlsare"), maps it back onto the writer's own words so they get highlighted — the text is never corrected. Needs 3+ words, a close match, and no opposite-gender word |
| `_validate_llm_items()` | ~710 | **Safety check on AI output**: the word must really be in the text, valid type/category, a lone "her"/"he" is only accepted as a generic pronoun with a generic antecedent, family-member reports are not stereotypes |
| `_merge()` | ~902 | Combines lexicon + AI findings; drops AI duplicates of lexicon matches |
| `_score()` | ~932 | Label (more male or female findings; tie → Male-Biased) and score by count: 1→20%, 2→35%, 3→50%, 4→60%, 5→70%, 6→78%, 7→84%, then +3% each (max 95%) |
| `bias_breakdown()` | ~962 | Splits the score into Male % / Female % / Neutral % (always adds to 100) |

**Input / output example**

Input: `"Every engineer should check his code. Girls aren't good at math."`
Output (simplified):
```json
{ "label": "MALE-BIASED", "score": 35, "male_pct": 18, "female_pct": 17, "neutral_pct": 65,
  "detected": [
    {"word": "his", "type": "male", "suggestion": "their", "reason": "Assumes the engineer is male"},
    {"word": "Girls aren't good at math", "type": "female", "suggestion": "...", "reason": "Stereotype about girls' ability"} ],
  "ai_powered": true, "ai_models": ["groq:openai/gpt-oss-120b"] }
```

**Simple explanation for the panel:** *"We use two layers. A fixed list catches the obvious words instantly and always works, even offline. An AI model reads the meaning of the sentence to catch stereotypes and implied bias the list can't see. We don't blindly trust the AI: every answer is checked against the original text, so it can't invent words or flag normal pronouns like 'her' in a love song."*

---

## 5. API endpoints

All `/auth/...` routes are in `backend/auth.py`; the others are in `backend/main.py`. 🔒 = needs a login token.

| Method & path | Purpose |
|---|---|
| `GET /health` | Is the server up? |
| `POST /analyze` | Analyze text (optional login; Free = 500 words) |
| `POST /auth/register` | Sign up → emails a 6-digit code (no session yet) |
| `POST /auth/verify-code` | Confirm sign-up or new-browser login code → logged in |
| `POST /auth/resend-code` | Send a new code (60 s cooldown) |
| `POST /auth/login` | Email + password → token, or a code if this browser is new |
| `POST /auth/google` | Continue with Google |
| `POST /auth/forgot-password` | Email a reset code |
| `POST /auth/verify-reset-code` | Code → one-time reset token |
| `POST /auth/reset-password` | Set new password with the reset token → logged in |
| `POST /auth/create-password` 🔒 | Google users add a GENTEK password |
| `PUT /auth/change-password/{id}` 🔒 | Change password (needs current one) |
| `PUT /auth/update/{id}` 🔒 | Change display name |
| `PUT /auth/notifications/{id}` 🔒 | Email notification setting |
| `DELETE /auth/delete/{id}` 🔒 | Delete account and all its data |
| `GET/POST /auth/history/{id}` 🔒 | List / save analyses |
| `PUT/DELETE /auth/history/{id}/{analysis_id}` 🔒 | Update / delete one saved analysis |
| `POST /auth/contact` | Contact form → email to GENTEK's inbox |
| `GET /payments/config` | PayPal public client ID, prices, test/live mode |
| `POST /payments/orders` 🔒 | Start a PayPal payment (server sets the price) |
| `POST /payments/orders/{id}/capture` 🔒 | Take the money, verify it with PayPal → Premium on |
| `GET /payments/status` 🔒 | Current plan (Premium ends by itself after 30/365 days) |

**How the frontend calls them:** almost all go through `src/context/AuthContext.jsx` (e.g. `login()`, `verifyCode()`, `addToHistory()`), which adds the token with `authHeader()` and logs the user out automatically if the server says the token expired (`authFetch`, 401).

---

## 6. Database — `backend/models.py`

| Table | Holds | Key columns |
|---|---|---|
| `users` | Accounts | `email` (unique), `password` (bcrypt hash), `is_premium`, `premium_until`, `google_id`, `email_verified`, `has_password` |
| `analyses` | Saved analyses (history) | `user_id` → users, `text`, `score`, `classification` |
| `email_codes` | Pending 6-digit codes | `user_id`, `purpose` (verify/login/reset/setpw), `code_hash`, `attempts`, `expires_at` |
| `trusted_devices` | Browsers that passed a code (30 days) | `user_id`, `token_hash`, `expires_at` |
| `password_reset_tokens` | One-time reset tokens (10 min) | `user_id`, `token` (hashed), `expires_at` |
| `payments` | PayPal checkouts | `user_id`, `order_id`, `capture_id`, `plan`, `amount`, `mode` (sandbox/live), `status` |

**Relationships:** one **user** has many **analyses**, codes, trusted devices and reset tokens. Deleting a user deletes all of them (`delete_user` in auth.py + cascade in models.py).

**Connection:** `backend/database.py` uses `DATABASE_URL` (Neon PostgreSQL in production) or a local SQLite file (`gentek.db`) for development. `get_db()` opens one session per request and always closes it. Tables are created at start-up (`main.py`, `Base.metadata.create_all`); new columns are added by the small migration list right below it, which existing data survives.

---

## 7. Authentication & security

| Feature | Where | How |
|---|---|---|
| Password storage | `hash_password()` auth.py ~401 | bcrypt hash; the plain password is never stored |
| Sessions | `_create_token()` ~76, `get_current_user()` ~91 | Signed JWT (30 days with "Remember me", else 12 h) |
| Own-data-only | every 🔒 route | `if current_user["id"] != user_id: 403` |
| Email verification | `_issue_code()` ~308, `_consume_code()` ~354 | 6-digit code, SHA-256 hashed, 5 min, single use, 5 wrong tries max |
| New-browser login check | `_is_trusted_device()` ~277 | Unknown browser → emailed code; then trusted 30 days |
| Rate limiting | `_RateLimiter` ~203 | Limits per email and per IP (codes, guesses, logins, contact) |
| No account guessing | `forgot_password()` ~925 | Same reply whether the email exists or not |
| Google sign-in | `google_auth()` ~513 | Token verified **with Google's servers**, never trusted from the browser |
| Safe HTML | `utils/biasHighlight.js` `escapeHtml()` | User text is escaped before highlighting (prevents XSS) |
| AI output check | `_validate_llm_items()` analyzer.py ~710 | AI findings must exist in the text; invalid ones are dropped and logged |
| Payments | `backend/payments.py` `capture_order()` | Card numbers go into **PayPal's** form, never GENTEK's. Premium turns on only after the **server** captures the payment with PayPal and checks status, amount and currency — the browser can't fake it or pick the price |
| Secrets | `.env` files (git-ignored), Render env vars | No keys in the code or in Git |

---

## 8. Other important frontend code

| File / function | What to know |
|---|---|
| `utils/biasHighlight.js` `highlightHtml()` | Builds the colored `<mark>` highlighting in one pass over the text (each mark knows its exact position); `fixRange()` replaces only the clicked occurrence; `rewriteAll()` applies every suggestion; `matchCase()` / `capitalizeSentences()` make replacements correctly capitalized (sentence starts, "Chairman" → "Chairperson") |
| `utils/biasScore.js` `biasBreakdown()` | Same Male/Female/Neutral formula as the backend's `bias_breakdown()` |
| `components/shared/AuthModal.jsx` | All login screens: Log in, Sign up, enter code, forgot password, create password |
| `components/shared/AppSidebar.jsx` | History list, search, pinned items; on phones it slides over the page |
| `pages/HomePage.jsx` `normalizeApiResult()` | Converts the backend reply into what's displayed |
| `utils/documentText.js` `extractText()` | Upload: reads PDF (PDF.js **legacy** build, so older iPhone/Android browsers work), Word .docx (Mammoth) and TXT **in the browser**. Only the extracted text goes into the editor and later to `/analyze`; the file itself is never uploaded. Clear errors for empty, damaged, password-protected, scanned, .doc and >25 MB files. |
| `pages/HomePage.jsx` `startEditing()` / `saveEdits()` | **Edit Text** after analysis: edits a draft copy; Cancel keeps the results, Save Changes replaces the text and clears the old highlights/percentages so they can never describe edited text. Nothing is sent or saved to history until the user clicks Analyze Text again. Rewritten text is always directly editable. |
| `App.jsx` | Routes (which page shows for which URL) and the overall layout |

---

## 9. Questions panelists may ask — with simple answers

**Q: Is it really AI, or just a word list?**
Both. The word list (61 patterns) gives instant, reliable results. The AI (Llama 3.1 8B, Groq as backup) understands context. Each result shows a badge: **"AI"** when the AI read the whole text, **"Keyword check only"** when it couldn't, so we never hide it.

**Q: How do you stop the AI from making things up?**
`_validate_llm_items()` checks every AI finding: the flagged words must appear in the user's text, the type must be male/female, and pronouns like "her" in normal sentences are rejected unless they refer to a generic person ("every engineer… his"). Rejected findings are logged.

**Q: How is the score calculated?**
By the number of biased findings (`_score()`): 1 finding = 20%, 2 = 35%, 3 = 50%, up to 95%. The label is whichever gender has more findings. The Male/Female percentages split that score by the count of each (`bias_breakdown()`), and Gender-Neutral is the rest, so they always add to 100%.

**Q: Why might "her" not be flagged?**
Mentioning a gender is not bias. "Let her into your heart" talks about a specific person. Bias is a generalization or assumption, e.g. "every nurse… her charts" or "girls can't do math".

**Q: What if the AI service is down or out of credits?**
GENTEK tries Hugging Face first, then two Groq models (`_llm_analyze_chunk()`). If all fail, the keyword result is still shown, clearly marked "Keyword check only".

**Q: How do you protect passwords and accounts?**
Passwords are hashed with bcrypt, sessions use signed JWT tokens, sign-up and logins from new browsers need a code sent by email, codes are hashed and expire in 5 minutes, and repeated attempts are rate-limited.

**Q: How do the frontend and backend talk?**
Through JSON over HTTP. The React app calls `/analyze` and `/auth/...` with `fetch`; in development Vite forwards these to FastAPI (`vite.config.js`), and in production FastAPI serves both the API and the built website (`main.py`, bottom).

**Q: How accurate is it?**
`backend/evaluate_accuracy.py` runs 92 hand-made test cases (English, Tagalog, Bisaya) and reports label accuracy, precision, recall and F1. The rule-based layer scores 92/92. Re-run it with `--use-llm` shortly before the defense to quote the AI's current numbers (AI results can vary slightly between runs and with Groq's daily limit). It's a self-made validation set, not a public benchmark; see `docs/EVALUATION.md` for its known limitations.

**Q: Does it support Filipino?**
Yes, partly. The AI is instructed for Tagalog, Bisaya, Taglish and Bislish, and the word list has a few common Tagalog/Bisaya phrases. Known limit: Tagalog "lalaki" can also mean "will grow", which the AI sometimes misreads.

**Q: Where is user data stored?**
In PostgreSQL (Neon): accounts, saved analyses, and short-lived security codes. Analyzed text is sent to the AI provider to be read; history is saved only for logged-in users (not in "temporary session" mode).

---

## 10. How to run and test

```bash
npm install && pip3 install -r backend/requirements.txt   # once
npm run dev                                                # frontend :5173 + backend :8000

cd backend
python3 -m unittest test_analyzer test_auth               # automated tests
python3 evaluate_accuracy.py --show-errors                 # accuracy, keyword layer
python3 evaluate_accuracy.py --use-llm --show-errors       # accuracy with the AI
```

Local settings live in `backend/.env` (AI keys, Gmail/Brevo, Google client ID) and the root `.env` (frontend Google client ID). These files are never committed to Git.
