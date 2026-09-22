import re
import os
import json
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional, List, Dict
from dotenv import load_dotenv

load_dotenv()

# .strip() guards against a trailing newline/whitespace sneaking into the env
# var value (e.g. from a copy-paste into a hosting platform's dashboard) —
# that alone is enough to make `requests` reject the Authorization header
# outright, silently degrading every analysis to rule-based-only detection.
HF_API_KEY = os.getenv("HF_API_KEY", "").strip()
LLM_MODEL  = "meta-llama/Llama-3.1-8B-Instruct"
CHAT_URL   = "https://router.huggingface.co/v1/chat/completions"

# ── LLM chunking config ────────────────────────────────────────────────────────
# Llama 3.1 8B's context window is large, but we deliberately keep each request
# small: it keeps latency/cost predictable and the model focused. Text longer
# than one chunk is split (never truncated) and every chunk is sent as its own
# request; findings from all chunks are merged. LLM_MAX_CHUNKS is a safety
# ceiling on total API calls per analysis (~36,000 chars / ~6,000 words) — the
# rule-based pattern layer below has no such limit and always covers the full
# text regardless of length.
LLM_CHUNK_CHAR_LIMIT = 3000
LLM_MAX_CHUNKS       = 12
LLM_MAX_WORKERS      = 5

COLOR_MAP = {
    "MALE-BIASED":    "#3B82F6",
    "FEMALE-BIASED":  "#F43F5E",
    "GENDER-NEUTRAL": "#0D9488",
}

VALID_TYPES = {"male", "female"}

# ── Last LLM failure reason (bad key, network error, etc) — logged via print
# in _llm_analyze/_llm_analyze_chunk below so it shows up in server logs
# instead of being indistinguishable from "the LLM found nothing". ───────────
_last_llm_error = None

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
    {"word": "women are more emotional","type": "female",     "suggestion": "people can be emotional",     "reason": "Gendered emotional stereotype"},
    {"word": "women are naturally better","type": "female",   "suggestion": "people can excel",            "reason": "Implies female superiority in certain roles"},
    {"word": "women are better suited", "type": "female",     "suggestion": "individuals are well-suited", "reason": "Gender-based role assignment"},
    {"word": "nurturing",               "type": "female",     "suggestion": "supportive",                  "reason": "Gendered trait stereotype"},
    {"word": "supportive roles",        "type": "stereotype", "suggestion": "various responsibilities",      "reason": "Implies certain people belong in support roles"},
    {"word": "better suited to supportive", "type": "stereotype", "suggestion": "capable of",               "reason": "Gendered role assignment"},
]

# Build a set of known-biased words for fast lookup
_PATTERN_WORDS = {p["word"].lower() for p in BIAS_PATTERNS}

# ── Context-dependent stereotype words ────────────────────────────────────────
# These are ordinary English words/adjectives with plenty of non-gendered uses
# ("the aggressive dog", "nurturing the garden", "a bossy toddler"). Flagging
# them on a bare word match — regardless of what they're describing — produces
# false positives. They're only kept as candidates when a person/gender word
# appears nearby, so the sentence is actually about a person. Explicit gendered
# nouns, job titles, and full gendered statements ("men are better", etc.) are
# unambiguous on their own and don't need this check.
_CONTEXT_DEPENDENT_WORDS = {
    "overly emotional", "bossy", "hysterical", "aggressive",
    "less emotional", "more emotional", "nurturing",
    "supportive roles", "better suited to supportive",
}

_FEMALE_CONTEXT_WORDS = {
    "she", "her", "hers", "herself", "woman", "women", "girl", "girls", "female", "females", "lady", "ladies",
}
_MALE_CONTEXT_WORDS = {
    "he", "him", "his", "himself", "man", "men", "boy", "boys", "male", "males", "gentleman", "gentlemen",
}
_PERSON_CONTEXT_WORDS = _FEMALE_CONTEXT_WORDS | _MALE_CONTEXT_WORDS | {
    "they", "them", "their", "theirs", "themselves",
    "employee", "employees", "worker", "workers", "candidate", "candidates", "colleague", "colleagues",
    "manager", "leader", "leaders", "staff", "person", "people", "someone", "individual",
    "boss", "director", "president", "executive", "ceo", "chairman", "chairperson",
}

_CONTEXT_WINDOW = 60  # chars scanned on each side of a match for a person/gender reference


def _has_person_context(text: str, start: int, end: int) -> bool:
    """True if a person/gender-referring word appears within _CONTEXT_WINDOW
    characters of the match, i.e. the sentence is actually describing a
    person — not an unrelated use of the same word."""
    window = text[max(0, start - _CONTEXT_WINDOW): end + _CONTEXT_WINDOW].lower()
    return any(re.search(r'\b' + w + r'\b', window) for w in _PERSON_CONTEXT_WORDS)


def _context_gender(text: str, start: int, end: int) -> Optional[str]:
    """Returns 'female' or 'male' based on the nearest gendered pronoun/noun
    around a match, or None if the context doesn't clearly lean either way
    (e.g. the subject is 'they', 'the employee', or ungendered). Used to
    attribute a direction to stereotype-type findings ('aggressive', 'bossy')
    that carry no gender of their own — their bias direction comes entirely
    from who the sentence is describing."""
    window = text[max(0, start - _CONTEXT_WINDOW): end + _CONTEXT_WINDOW].lower()
    is_female = any(re.search(r'\b' + w + r'\b', window) for w in _FEMALE_CONTEXT_WORDS)
    is_male   = any(re.search(r'\b' + w + r'\b', window) for w in _MALE_CONTEXT_WORDS)
    if is_female and not is_male:
        return "female"
    if is_male and not is_female:
        return "male"
    return None  # both, or neither, present — genuinely ambiguous


def _effective_gender(d: Dict) -> Optional[str]:
    """The gender a detected item counts toward for classification. Every
    detected item's type is resolved to "male"/"female" at detection time
    (stereotype-flavored matches included — see _pattern_detect/_llm_analyze_chunk),
    so this is just the type itself."""
    return d.get("type")


def _pattern_detect(text: str) -> List[Dict]:
    """Returns known biased patterns found in text. Context-dependent stereotype
    words (see _CONTEXT_DEPENDENT_WORDS) are only counted when a person/gender
    word appears nearby, so common non-gendered uses aren't flagged just
    because the word itself is in the lexicon."""
    lower = text.lower()
    found = []
    for p in BIAS_PATTERNS:
        w = p["word"].lower()
        match = re.search(r'\b' + re.escape(w) + r'\b', lower)
        if not match:
            continue
        if w in _CONTEXT_DEPENDENT_WORDS:
            if not _has_person_context(text, match.start(), match.end()):
                continue
            # "nurturing" is often a verb with a direct object ("nurturing the
            # garden", "nurturing her plants") rather than a personality trait
            # ("a nurturing person") — an article/possessive right after it is
            # the verb form, so skip it even if a person word is elsewhere
            # in the sentence.
            if w == "nurturing" and re.match(
                r'\s+(the|a|an|his|her|their|its|your|my)\b', lower[match.end():match.end() + 12]
            ):
                continue
            if p["type"] == "stereotype":
                # Stereotype is a source-list grouping, not an output category —
                # resolve directly to whichever gender the stereotype targets in
                # context, same tie-break as _score() when direction is ambiguous.
                p = {**p, "type": _context_gender(text, match.start(), match.end()) or "male"}
        found.append(p)
    return found


def _split_long_unit(unit: str, max_chars: int) -> List[str]:
    """Last-resort split of a single unit (e.g. one very long sentence) at word
    boundaries, so no chunk ever exceeds max_chars. Never cuts mid-word."""
    if len(unit) <= max_chars:
        return [unit]
    words = unit.split(' ')
    chunks, current = [], ''
    for w in words:
        candidate = f'{current} {w}'.strip()
        if len(candidate) > max_chars and current:
            chunks.append(current)
            current = w
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks


def _chunk_text(text: str, max_chars: int) -> List[str]:
    """Splits text into LLM-sized chunks without ever truncating content.
    Prefers paragraph, then sentence, boundaries so each chunk stays coherent
    for the model; only falls back to a hard word-boundary split for a single
    unit (paragraph/sentence) that's still too long on its own."""
    if len(text) <= max_chars:
        return [text]

    paragraphs = [p for p in re.split(r'\n\s*\n', text) if p.strip()] or [text]

    units = []
    for para in paragraphs:
        if len(para) <= max_chars:
            units.append(para)
        else:
            for sentence in re.split(r'(?<=[.!?])\s+', para):
                units.extend(_split_long_unit(sentence, max_chars))

    chunks, current = [], ''
    for unit in units:
        candidate = f'{current}\n\n{unit}'.strip() if current else unit
        if len(candidate) > max_chars and current:
            chunks.append(current)
            current = unit
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks


def _llm_analyze_chunk(text: str) -> Optional[List[Dict]]:
    """
    Calls Llama 3.1 once on a single chunk to find contextual bias the patterns
    can't catch (e.g. generic 'he/his', subtle stereotypes).
    Returns a list of detections, [] if the model found nothing, or None if the
    request itself failed (network error, bad response, timeout, etc).
    """
    prompt = (
        "You are a gender bias detector. Read the text below CAREFULLY and find only "
        "genuine gender bias — judge each candidate by its actual sentence context, "
        "never by the word alone.\n"
        "Return ONLY a JSON array of detected items — no explanation, no markdown.\n\n"
        "Flag ONLY when context clearly shows bias:\n"
        "1. Gendered job titles (chairman, fireman, stewardess, housewife, etc.)\n"
        "2. Generic masculine pronouns for unspecified roles: 'he', 'his', 'him' when "
        "the subject is a job title or unnamed person — suggest 'they', 'their', 'them'\n"
        "3. A gender (even a single word like 'Men' or 'Women') used to claim a trait, "
        "role, or expectation applies to that gender specifically "
        "(e.g. 'Men are expected to be strong leaders', 'Women should be nurturing')\n"
        "4. A stereotype applied to a specific person or group based on their gender "
        "('she was too emotional', 'he needs to be more aggressive to lead') — set "
        "type to whichever gender the stereotype targets in context\n\n"
        "Do NOT flag:\n"
        "- Neutral terms: businessperson, chairperson, salesperson, firefighter, police officer, "
        "manager, supervisor, individual, person, people, worker, professional, they/their/them\n"
        "- Any word ending in -person\n"
        "- 'he/his' referring to a specific named male person\n"
        "- Words like 'aggressive', 'nurturing', 'bossy', 'emotional' when describing something "
        "other than a person (e.g. 'aggressive marketing', 'nurturing the plants')\n"
        "- A word just because it CAN be gendered — only flag it if this sentence's context "
        "is actually about gender or a person's gender\n\n"
        "For each item, write a SHORT reason (max ~12 words) explaining why THIS specific "
        "occurrence is biased, based on what the sentence actually says — never a generic "
        "dictionary definition. Example: in 'Men are often expected to be strong leaders', "
        "the reason for 'Men' is \"Suggests only men are expected to be strong leaders.\"\n\n"
        "JSON array format (return [] if no bias found):\n"
        '[{"word": "exact phrase from text", "type": "male"|"female", '
        '"suggestion": "neutral alternative", "reason": "short, specific reason"}]\n\n'
        f'Text:\n"{text}"'
    )

    try:
        resp = requests.post(
            CHAT_URL,
            headers={"Authorization": f"Bearer {HF_API_KEY}"},
            json={
                "model": LLM_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 700,
                "temperature": 0.05,
            },
            timeout=20,
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

        # Validate: word must appear in this chunk, suggestion must differ, type must be valid
        lower = text.lower()
        clean = []
        for d in items:
            w = d.get("word", "").strip()
            s = d.get("suggestion", "").strip()
            match = re.search(r'\b' + re.escape(w.lower()) + r'\b', lower) if w else None
            # The prompt asks for "male"/"female" directly, but defensively
            # resolve "stereotype" too in case the model emits it anyway —
            # same context-based resolution as pattern-based stereotypes,
            # so a detection is never dropped just for using the old label.
            item_type = d.get("type")
            if item_type == "stereotype" and match:
                item_type = _context_gender(text, match.start(), match.end()) or "male"
            if (w
                    and s
                    and w.lower() != s.lower()          # skip word == suggestion (useless)
                    and item_type in VALID_TYPES
                    and d.get("reason")
                    and match
                    and w.lower() not in NEUTRAL_TERMS):
                clean.append({**d, "type": item_type})
        return clean
    except Exception as e:
        # Silently returning None here used to make LLM failures indistinguishable
        # from "found nothing" — log the actual cause (bad/expired key, rate limit,
        # network error, unexpected response shape) so it shows up in server logs
        # instead of only being diagnosable by comparing prod vs. local behavior.
        global _last_llm_error
        _last_llm_error = f"{type(e).__name__}: {e}"
        print(f"[analyzer] LLM chunk request failed: {_last_llm_error}")
        return None


def _llm_analyze(text: str) -> Optional[List[Dict]]:
    """
    Runs the LLM over the full text, transparently chunking when the text is
    too long for one request (previously this just silently truncated to the
    first ~1200 characters — long submissions never got contextual analysis
    past that point). Findings from every chunk are combined and deduplicated
    by word. Returns None only if every chunk's request failed, so callers can
    still tell "LLM unavailable" apart from "LLM ran and found nothing".
    """
    if not HF_API_KEY:
        global _last_llm_error
        _last_llm_error = "HF_API_KEY not set"
        print("[analyzer] WARNING: HF_API_KEY not set — falling back to rule-based detection only (no contextual/LLM coverage).")
        return None

    chunks = _chunk_text(text, LLM_CHUNK_CHAR_LIMIT)[:LLM_MAX_CHUNKS]

    if len(chunks) == 1:
        return _llm_analyze_chunk(chunks[0])

    combined: List[Dict] = []
    seen_words = set()
    any_succeeded = False

    with ThreadPoolExecutor(max_workers=min(len(chunks), LLM_MAX_WORKERS)) as pool:
        futures = [pool.submit(_llm_analyze_chunk, chunk) for chunk in chunks]
        for future in as_completed(futures):
            items = future.result()
            if items is None:
                continue  # this chunk's request failed — skip it, other chunks still count
            any_succeeded = True
            for d in items:
                w = d.get("word", "").lower()
                if w and w not in seen_words:
                    seen_words.add(w)
                    combined.append(d)

    return combined if any_succeeded else None


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
    """Returns (label, score) from the merged detection list.
    Only three classifications exist — Male-Biased, Female-Biased, and
    Gender-Neutral — no fourth "Mixed" category. Every item is already
    resolved to "male" or "female" by the time it reaches here (stereotype-
    flavored words like 'aggressive'/'bossy' included — see _pattern_detect),
    so _effective_gender() is just reading that type. When male and female
    counts are exactly tied (n=0 included), it resolves deterministically to
    Male-Biased."""
    male   = sum(1 for d in detected if _effective_gender(d) == "male")
    female = sum(1 for d in detected if _effective_gender(d) == "female")
    n = len(detected)

    if n == 0:
        return "GENDER-NEUTRAL", 0
    label = "FEMALE-BIASED" if female > male else "MALE-BIASED"

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

    # Step 4: score — male/female counts use _effective_gender() so they stay
    # consistent with the label (see _score's docstring)
    label, score = _score(detected)
    male   = sum(1 for d in detected if _effective_gender(d) == "male")
    female = sum(1 for d in detected if _effective_gender(d) == "female")

    return {
        "detected":   detected,
        "male":       male,
        "female":     female,
        "label":      label,
        "score":      score,
        "color":      COLOR_MAP[label],
        "words":      words,
        "ai_powered": ai_powered,
    }
