"""Cloud tiers for voice entry: Gemini hears the audio directly; Groq transcribes it with
Whisper and then reads the text. Both return the same small JSON, which is cleaned here.

The model only proposes. Every amount is checked against the words in the transcript
(see numbers.py), the name is matched by our own matcher, and nothing is saved until the
shopkeeper taps "Haan, likh do".
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Any

from app.core import gemini_models
from app.core.config import settings
from app.voice.text_parser import Understanding

logger = logging.getLogger(__name__)

INTENTS = {"udhaar", "wasooli", "kharcha", "question", "unknown"}
METHODS = {"cash", "easypaisa", "jazzcash", "bank"}
CATEGORIES = {"rent", "electricity", "salaries", "transport", "general", "owner_drawings", "bank_deposit"}
WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

PROMPT = """You help the owner of a small Pakistani general store (karyana) keep the shop's books by voice.
You get ONE short thing the owner said (a recording or typed text). It may be Urdu, Punjabi, Roman Urdu or English, often mixed.
Return JSON only, with these fields:

- transcript_urdu: exactly what was said, in Urdu script. Keep amounts as said (spoken words stay words, digits stay digits).
- transcript_roman: the same words in Roman Urdu, the way Pakistanis type on their phones.
- intent:
  "udhaar"  = a person took goods or cash from the shop on credit ("le gaya", "udhaar", "qarz").
  "wasooli" = a customer paid money back to the shop ("wapas diye", "de gaya", "jama karwaye").
  "kharcha" = the shop paid a cost from the cash drawer (bijli bill, rent, salary, rickshaw), or the owner took cash home, or deposited cash in the bank.
  "question" = the owner is ASKING something about the shop ("Imran ka kitna baqi hai?", "aaj kitni sale hui?", "cheeni kitni bachi hai?"). Nothing is written.
  "unknown" = anything else, silence, or not clear.
- question_roman: for intent "question" only: the question written clearly in the SAME language the owner used (Roman Urdu stays Roman Urdu, English stays English), using the exact customer or product name from the lists below when it is clearly one of them. null otherwise.
- person_name_roman, person_name_urdu: the person's name as spoken, without words like "ne", "se", "ko". null if no person.
- customer_match: if the person is clearly one of the KNOWN CUSTOMERS below, that exact name from the list; otherwise null.
  A shared surname alone is NOT a match ("Ali Butt" is not "Imran Butt").
- amount_pkr: the amount in rupees, ONLY if it was said. Never guess. ("paanch hazaar" = 5000, "dedh hazaar" = 1500, "dhai sau" = 250, "sawa do hazaar" = 2250, "saadhe teen hazaar" = 3500.)
- amount_words: the exact words in transcript_roman that say the amount, e.g. "paanch hazaar" or "5000".
- cash_from_galla: for udhaar only. true if cash or money was handed over, false if goods were taken (saamaan, sauda, ration), null if not clear.
- method: for wasooli: "cash" unless "easypaisa", "jazzcash" or "bank"/"online" was said.
- expense_category: for kharcha: one of rent, electricity, salaries, transport, general, owner_drawings (owner took cash home), bank_deposit.
- reason_roman, reason_urdu: why, in a few words, only if said (e.g. "beti ki fees"). null otherwise.
- days_ago: when it happened. 0 = today or not said, 1 = "kal" about the past, 2 = "parson" about the past, up to 7.
- due_in_days: when they promised to pay back, in days from today ("agle hafte" = 7, "agle mahine" = 30, "kal tak" = 1). null if not said.
- items: for udhaar of goods, one entry per thing taken, in the order said. Empty list otherwise.
  - words_roman: the exact words for this item in transcript_roman, with its quantity, e.g. "do kilo cheeni", "ek Dalda ghee", "teen Lux sabun".
  - words_urdu: the same words in Urdu script.
  - product_match: if it is clearly one of the SHOP PRODUCTS below, that exact product name; null if not sure or if several fit (e.g. "Dalda" alone could be oil or ghee).
  Do not put the price or the quantity anywhere else; the shop's own prices are used.

Today is {weekday}, {date}.
KNOWN CUSTOMERS: {customers}
SHOP PRODUCTS: {products}"""

SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "transcript_urdu": {"type": "string"},
        "transcript_roman": {"type": "string"},
        "intent": {"type": "string", "enum": sorted(INTENTS)},
        "person_name_roman": {"type": ["string", "null"]},
        "person_name_urdu": {"type": ["string", "null"]},
        "customer_match": {"type": ["string", "null"]},
        "amount_pkr": {"type": ["number", "null"]},
        "amount_words": {"type": ["string", "null"]},
        "cash_from_galla": {"type": ["boolean", "null"]},
        "method": {"type": ["string", "null"], "description": "cash, easypaisa, jazzcash or bank"},
        "expense_category": {"type": ["string", "null"], "description": "rent, electricity, salaries, transport, general, owner_drawings or bank_deposit"},
        "reason_roman": {"type": ["string", "null"]},
        "reason_urdu": {"type": ["string", "null"]},
        "days_ago": {"type": "integer"},
        "due_in_days": {"type": ["integer", "null"]},
        "question_roman": {"type": ["string", "null"]},
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "words_roman": {"type": "string"},
                    "words_urdu": {"type": ["string", "null"]},
                    "product_match": {"type": ["string", "null"]},
                },
                "required": ["words_roman"],
            },
        },
    },
    "required": ["transcript_urdu", "transcript_roman", "intent", "amount_pkr", "days_ago"],
}


def _prompt(now: datetime, customers: list[str], products: list[str] | None = None) -> str:
    names = "; ".join(customers[:300]) or "(none yet)"
    goods = "; ".join((products or [])[:400]) or "(none)"
    return PROMPT.format(weekday=WEEKDAYS[now.weekday()], date=now.strftime("%d %B %Y"), customers=names, products=goods)


def _text(v: Any, limit: int = 120) -> str | None:
    if not isinstance(v, str):
        return None
    v = " ".join(v.split()).strip()
    return v[:limit] or None


_FOR_SUFFIX = re.compile(r"\s*(ke|kay|ki|k)\s*(liye|lie|liay)\s*$|\s*(کے|کی)\s*(لیے|لئے|لئی)\s*$|\s*کیلئے\s*$|^for\s+", re.IGNORECASE)


def _reason(v: Any) -> str | None:
    """"beti ki fees ke liye" -> "beti ki fees": the sentence adds "ke liye" itself."""
    t = _text(v, 100)
    return (_FOR_SUFFIX.sub("", t.strip(" ,.،۔")).strip(" ,.،۔") or None) if t else None


def _int(v: Any, lo: int, hi: int) -> int | None:
    try:
        n = int(v)
    except (TypeError, ValueError):
        return None
    return max(lo, min(hi, n))


def clean(raw: dict[str, Any]) -> tuple[Understanding, str | None]:
    """Model JSON -> Understanding, with every field type-checked and clamped.
    Returns the customer_match name separately (only a hint for our matcher)."""
    intent = raw.get("intent") if raw.get("intent") in INTENTS else "unknown"
    amount = raw.get("amount_pkr")
    try:
        amount = float(amount) if amount is not None else None
    except (TypeError, ValueError):
        amount = None
    if amount is not None and not (0 < amount <= 10_000_000):
        amount = None
    u = Understanding(
        intent=intent,
        person_name=_text(raw.get("person_name_roman"), 80),
        person_name_urdu=_text(raw.get("person_name_urdu"), 80),
        amount=amount,
        amount_text=_text(raw.get("amount_words"), 60),
        cash_from_galla=raw.get("cash_from_galla") if isinstance(raw.get("cash_from_galla"), bool) else None,
        method=raw.get("method") if raw.get("method") in METHODS else None,
        expense_category=raw.get("expense_category") if raw.get("expense_category") in CATEGORIES else None,
        reason=_reason(raw.get("reason_roman")),
        reason_urdu=_reason(raw.get("reason_urdu")),
        days_ago=_int(raw.get("days_ago"), 0, 7) or 0,
        due_in_days=_int(raw.get("due_in_days"), 0, 365) if raw.get("due_in_days") is not None else None,
        transcript_urdu=_text(raw.get("transcript_urdu"), 600),
        transcript_roman=_text(raw.get("transcript_roman"), 600),
    )
    if intent == "wasooli" and not u.method:
        u.method = "cash"
    if intent == "question":
        u.question = _text(raw.get("question_roman"), 300) or u.transcript_roman or u.transcript_urdu
    if intent == "udhaar" and isinstance(raw.get("items"), list):
        for it in raw["items"][:20]:
            if isinstance(it, dict) and _text(it.get("words_roman"), 80):
                u.items.append({"words": _text(it.get("words_roman"), 80), "words_urdu": _text(it.get("words_urdu"), 80),
                                "hint": _text(it.get("product_match"), 150)})
    return u, _text(raw.get("customer_match"), 120)


def _loads(text: str | None) -> dict[str, Any] | None:
    if not text:
        return None
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text[text.find("{"):]
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start < 0 or end <= start:
            return None
        try:
            data = json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            return None
    return data if isinstance(data, dict) else None


# ---- Gemini: one call hears the audio and fills the fields --------------------------------

def gemini(now: datetime, customers: list[str], audio: bytes | None = None, mime: str | None = None,
           text: str | None = None, products: list[str] | None = None) -> dict[str, Any] | None:
    from google import genai
    from google.genai import types

    # Shorter per-model wait than the copilot: the shopkeeper is standing at the counter,
    # and a busy model is skipped for the next one.
    client = genai.Client(api_key=settings.GEMINI_API_KEY,
                          http_options=types.HttpOptions(timeout=int(min(settings.LLM_TIMEOUT_SECONDS, 12) * 1000)))
    parts = []
    if audio:
        parts.append(types.Part.from_bytes(data=audio, mime_type=mime or "audio/wav"))
        parts.append(types.Part.from_text(text="The owner's recording is above. Fill the JSON."))
    else:
        parts.append(types.Part.from_text(text=f"The owner typed: {text}\nFill the JSON."))
    base = dict(system_instruction=_prompt(now, customers, products), temperature=0.1, response_mime_type="application/json",
                thinking_config=types.ThinkingConfig(thinking_budget=0))
    try:
        resp = gemini_models.generate(client, parts, types.GenerateContentConfig(**base, response_json_schema=SCHEMA))
    except Exception as exc:
        # A model may refuse the schema or the thinking setting; the prompt still describes the JSON.
        text = str(exc).lower()
        if "schema" not in text and "thinking" not in text:
            raise
        base.pop("thinking_config", None)
        resp = gemini_models.generate(client, parts, types.GenerateContentConfig(**base))
    return _loads(resp.text)


# ---- Groq: Whisper writes it down, then the chat model fills the fields -------------------

def groq_transcribe(audio: bytes, mime: str | None, customers: list[str]) -> str | None:
    from groq import Groq

    client = Groq(api_key=settings.GROQ_API_KEY, timeout=settings.LLM_TIMEOUT_SECONDS, max_retries=1)
    ext = {"audio/wav": "wav", "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3"}.get(
        (mime or "audio/wav").split(";")[0], "wav")
    hint = "Udhaar, wasooli, hazaar, sau, rupay, Easypaisa, JazzCash. " + ", ".join(customers[:40])
    out = client.audio.transcriptions.create(file=(f"clip.{ext}", audio), model=settings.GROQ_WHISPER_MODEL,
                                             language="ur", prompt=hint[:800], response_format="json", temperature=0.0)
    return _text(getattr(out, "text", None), 600)


def groq_read(now: datetime, customers: list[str], text: str, products: list[str] | None = None) -> dict[str, Any] | None:
    from groq import Groq

    client = Groq(api_key=settings.GROQ_API_KEY, timeout=settings.LLM_TIMEOUT_SECONDS, max_retries=1)
    completion = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[{"role": "system", "content": _prompt(now, customers, products) + "\nReturn one JSON object with exactly these fields."},
                  {"role": "user", "content": f"What the owner said: {text}"}],
        response_format={"type": "json_object"}, temperature=0.1, max_tokens=900,
    )
    return _loads(completion.choices[0].message.content)
