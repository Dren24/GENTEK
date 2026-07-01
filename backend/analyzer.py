import re

# ── analyzer.py — NLP bias analysis engine ────────────────────────────────────
# Single public function: analyze(text) → dict
# Called by /analyze endpoint in main.py.
# Detection is keyword-based (exact word match in lowercase text).
# Score formula is intentionally simple — increase multipliers for tuning.

# ── BIAS_PATTERNS — 19 bias words with type, swap suggestion, and reason ──────
# type: "male" | "female" | "stereotype"
# Patterns cover occupational titles, gendered nouns, and behavioral stereotypes.
BIAS_PATTERNS = [
    {"word": "chairman",         "type": "male",       "suggestion": "chairperson",          "reason": "Gendered occupational title"},
    {"word": "manpower",         "type": "male",       "suggestion": "workforce",             "reason": "Male-centric compound noun"},
    {"word": "businessman",      "type": "male",       "suggestion": "business professional", "reason": "Gendered occupational term"},
    {"word": "fireman",          "type": "male",       "suggestion": "firefighter",           "reason": "Gendered occupational term"},
    {"word": "policeman",        "type": "male",       "suggestion": "police officer",        "reason": "Gendered job title"},
    {"word": "mankind",          "type": "male",       "suggestion": "humankind",             "reason": "Gender-exclusive term"},
    {"word": "man-made",         "type": "male",       "suggestion": "artificial",            "reason": "Gender-exclusive compound"},
    {"word": "mailman",          "type": "male",       "suggestion": "mail carrier",          "reason": "Gendered job title"},
    {"word": "congressman",      "type": "male",       "suggestion": "congressperson",        "reason": "Gendered political title"},
    {"word": "stewardess",       "type": "female",     "suggestion": "flight attendant",      "reason": "Gendered occupational role"},
    {"word": "housewife",        "type": "female",     "suggestion": "homemaker",             "reason": "Gendered term"},
    {"word": "lady doctor",      "type": "female",     "suggestion": "doctor",                "reason": "The 'lady' prefix is unnecessary"},
    {"word": "girl boss",        "type": "female",     "suggestion": "leader",                "reason": "'Girl' is infantilizing for professionals"},
    {"word": "spinster",         "type": "female",     "suggestion": "unmarried person",      "reason": "Gendered and stigmatizing term"},
    {"word": "overly emotional", "type": "stereotype", "suggestion": "highly expressive",     "reason": "Gendered emotional stereotype"},
    {"word": "bossy",            "type": "stereotype", "suggestion": "assertive",             "reason": "Term disproportionately applied to women"},
    {"word": "hysterical",       "type": "stereotype", "suggestion": "overwhelmed",           "reason": "Historically used to dismiss women's feelings"},
    {"word": "nurturing",        "type": "female",     "suggestion": "supportive",            "reason": "Gendered trait stereotype"},
    {"word": "aggressive",       "type": "stereotype", "suggestion": "assertive",             "reason": "Often applied unfairly by gender context"},
]

# ── COLOR_MAP — hex colors used by the frontend ResultsPanel score ring ────────
COLOR_MAP = {
    "MALE-BIASED":    "#3B82F6",   # blue-500
    "FEMALE-BIASED":  "#F43F5E",   # rose-500
    "GENDER-NEUTRAL": "#0D9488",   # teal-600
    "MIXED-BIAS":     "#F59E0B",   # amber-500
}


def analyze(text: str) -> dict:
    """
    Analyze text for gender bias patterns.
    Returns counts by type, a label, a 0–100 bias score, and matched patterns.
    """
    lower = text.lower()

    # ── Pattern matching — word-boundary regex prevents false partial matches ─
    # e.g. "mankind" must not match inside "unmankind" or "humankinds"
    detected = [p for p in BIAS_PATTERNS if re.search(r'\b' + re.escape(p["word"].lower()) + r'\b', lower)]

    # ── Count by bias type ────────────────────────────────────────────────
    male   = sum(1 for p in detected if p["type"] == "male")
    female = sum(1 for p in detected if p["type"] == "female")
    stereo = sum(1 for p in detected if p["type"] == "stereotype")
    words  = len(text.strip().split()) if text.strip() else 0

    # ── Classification and score formula ─────────────────────────────────
    # Score is capped at 95 to avoid false certainty.
    # Stereotypes add weight to both male and female scores.
    if male > female and male > 0:
        label = "MALE-BIASED"
        score = min(95, 40 + male * 15 + stereo * 8)
    elif female > male and female > 0:
        label = "FEMALE-BIASED"
        score = min(95, 40 + female * 15 + stereo * 8)
    elif detected:
        # Equal male/female counts or only stereotypes detected
        label = "MIXED-BIAS"
        score = min(95, 28 + len(detected) * 10)
    else:
        # No bias patterns found
        label = "GENDER-NEUTRAL"
        score = 4   # near-zero, not exactly 0 to avoid empty ring display

    return {
        "detected": detected,   # list of matched pattern dicts
        "male":     male,       # count of male-type matches
        "female":   female,     # count of female-type matches
        "stereo":   stereo,     # count of stereotype matches
        "label":    label,      # classification string
        "score":    score,      # bias severity 0–100
        "color":    COLOR_MAP[label],   # hex color for frontend ring
        "words":    words,      # word count of input text
    }
