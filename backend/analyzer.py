import re
import os
import json
import requests
from typing import Optional, List, Dict
from dotenv import load_dotenv

load_dotenv()

HF_API_KEY = os.getenv("HF_API_KEY", "")
LLM_MODEL  = "meta-llama/Llama-3.1-8B-Instruct"
CHAT_URL   = "https://router.huggingface.co/v1/chat/completions"

COLOR_MAP = {
    "MALE-BIASED":    "#3B82F6",
    "FEMALE-BIASED":  "#F43F5E",
    "GENDER-NEUTRAL": "#0D9488",
    "MIXED-BIAS":     "#F59E0B",
}

VALID_TYPES = {"male", "female", "stereotype"}

# Terms that are already gender-neutral — never flag these
NEUTRAL_TERMS = {
    "businessperson", "businesspeople", "chairperson", "salesperson", "salesperson",
    "spokesperson", "congressperson", "craftsperson", "foreperson", "workperson",
    "firefighter", "fire fighter", "police officer", "mail carrier", "camera operator",
    "flight attendant", "workforce", "humankind", "staffing",
    "individual", "person", "people", "team", "staff", "employee", "employees",
    "worker", "workers", "manager", "supervisor", "director", "coordinator",
    "administrator", "leader", "professional", "professionals", "candidate", "candidates",
    "they", "their", "them", "theirs", "themselves",
    "anyone", "everyone", "someone", "no one",
}

# Known biased patterns — always run, regardless of LLM
BIAS_PATTERNS = [
    # Male-gendered job titles
    {"word": "chairman",        "type": "male",       "suggestion": "chairperson",          "reason": "Gendered occupational title"},
    {"word": "manpower",        "type": "male",       "suggestion": "workforce",             "reason": "Male-centric compound noun"},
    {"word": "businessman",     "type": "male",       "suggestion": "businessperson",        "reason": "Gendered occupational term"},
    {"word": "businessmen",     "type": "male",       "suggestion": "businesspeople",        "reason": "Gendered occupational term"},
    {"word": "fireman",         "type": "male",       "suggestion": "firefighter",           "reason": "Gendered occupational term"},
    {"word": "firemen",         "type": "male",       "suggestion": "firefighters",          "reason": "Gendered occupational term"},
    {"word": "policeman",       "type": "male",       "suggestion": "police officer",        "reason": "Gendered job title"},
    {"word": "policemen",       "type": "male",       "suggestion": "police officers",       "reason": "Gendered job title"},
    {"word": "mankind",         "type": "male",       "suggestion": "humankind",             "reason": "Gender-exclusive term"},
    {"word": "man-made",        "type": "male",       "suggestion": "artificial",            "reason": "Gender-exclusive compound"},
    {"word": "mailman",         "type": "male",       "suggestion": "mail carrier",          "reason": "Gendered job title"},
    {"word": "congressman",     "type": "male",       "suggestion": "congressperson",        "reason": "Gendered political title"},
    {"word": "congressmen",     "type": "male",       "suggestion": "congress members",      "reason": "Gendered political title"},
    {"word": "cameraman",       "type": "male",       "suggestion": "camera operator",       "reason": "Gendered job title"},
    {"word": "salesman",        "type": "male",       "suggestion": "salesperson",           "reason": "Gendered job title"},
    {"word": "salesmen",        "type": "male",       "suggestion": "salespeople",           "reason": "Gendered job title"},
    {"word": "spokesman",       "type": "male",       "suggestion": "spokesperson",          "reason": "Gendered job title"},
    {"word": "spokesmen",       "type": "male",       "suggestion": "spokespersons",         "reason": "Gendered job title"},
    {"word": "foreman",         "type": "male",       "suggestion": "foreperson",            "reason": "Gendered job title"},
    {"word": "workman",         "type": "male",       "suggestion": "worker",                "reason": "Gendered term"},
    {"word": "workmen",         "type": "male",       "suggestion": "workers",               "reason": "Gendered term"},
    {"word": "repairman",       "type": "male",       "suggestion": "repair technician",     "reason": "Gendered job title"},
    {"word": "doorman",         "type": "male",       "suggestion": "door attendant",        "reason": "Gendered job title"},
    {"word": "headmaster",      "type": "male",       "suggestion": "principal",             "reason": "Gendered title"},
    {"word": "male employees",  "type": "male",       "suggestion": "employees",             "reason": "Unnecessary gender qualifier"},
    {"word": "male professionals","type": "male",     "suggestion": "professionals",         "reason": "Unnecessary gender qualifier"},
    # Female-gendered job titles
    {"word": "stewardess",      "type": "female",     "suggestion": "flight attendant",      "reason": "Gendered occupational role"},
    {"word": "housewife",       "type": "female",     "suggestion": "homemaker",             "reason": "Gendered term"},
    {"word": "lady doctor",     "type": "female",     "suggestion": "doctor",                "reason": "The 'lady' prefix is unnecessary"},
    {"word": "girl boss",       "type": "female",     "suggestion": "leader",                "reason": "'Girl' is infantilizing for professionals"},
    {"word": "spinster",        "type": "female",     "suggestion": "unmarried person",      "reason": "Gendered and stigmatizing term"},
    {"word": "female employees","type": "female",     "suggestion": "employees",             "reason": "Unnecessary gender qualifier"},
    {"word": "waitress",        "type": "female",     "suggestion": "server",                "reason": "Gendered job title"},
    {"word": "actress",         "type": "female",     "suggestion": "actor",                 "reason": "Gendered job title"},
    {"word": "female professionals","type": "female", "suggestion": "professionals",         "reason": "Unnecessary gender qualifier"},
    # Stereotypes
    {"word": "overly emotional",        "type": "stereotype", "suggestion": "highly expressive",          "reason": "Gendered emotional stereotype"},
    {"word": "bossy",                   "type": "stereotype", "suggestion": "assertive",                   "reason": "Term disproportionately applied to women"},
    {"word": "hysterical",              "type": "stereotype", "suggestion": "overwhelmed",                 "reason": "Historically used to dismiss women's feelings"},
    {"word": "aggressive",              "type": "stereotype", "suggestion": "assertive",                   "reason": "Often applied unfairly by gender context"},
    {"word": "less emotional",          "type": "stereotype", "suggestion": "composed",                    "reason": "Implies men are more rational than women"},
    {"word": "more emotional",          "type": "stereotype", "suggestion": "expressive",                  "reason": "Implies women are less rational"},
    {"word": "men are better",          "type": "male",       "suggestion": "people can excel",            "reason": "Implies male superiority"},
    {"word": "men are natural leaders", "type": "male",       "suggestion": "people can be great leaders", "reason": "Gendered leadership stereotype"},
    {"word": "women are more emotional","type": "stereotype", "suggestion": "people can be emotional",     "reason": "Gendered emotional stereotype"},
    {"word": "women are naturally better","type": "female",   "suggestion": "people can excel",            "reason": "Implies female superiority in certain roles"},
    {"word": "women are better suited", "type": "female",     "suggestion": "individuals are well-suited", "reason": "Gender-based role assignment"},
    {"word": "nurturing",               "type": "female",     "suggestion": "supportive",                  "reason": "Gendered trait stereotype"},
    {"word": "supportive roles",        "type": "stereotype", "suggestion": "various responsibilities",      "reason": "Implies certain people belong in support roles"},
    {"word": "better suited to supportive", "type": "stereotype", "suggestion": "capable of",               "reason": "Gendered role assignment"},
]

# Build a set of known-biased words for fast lookup
_PATTERN_WORDS = {p["word"].lower() for p in BIAS_PATTERNS}


def _pattern_detect(text: str) -> List[Dict]:
    """Always-on: returns all known biased patterns found in text."""
    lower = text.lower()
    return [
        p for p in BIAS_PATTERNS
        if re.search(r'\b' + re.escape(p["word"].lower()) + r'\b', lower)
    ]


def _llm_analyze(text: str) -> Optional[List[Dict]]:
    """
    Calls Llama 3.1 to find contextual bias the patterns can't catch
    (e.g. generic 'he/his', subtle stereotypes). Returns list of detections or None.
    """
    if not HF_API_KEY:
        return None

    prompt = (
        "You are a gender bias detector. Find gender bias in the text below.\n"
        "Return ONLY a JSON array of detected items — no explanation, no markdown.\n\n"
        "Flag ONLY:\n"
        "1. Gendered job titles (chairman, fireman, stewardess, housewife, etc.)\n"
        "2. Generic masculine pronouns for unspecified roles: 'he', 'his', 'him' when "
        "the subject is a job title or unnamed person — suggest 'they', 'their', 'them'\n"
        "3. Clear gender stereotypes ('women are more emotional', 'men are natural leaders')\n\n"
        "Do NOT flag:\n"
        "- Neutral terms: businessperson, chairperson, salesperson, firefighter, police officer, "
        "manager, supervisor, individual, person, people, worker, professional, they/their/them\n"
        "- Any word ending in -person\n"
        "- 'he/his' referring to a specific named male person\n\n"
        "JSON array format (return [] if no bias found):\n"
        '[{"word": "exact phrase from text", "type": "male"|"female"|"stereotype", '
        '"suggestion": "neutral alternative", "reason": "brief explanation"}]\n\n'
        f'Text:\n"{text[:1200]}"'
    )

    try:
        resp = requests.post(
            CHAT_URL,
            headers={"Authorization": f"Bearer {HF_API_KEY}"},
            json={
                "model": LLM_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 600,
                "temperature": 0.05,
            },
            timeout=25,
        )
        raw = resp.json()["choices"][0]["message"]["content"]
        raw = re.sub(r"```(?:json)?", "", raw).strip()

        # Extract JSON array
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if not match:
            return []
        items = json.loads(match.group())
        if not isinstance(items, list):
            return []

        # Validate: word must appear in text, suggestion must differ, type must be valid
        lower = text.lower()
        clean = []
        for d in items:
            w = d.get("word", "").strip()
            s = d.get("suggestion", "").strip()
            if (w
                    and s
                    and w.lower() != s.lower()          # skip word == suggestion (useless)
                    and d.get("type") in VALID_TYPES
                    and d.get("reason")
                    and re.search(r'\b' + re.escape(w.lower()) + r'\b', lower)
                    and w.lower() not in NEUTRAL_TERMS):
                clean.append(d)
        return clean
    except Exception:
        return None


def _merge(patterns: List[Dict], llm_items: List[Dict]) -> List[Dict]:
    """
    Combines pattern matches (always trusted) with LLM findings.
    LLM items are added only if not already covered by a pattern match.
    Filters out any LLM item whose word is in the neutral-terms whitelist.
    """
    seen = {p["word"].lower() for p in patterns}
    merged = list(patterns)
    for d in llm_items:
        w = d.get("word", "").lower()
        # Skip if already caught by pattern, or if it's a known neutral term
        if w not in seen and w not in NEUTRAL_TERMS and w not in _PATTERN_WORDS:
            seen.add(w)
            merged.append(d)
    return merged


def _score(detected: List[Dict]) -> tuple:
    """Returns (label, score) from the merged detection list."""
    male   = sum(1 for d in detected if d.get("type") == "male")
    female = sum(1 for d in detected if d.get("type") == "female")
    stereo = sum(1 for d in detected if d.get("type") == "stereotype")
    n = len(detected)

    if n == 0:
        return "GENDER-NEUTRAL", 0
    if male > female:
        label = "MALE-BIASED"
    elif female > male:
        label = "FEMALE-BIASED"
    else:
        label = "MIXED-BIAS"

    # Score based purely on detection count (not LLM guess)
    if n == 1:   score = 20
    elif n == 2: score = 35
    elif n == 3: score = 50
    elif n == 4: score = 60
    elif n == 5: score = 70
    elif n == 6: score = 78
    elif n == 7: score = 84
    else:        score = min(95, 84 + (n - 7) * 3)

    return label, score


def analyze(text: str) -> dict:
    words = len(text.strip().split()) if text.strip() else 0

    # Step 1: always run pattern matching
    patterns = _pattern_detect(text)

    # Step 2: run LLM for contextual bias (pronouns, stereotypes)
    llm_items = _llm_analyze(text)
    ai_powered = llm_items is not None

    # Step 3: merge — patterns are ground truth, LLM adds context-aware findings.
    # Use `is not None` so an explicit [] (LLM found nothing) still triggers
    # the merge path and correctly overrides pattern-only results with ai_powered=True.
    if llm_items is not None:
        detected = _merge(patterns, llm_items)
    else:
        detected = patterns

    # Step 4: score
    label, score = _score(detected)
    male   = sum(1 for d in detected if d.get("type") == "male")
    female = sum(1 for d in detected if d.get("type") == "female")
    stereo = sum(1 for d in detected if d.get("type") == "stereotype")

    return {
        "detected":   detected,
        "male":       male,
        "female":     female,
        "stereo":     stereo,
        "label":      label,
        "score":      score,
        "color":      COLOR_MAP[label],
        "words":      words,
        "ai_powered": ai_powered,
    }
