import re
import os
import json
import requests
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

# ── analyzer.py — NLP bias analysis engine ────────────────────────────────────
# Two-layer approach:
#   1. LLM (Llama 3.1 via HuggingFace router) — primary, context-aware analysis.
#      Detects bias in any phrasing, not just known keywords.
#   2. Pattern matching — fallback when LLM is unavailable or times out.

HF_API_KEY  = os.getenv("HF_API_KEY", "")
LLM_MODEL   = "meta-llama/Llama-3.1-8B-Instruct"
CHAT_URL    = "https://router.huggingface.co/v1/chat/completions"
ZS_URL      = "https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli"

COLOR_MAP = {
    "MALE-BIASED":    "#3B82F6",
    "FEMALE-BIASED":  "#F43F5E",
    "GENDER-NEUTRAL": "#0D9488",
    "MIXED-BIAS":     "#F59E0B",
}

VALID_TYPES = {"male", "female", "stereotype"}

# ── BIAS_PATTERNS — keyword fallback when LLM is unavailable ─────────────────
BIAS_PATTERNS = [
    {"word": "chairman",          "type": "male",       "suggestion": "chairperson",           "reason": "Gendered occupational title"},
    {"word": "manpower",          "type": "male",       "suggestion": "workforce",              "reason": "Male-centric compound noun"},
    {"word": "businessman",       "type": "male",       "suggestion": "business professional",  "reason": "Gendered occupational term"},
    {"word": "fireman",           "type": "male",       "suggestion": "firefighter",            "reason": "Gendered occupational term"},
    {"word": "policeman",         "type": "male",       "suggestion": "police officer",         "reason": "Gendered job title"},
    {"word": "mankind",           "type": "male",       "suggestion": "humankind",              "reason": "Gender-exclusive term"},
    {"word": "man-made",          "type": "male",       "suggestion": "artificial",             "reason": "Gender-exclusive compound"},
    {"word": "mailman",           "type": "male",       "suggestion": "mail carrier",           "reason": "Gendered job title"},
    {"word": "congressman",       "type": "male",       "suggestion": "congressperson",         "reason": "Gendered political title"},
    {"word": "cameraman",         "type": "male",       "suggestion": "camera operator",        "reason": "Gendered job title"},
    {"word": "salesman",          "type": "male",       "suggestion": "salesperson",            "reason": "Gendered job title"},
    {"word": "spokesman",         "type": "male",       "suggestion": "spokesperson",           "reason": "Gendered job title"},
    {"word": "men are better",    "type": "male",       "suggestion": "people can excel",       "reason": "Implies male superiority"},
    {"word": "men should be given priority", "type": "male", "suggestion": "candidates should be evaluated equally", "reason": "Gender-based hiring preference"},
    {"word": "more appropriate for men", "type": "male", "suggestion": "suited for skilled individuals", "reason": "Gender-based job suitability claim"},
    {"word": "male employees",    "type": "male",       "suggestion": "employees",              "reason": "Unnecessary gender qualifier"},
    {"word": "male professionals","type": "male",       "suggestion": "professionals",          "reason": "Unnecessary gender qualifier"},
    {"word": "stewardess",        "type": "female",     "suggestion": "flight attendant",       "reason": "Gendered occupational role"},
    {"word": "housewife",         "type": "female",     "suggestion": "homemaker",              "reason": "Gendered term"},
    {"word": "lady doctor",       "type": "female",     "suggestion": "doctor",                 "reason": "The 'lady' prefix is unnecessary"},
    {"word": "girl boss",         "type": "female",     "suggestion": "leader",                 "reason": "'Girl' is infantilizing for professionals"},
    {"word": "spinster",          "type": "female",     "suggestion": "unmarried person",       "reason": "Gendered and stigmatizing term"},
    {"word": "women are naturally better", "type": "female", "suggestion": "people can excel",  "reason": "Implies female superiority"},
    {"word": "women should be given priority", "type": "female", "suggestion": "candidates should be evaluated equally", "reason": "Gender-based hiring preference"},
    {"word": "more suitable for women", "type": "female", "suggestion": "suited for skilled individuals", "reason": "Gender-based job suitability claim"},
    {"word": "trust in female professionals", "type": "female", "suggestion": "trust in qualified professionals", "reason": "Gender-based trust bias"},
    {"word": "women are better suited", "type": "female", "suggestion": "individuals are well-suited", "reason": "Gender-based role assignment"},
    {"word": "female employees",  "type": "female",     "suggestion": "employees",              "reason": "Unnecessary gender qualifier"},
    {"word": "overly emotional",  "type": "stereotype", "suggestion": "highly expressive",      "reason": "Gendered emotional stereotype"},
    {"word": "bossy",             "type": "stereotype", "suggestion": "assertive",              "reason": "Term disproportionately applied to women"},
    {"word": "hysterical",        "type": "stereotype", "suggestion": "overwhelmed",            "reason": "Historically used to dismiss women's feelings"},
    {"word": "nurturing",         "type": "female",     "suggestion": "supportive",             "reason": "Gendered trait stereotype"},
    {"word": "aggressive",        "type": "stereotype", "suggestion": "assertive",              "reason": "Often applied unfairly by gender context"},
    {"word": "less emotional",    "type": "stereotype", "suggestion": "composed",               "reason": "Implies men are more rational than women"},
    {"word": "more emotional",    "type": "stereotype", "suggestion": "expressive",             "reason": "Implies women are less less rational"},
]


def _llm_analyze(text: str) -> Optional[dict]:
    """
    Sends text to Llama 3.1 via HuggingFace and asks for structured JSON bias analysis.
    Returns parsed dict or None on any failure.
    """
    if not HF_API_KEY:
        return None

    prompt = (
        "You are a gender bias detector. Analyze the text below and return ONLY a JSON object — no explanation, no markdown.\n\n"
        "What to flag (examples):\n"
        "- Gendered job titles: chairman→chairperson, fireman→firefighter, stewardess→flight attendant, housewife→homemaker\n"
        "- Generic masculine pronouns referring to a role: 'he', 'his', 'him' when the referent is a job title or unspecified person → suggest 'they', 'their', 'them'\n"
        "- Gendered words: mankind→humankind, manpower→workforce\n"
        "- Stereotypes: 'women are more emotional', 'men are natural leaders'\n\n"
        "What NOT to flag:\n"
        "- Already neutral terms: businessperson, chairperson, salesperson, firefighter, police officer, workforce, they/their/them\n"
        "- Any -person compound words\n"
        "- 'he' or 'his' referring to a specific named male character\n"
        "- Neutral job titles\n\n"
        "Scoring:\n"
        "- 0 detected items → score MUST be 0, classification MUST be GENDER-NEUTRAL\n"
        "- 1-2 items → score 10-30\n"
        "- 3-5 items → score 40-65\n"
        "- 6+ items → score 66-95\n\n"
        "Required JSON format:\n"
        "{\n"
        '  "classification": "MALE-BIASED" or "FEMALE-BIASED" or "MIXED-BIAS" or "GENDER-NEUTRAL",\n'
        '  "score": integer 0 to 95,\n'
        '  "detected": [\n'
        '    {"word": "exact phrase from the text", "type": "male" or "female" or "stereotype", '
        '"suggestion": "neutral alternative", "reason": "brief explanation"}\n'
        "  ]\n"
        "}\n\n"
        f'Text:\n"{text[:1000]}"'
    )

    try:
        resp = requests.post(
            CHAT_URL,
            headers={"Authorization": f"Bearer {HF_API_KEY}"},
            json={
                "model": LLM_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 700,
                "temperature": 0.1,
            },
            timeout=30,
        )
        raw = resp.json()["choices"][0]["message"]["content"]

        # Strip markdown code fences if present
        raw = re.sub(r"```(?:json)?", "", raw).strip()

        # Extract JSON object
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not match:
            return None
        result = json.loads(match.group())

        # Validate classification
        if result.get("classification") not in COLOR_MAP:
            return None

        # Keep only detected items whose phrase actually appears in the text
        # using word-boundary matching to avoid "he" matching inside "the"/"they".
        lower = text.lower()
        filtered = []
        for d in result.get("detected", []):
            w = d.get("word", "")
            if (w and d.get("type") in VALID_TYPES
                    and d.get("suggestion") and d.get("reason")
                    and re.search(r'\b' + re.escape(w.lower()) + r'\b', lower)):
                filtered.append(d)
        result["detected"] = filtered

        return result
    except Exception:
        return None


def _pattern_analyze(text: str) -> dict:
    """Keyword-based fallback analysis."""
    lower = text.lower()
    detected = [p for p in BIAS_PATTERNS if re.search(r'\b' + re.escape(p["word"].lower()) + r'\b', lower)]
    male   = sum(1 for p in detected if p["type"] == "male")
    female = sum(1 for p in detected if p["type"] == "female")
    stereo = sum(1 for p in detected if p["type"] == "stereotype")

    if male > female and male > 0:
        label = "MALE-BIASED";  score = min(95, 40 + male * 15 + stereo * 8)
    elif female > male and female > 0:
        label = "FEMALE-BIASED"; score = min(95, 40 + female * 15 + stereo * 8)
    elif detected:
        label = "MIXED-BIAS";   score = min(95, 28 + len(detected) * 10)
    else:
        label = "GENDER-NEUTRAL"; score = 0

    return {"detected": detected, "label": label, "score": score,
            "male": male, "female": female, "stereo": stereo}


def _normalize_result(result: dict) -> dict:
    """Derive a consistent label and score from validated detections."""
    detected = result.get("detected", [])
    male     = sum(1 for d in detected if d.get("type") == "male")
    female   = sum(1 for d in detected if d.get("type") == "female")
    stereo   = sum(1 for d in detected if d.get("type") == "stereotype")

    if not detected:
        return {
            "detected": [],
            "male": 0,
            "female": 0,
            "stereo": 0,
            "label": "GENDER-NEUTRAL",
            "score": 0,
        }

    if male > female and male > 0:
        label = "MALE-BIASED"
    elif female > male and female > 0:
        label = "FEMALE-BIASED"
    else:
        label = "MIXED-BIAS"

    try:
        raw_score = int(result.get("score", 0))
    except (TypeError, ValueError):
        raw_score = 0

    fallback_score = min(95, 28 + len(detected) * 10) if label == "MIXED-BIAS" else min(95, 40 + max(male, female) * 15 + stereo * 8)
    score = min(95, max(1, raw_score or fallback_score))

    return {
        "detected": detected,
        "male": male,
        "female": female,
        "stereo": stereo,
        "label": label,
        "score": score,
    }


def analyze(text: str) -> dict:
    words = len(text.strip().split()) if text.strip() else 0

    # ── Try LLM first ────────────────────────────────────────────────────────
    llm = _llm_analyze(text)

    if llm:
        normalized = _normalize_result(llm)
        label      = normalized["label"]
        return {
            "detected":   normalized["detected"],
            "male":       normalized["male"],
            "female":     normalized["female"],
            "stereo":     normalized["stereo"],
            "label":      label,
            "score":      normalized["score"],
            "color":      COLOR_MAP[label],
            "words":      words,
            "ai_powered": True,
        }

    # ── Fallback: pattern matching ────────────────────────────────────────────
    p = _pattern_analyze(text)
    return {
        "detected":   p["detected"],
        "male":       p["male"],
        "female":     p["female"],
        "stereo":     p["stereo"],
        "label":      p["label"],
        "score":      min(95, max(0, p["score"])),
        "color":      COLOR_MAP[p["label"]],
        "words":      words,
        "ai_powered": False,
    }
