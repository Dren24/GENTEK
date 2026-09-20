# GENTEK Architecture Diagram Prompt

## Prompt for AI Image/Diagram Generation

Copy and paste this prompt into any AI that can generate architecture diagrams (ChatGPT with DALL-E, Claude with image generation, Midjourney, etc.):

---

## PROMPT TO PASTE:

Create a comprehensive system architecture diagram for GENTEK, a Gender Bias Detection AI System. The diagram should show the following layers and components:

**LAYERS:**

1. **FRONTEND LAYER (React + Vite)** - Top layer, light blue background (#e1f5ff)
   - UI Components (Hero, Analyzer, Features sections)
   - Pages (Dashboard, Detector, Workspace)
   - Auth Context (Login, Register, Password Reset)
   - Custom Hooks (useDarkMode, useScrollReveal)
   - React Router for Navigation

2. **API GATEWAY (FastAPI)** - Orange background (#fff3e0)
   - GET /health endpoint (Uptime Check)
   - POST /analyze endpoint (Text Analysis)
   - Auth Router (register, login, history)

3. **AI ENGINE / NLP CORE** - Purple background (#f3e5f5)
   - Bias Analyzer (Keyword Pattern Matching)
   - 19 Bias Patterns database (Male | Female | Stereotypes)
   - Classification Engine (MALE-BIASED, FEMALE-BIASED, GENDER-NEUTRAL, MIXED-BIAS)
   - Scoring Algorithm (0-100 Bias Score)

4. **DATA LAYER** - Green background (#e8f5e9)
   - Users Table (Email, Password Hash, Profile)
   - Analyses Table (Results, Score, Classification)
   - Reset Tokens Table (Password Recovery)
   - Show cascade delete relationship from Users to Analyses

5. **MIDDLEWARE & SECURITY** - Pink background (#fce4ec)
   - CORS Handler (Dev Server Access)
   - Auth Middleware (JWT/Session)
   - Input Validation (Pydantic Models)

**CONNECTIONS:**
- Frontend connects to API Gateway via HTTP/JSON
- API Gateway connects to Middleware
- Middleware connects to AI Engine and Database
- AI Engine returns detected patterns to Database
- API Gateway serves Static Files back to Frontend
- Middleware verifies users against Database

**STYLE REQUIREMENTS:**
- Professional, tech company style
- Color-coded layers as specified
- Clear arrows showing data flow
- Include emoji indicators (🎨, 🔗, 🧠, 💾, 🛡️)
- Modern, minimalist design
- Enterprise-grade appearance

**OUTPUT:**
Generate a clean, professional architecture diagram that can be used for:
- Developer documentation
- Technical presentations
- Team onboarding
- GitHub repository documentation

---

## Text-Based Mermaid Version (If you need code):

```mermaid
graph TB
    subgraph Frontend["🎨 FRONTEND LAYER (React + Vite)"]
        direction LR
        UI["UI Components<br/>Hero, Analyzer, Features"]
        Pages["Pages<br/>Dashboard, Detector, Workspace"]
        Auth["Auth Context<br/>Login, Register, Reset"]
        Hooks["Custom Hooks<br/>useDarkMode, useScrollReveal"]
        Router["React Router<br/>Navigation & Routing"]
        
        UI --> Router
        Pages --> Auth
        Pages --> Hooks
    end
    
    subgraph API["🔗 API GATEWAY (FastAPI)"]
        direction TB
        Health["GET /health<br/>Uptime Check"]
        Analyze["POST /analyze<br/>Text Analysis Endpoint"]
        AuthAPI["Auth Router<br/>register, login, history"]
    end
    
    subgraph AI["🧠 AI ENGINE (NLP Core)"]
        direction TB
        Analyzer["Bias Analyzer<br/>Keyword Pattern Matching"]
        Patterns["19 Bias Patterns<br/>Male | Female | Stereotypes"]
        Classifier["Classification Engine<br/>MALE/FEMALE/NEUTRAL/MIXED"]
        Scorer["Scoring Algorithm<br/>0-100 Bias Score"]
        
        Analyzer --> Patterns
        Analyzer --> Classifier
        Analyzer --> Scorer
    end
    
    subgraph DB["💾 DATA LAYER (SQLite + SQLAlchemy)"]
        direction TB
        Users["Users Table<br/>Email, Password Hash, Profile"]
        Analyses["Analyses Table<br/>Results, Score, Classification"]
        Tokens["Reset Tokens<br/>Password Recovery"]
        
        Users ---|cascade delete| Analyses
        Users ---|one-to-many| Tokens
    end
    
    subgraph Middleware["🛡️ MIDDLEWARE & SECURITY"]
        CORS["CORS Handler<br/>Dev Server Access"]
        Auth_Middleware["Auth Middleware<br/>JWT/Session"]
        Validation["Input Validation<br/>Pydantic Models"]
    end
    
    Frontend -->|HTTP/JSON| API
    API --> Middleware
    Middleware --> AI
    Middleware --> DB
    AI -->|Detected Patterns| DB
    API -->|Static Files| Frontend
    Middleware -.->|Verify User| DB
    
    style Frontend fill:#e1f5ff
    style API fill:#fff3e0
    style AI fill:#f3e5f5
    style DB fill:#e8f5e9
    style Middleware fill:#fce4ec
```

---

**System Description for AI Context:**

GENTEK is a Gender Bias Detection platform that analyzes text for gender bias patterns. It uses NLP-based keyword pattern matching to identify:
- Male-biased words (chairman, businessman, fireman, policeman, mailman, congressman, etc.)
- Female-biased words (stewardess, housewife, spinster, lady doctor, girl boss, etc.)
- Stereotypical terms (bossy, hysterical, overly emotional, aggressive, nurturing)

The system classifies analyzed text as MALE-BIASED, FEMALE-BIASED, MIXED-BIAS, or GENDER-NEUTRAL, and assigns a 0-100 bias score.

Users can register, login, submit text for analysis, view results, and access their analysis history.

---

End of Prompt
