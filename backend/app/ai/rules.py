"""Deterministic keyword triage. This is the fallback when the model is unavailable and the
baseline the model's answer is shown next to (spec §11.2: rule-based, honest about it)."""
from __future__ import annotations

import re

FALLBACK_BASIS = "fallback: keyword rules"
HUMAN_DECIDES = ("Advisory only. A staff member or responder confirms type, count and urgency before acting; "
                 "sensor rules open and close alerts, this output never does.")

INCIDENT_TYPES = ("fire", "trapped", "medical", "water", "other", "safe")
URGENCY_BY_TYPE = {"fire": 1, "trapped": 1, "medical": 2, "water": 3, "other": 4, "safe": 4}

# Ordered by priority: the first type with a hit wins.
TYPE_KEYWORDS: dict[str, tuple[str, ...]] = {
    "fire": ("fire", "smoke", "burning", "flames", "flame", "fuego", "incendio", "humo", "quemando", "llamas"),
    "trapped": ("trapped", "stuck", "pinned", "can't get out", "cannot get out", "collapsed", "collapse", "jammed",
                "atrapado", "atrapada", "atrapados", "atrapadas", "atascado", "atascada", "no puedo salir",
                "no podemos salir", "derrumbe", "derrumbó", "encerrado", "encerrados"),
    "medical": ("hurt", "injured", "injury", "bleeding", "unconscious", "not breathing", "breathing", "broken",
                "seizure", "chest pain", "herido", "heridos", "herida", "sangre", "sangrando", "lastimado", "lastimada",
                "inconsciente", "no respira", "desmayó", "desmayado", "fractura"),
    "water": ("water", "thirsty", "flood", "flooding", "agua", "sed", "inundación", "inundacion", "inundado"),
    "safe": ("we are safe", "we're safe", "all safe", "everyone is safe", "all good", "we are ok", "we're ok",
             "estamos bien", "a salvo", "todos bien", "estamos seguros", "todos a salvo"),
}

HAZARD_KEYWORDS: dict[str, tuple[str, ...]] = {
    "fire": ("fire", "flames", "flame", "burning", "fuego", "incendio", "llamas", "quemando"),
    "smoke": ("smoke", "humo"),
    "gas": ("gas", "propane", "chemical", "fumes", "químico", "quimico"),
    "structural collapse": ("collapse", "collapsed", "ceiling", "derrumbe", "derrumbó", "techo"),
    "electrical": ("electrical", "wires", "sparks", "eléctrico", "electrico", "cables", "chispas"),
    "flooding": ("flood", "flooding", "inundación", "inundacion", "inundado"),
    "blocked exit": ("blocked", "jammed", "locked", "bloqueado", "bloqueada", "atascado", "cerrado con llave"),
}

ACCESS_KEYWORDS = ("door", "stairs", "stairwell", "hallway", "room", "floor", "exit", "gate", "window", "locked",
                   "blocked", "jammed", "behind", "puerta", "escalera", "escaleras", "pasillo", "salón", "salon",
                   "cuarto", "piso", "salida", "ventana", "bloqueado", "bloqueada", "cerrado", "detrás")

SPANISH_MARKERS = ("el", "la", "los", "las", "de", "en", "y", "con", "por", "para", "hay", "está", "estamos", "somos",
                   "nosotros", "que", "un", "una", "del", "al", "no", "puedo", "podemos", "niños", "niñas", "ayuda",
                   "favor", "aquí", "aqui", "personas", "gente", "fuego", "humo", "atrapados", "heridos", "agua")
ENGLISH_MARKERS = ("the", "is", "are", "we", "in", "and", "there", "a", "an", "of", "to", "with", "help", "please",
                   "people", "kids", "students", "here", "on", "at", "can't", "fire", "smoke", "trapped", "hurt")

NUMBER_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "fifteen": 15, "twenty": 20, "thirty": 30, "a dozen": 12,
    "uno": 1, "una": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5, "seis": 6, "siete": 7, "ocho": 8, "nueve": 9,
    "diez": 10, "once": 11, "doce": 12, "quince": 15, "veinte": 20, "treinta": 30,
}
PEOPLE_WORDS = ("people", "person", "kids", "kid", "children", "child", "students", "student", "adults", "adult",
                "teachers", "teacher", "of us", "personas", "persona", "niños", "niñas", "niño", "niña", "gente",
                "estudiantes", "alumnos", "alumnas", "adultos", "maestros", "maestras", "de nosotros")

_WORD_RE = re.compile(r"[a-záéíóúñü']+", re.IGNORECASE)
MAX_COUNT = 500


def _norm(text: str) -> str:
    return " ".join(text.lower().split())


def detect_language(text: str) -> str:
    words = set(_WORD_RE.findall(text.lower()))
    if not words:
        return "unknown"
    es = sum(1 for w in words if w in SPANISH_MARKERS)
    en = sum(1 for w in words if w in ENGLISH_MARKERS)
    if es == 0 and en == 0:
        return "unknown"
    return "es" if es > en else "en"


def classify_type(text: str) -> str | None:
    low = _norm(text)
    for kind, keys in TYPE_KEYWORDS.items():
        if any(k in low for k in keys):
            return kind
    return None


def extract_count(text: str) -> int | None:
    """First number that sits next to a people word; else the first number at all; else None."""
    low = _norm(text)
    candidates: list[tuple[int, int]] = []          # (position, value)
    for m in re.finditer(r"\b(\d{1,3})\b", low):
        candidates.append((m.start(), int(m.group(1))))
    for word, value in NUMBER_WORDS.items():
        for m in re.finditer(rf"\b{re.escape(word)}\b", low):
            candidates.append((m.start(), value))
    if not candidates:
        return None
    candidates.sort()
    for pos, value in candidates:
        window = low[pos: pos + 40]
        if any(p in window for p in PEOPLE_WORDS):
            return max(1, min(value, MAX_COUNT))
    return max(1, min(candidates[0][1], MAX_COUNT))


def extract_hazards(text: str) -> list[str]:
    low = _norm(text)
    return [name for name, keys in HAZARD_KEYWORDS.items() if any(k in low for k in keys)]


def extract_access_notes(text: str) -> str:
    parts = [p.strip() for p in re.split(r"[.;\n!?]+", text) if p.strip()]
    hits = [p for p in parts if any(k in p.lower() for k in ACCESS_KEYWORDS)]
    return " / ".join(hits)[:300]


def triage(text: str, reported_type: str | None = None, reported_count: int | None = None) -> dict:
    """Never raises. Reporter-supplied type/count win when the text gives no signal."""
    text = text if isinstance(text, str) else str(text or "")
    kind = classify_type(text) or (reported_type if reported_type in INCIDENT_TYPES else None) or "other"
    count = extract_count(text)
    if count is None:
        count = reported_count if isinstance(reported_count, int) and reported_count > 0 else 1
    hazards = extract_hazards(text)
    language = detect_language(text)
    quoted = text.strip().replace('"', "'")[:400]
    matched = [k for k in TYPE_KEYWORDS.get(kind, ()) if k in _norm(text)]
    gloss = f" Keyword match: {', '.join(matched[:4])}." if matched else " No emergency keywords matched."
    summary = f'Reporter wrote: "{quoted}".{gloss} Rule reading: {kind}, {count} people.'
    if language == "es":
        summary += " Original is Spanish; not translated in fallback mode."
    return {
        "type": kind,
        "count": count,
        "people_detail": _people_detail(text),
        "hazards": hazards,
        "access_notes": extract_access_notes(text),
        "urgency": URGENCY_BY_TYPE[kind],
        "language_detected": language,
        "english_summary": summary,
        "basis": FALLBACK_BASIS,
        "human_decides": HUMAN_DECIDES,
    }


def _people_detail(text: str) -> str:
    low = _norm(text)
    found = [p for p in PEOPLE_WORDS if re.search(rf"\b{re.escape(p)}\b", low)]
    return ", ".join(dict.fromkeys(found)) if found else ""
