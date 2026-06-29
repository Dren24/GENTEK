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

COLOR_MAP = {
    "MALE-BIASED":    "#3B82F6",
    "FEMALE-BIASED":  "#F43F5E",
    "GENDER-NEUTRAL": "#0D9488",
    "MIXED-BIAS":     "#F59E0B",
}


def analyze(text: str) -> dict:
    lower = text.lower()
    detected = [p for p in BIAS_PATTERNS if p["word"].lower() in lower]

    male   = sum(1 for p in detected if p["type"] == "male")
    female = sum(1 for p in detected if p["type"] == "female")
    stereo = sum(1 for p in detected if p["type"] == "stereotype")
    words  = len(text.strip().split()) if text.strip() else 0

    if male > female and male > 0:
        label = "MALE-BIASED"
        score = min(95, 40 + male * 15 + stereo * 8)
    elif female > male and female > 0:
        label = "FEMALE-BIASED"
        score = min(95, 40 + female * 15 + stereo * 8)
    elif detected:
        label = "MIXED-BIAS"
        score = min(95, 28 + len(detected) * 10)
    else:
        label = "GENDER-NEUTRAL"
        score = 4

    return {
        "detected": detected,
        "male":     male,
        "female":   female,
        "stereo":   stereo,
        "label":    label,
        "score":    score,
        "color":    COLOR_MAP[label],
        "words":    words,
    }
