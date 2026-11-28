"""Understand one shop sentence without any AI: the offline tier of voice entry.

It reads Roman Urdu, Urdu script or simple English, typed or transcribed:

    "Aaj Ali Butt mujh se 5000 rupay ka udhaar le kar gaya, beti ki fees ke liye"
    -> udhaar, Ali Butt, Rs 5,000, cash from the galla, today, reason "beti ki fees"
    "Imran ne 2000 wapas diye easypaisa pe"   -> wasooli, Imran, Rs 2,000, Easypaisa
    "bijli ka bill 3500 diya"                 -> kharcha, electricity, Rs 3,500

It never guesses: a field it is not sure about stays empty, and the shopkeeper fills it.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from typing import Any

from app.voice.items import UNIT_WORDS, Product, quantity, split_items
from app.voice.items import rank as rank_items
from app.voice.names import HONORIFICS, find_known_name
from app.voice.numbers import CURRENCY, FRACTIONS, MODIFIERS, MULTIPLIERS, UNITS, best_amount, tokens


@dataclass
class Understanding:
    intent: str = "unknown"                 # udhaar, wasooli, kharcha, unknown
    person_name: str | None = None          # Roman, as spoken
    person_name_urdu: str | None = None
    amount: float | None = None
    amount_text: str | None = None          # the words the amount came from
    cash_from_galla: bool | None = None     # udhaar only: cash handed over (naqad)
    method: str | None = None               # wasooli: cash, easypaisa, jazzcash, bank
    expense_category: str | None = None
    reason: str | None = None
    reason_urdu: str | None = None
    days_ago: int = 0                       # 0 today, 1 yesterday ...
    due_in_days: int | None = None
    transcript_urdu: str | None = None
    transcript_roman: str | None = None
    question: str | None = None             # intent "question": what to ask the copilot
    # Udhaar of goods: each item as heard, {"words": "do kilo cheeni", "words_urdu": ..., "hint": product name or None}
    items: list[dict[str, Any]] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def _has(toks: list[str], text: str, words: set[str], phrases: tuple[str, ...] = ()) -> bool:
    return any(t in words for t in toks) or any(p in text for p in phrases)


UDHAAR_WORDS = {"udhaar", "udhar", "udaar", "udhaari", "udhari", "qarz", "qarza", "karz", "karza", "loan", "credit",
                "ادھار", "ادھاری", "قرض", "قرضہ", "ادہار"}
UDHAAR_PHRASES = ("le gaya", "le gayi", "le gaye", "le kar gaya", "le kar gayi", "lay gaya", "le ke gaya",
                  "le liye", "le liya", "le gya", "لے گیا", "لے گئی", "لے کر گیا", "لے گئے", "took", "borrowed")
WASOOLI_WORDS = {"wapas", "wapis", "waapis", "waapas", "wasool", "wasooli", "wasuli", "jama", "ada", "chukaye", "chuka",
                 "returned", "repaid", "paid", "واپس", "وصول", "جمع", "ادا", "لوٹائے", "لوٹا"}
WASOOLI_PHRASES = ("de gaya", "de gayi", "de gaye", "de diye", "de diya", "de ke gaya", "de kar gaya",
                   "bhej diye", "bheje", "دے گیا", "دے گئی", "دے دیے", "دے کر گیا", "بھیجے")
# Expense words: checked before the udhaar/wasooli verbs only when no customer is named.
EXPENSE_WORDS: list[tuple[str, set[str], tuple[str, ...]]] = [
    ("electricity", {"bijli", "bijlee", "electricity", "wapda", "lesco", "iesco", "kelectric", "بجلی", "واپڈا"}, ("light ka bill", "k-electric")),
    ("salaries", {"tankhwah", "tankhwa", "tankha", "salary", "tankhah", "تنخواہ"}, ()),
    ("transport", {"rickshaw", "rikshaw", "petrol", "transport", "bhara", "bhaara", "delivery", "gaari", "suzuki", "رکشہ", "پٹرول", "بھاڑا"}, ()),
    ("rent", {"kiraya", "kiraaya", "kirayah", "rent", "کرایہ"}, ()),
    ("bank_deposit", set(), ("bank mein jama", "bank me jama", "bank main jama", "بینک میں جمع")),
    ("owner_drawings", set(), ("ghar le gaya", "ghar ke liye", "ghar le gaye", "ghar ke kharche", "گھر کے لیے", "گھر لے گیا")),
    ("general", {"kharcha", "kharch", "kharchay", "expense", "bill", "خرچ", "خرچہ", "بل"}, ()),
]
GOODS_WORDS = {"saman", "samaan", "saamaan", "saaman", "sauda", "soda", "maal", "cheez", "cheezen", "rashan", "ration",
               "سامان", "سودا", "مال", "راشن"}
CASH_WORDS = {"cash", "naqad", "naqd", "nakad", "paise", "paisay", "pese", "rupay", "rupaye", "rupees", "نقد", "پیسے", "روپے"}
METHODS = [
    ("easypaisa", {"easypaisa", "easypesa", "ایزی"}, ("easy paisa", "easy paise", "easy pesa", "ایزی پیسہ")),
    ("jazzcash", {"jazzcash", "jaz", "جاز"}, ("jazz cash", "jaz cash", "جاز کیش")),
    ("bank", {"bank", "online", "transfer", "raast", "بینک", "آنلائن"}, ()),
]
TIME_WORDS = {"aaj", "aj", "kal", "parson", "parso", "abhi", "subah", "subha", "shaam", "sham", "raat", "dopahar",
              "today", "yesterday", "آج", "کل", "پرسوں", "ابھی", "صبح", "شام"}
NAME_STOP = {
    "ne", "nay", "se", "sy", "say", "ko", "ka", "ki", "ke", "kay", "mujh", "mujhse", "mujhe", "mere", "mera", "meri",
    "hum", "humse", "hamse", "is", "us", "ye", "yeh", "woh", "wo", "ap", "aap", "ny", "sey", "from", "took", "gave",
    "نے", "سے", "کو", "کا", "کی", "کے", "مجھ", "مجھے",
} | UDHAAR_WORDS | WASOOLI_WORDS | CASH_WORDS | CURRENCY
PAST_MARKERS = {"gaya", "gayi", "gaye", "gya", "liye", "liya", "diye", "diya", "tha", "thi", "the", "gai",
                "گیا", "گئی", "لیے", "دیے", "تھا", "تھی"}
FUTURE_MARKERS = {"dega", "degi", "denge", "dein", "lautaye", "lautayega", "karega", "karegi", "dedega", "wapas", "tak",
                  "دے گا", "دے گی", "تک"}
WEEKDAYS = {  # Monday = 0
    0: {"somwar", "peer", "pir", "monday", "پیر", "سوموار"},
    1: {"mangal", "tuesday", "منگل"},
    2: {"budh", "bodh", "wednesday", "بدھ"},
    3: {"jumeraat", "jumerat", "jumairat", "thursday", "جمعرات"},
    4: {"juma", "jumma", "friday", "جمعہ"},
    5: {"hafta", "haftay", "sanichar", "saturday", "ہفتہ"},
    6: {"itwar", "itwaar", "itvar", "sunday", "اتوار"},
}
REASON_END = ("ke liye", "kay liye", "ki liye", "keliye", "k liye", "ke lie", "kelie", "for", "کے لیے", "کیلئے", "کے لئے")
# Words that start a reason, never part of a name: "Ali Butt beti ki fees ke liye ..."
REASON_NOUNS = {"beti", "beta", "bete", "bachon", "bachay", "bache", "bachi", "dawai", "dawa", "dawaai", "fees", "fee",
                "school", "ilaj", "ilaaj", "hospital", "shaadi", "shadi", "biwi", "ammi", "abbu", "ami", "abu", "wife",
                "medicine", "doctor", "operation", "safar", "mehman", "rishtedar", "janaza", "kiraye",
                "بیٹی", "بیٹا", "بچوں", "دوائی", "دوا", "فیس", "سکول", "علاج", "ہسپتال", "شادی"}
REASON_STOP = {"udhaar", "udhar", "rupay", "rupaye", "rupees", "le", "kar", "gaya", "gayi", "liye", "se", "mujh", "mujhse",
               "ne", "hai", "tha", "aaj", "kal", "ka", "ko", "de", "diye", "diya", "cash", "naqad", "ادھار", "روپے", "سے", "نے"}


QUESTION_WORDS = {"kitna", "kitni", "kitne", "kitnay", "kab", "kaun", "kon", "kaunsa", "konsa", "kaisa", "kaisi", "kaise",
                  "kyun", "kyon", "kidhar", "kahan", "batao", "bataen", "bataein", "bataiye", "batayein", "dikhao",
                  "how", "what", "which", "who", "when", "why", "show", "tell",
                  "کتنا", "کتنی", "کتنے", "کب", "کون", "کیسا", "کیسے", "کیوں", "بتاؤ", "بتائیں", "دکھاؤ"}


def _is_question(raw: str, toks: list[str]) -> bool:
    """A question, not something to write: '?' or a question word, and nothing to book."""
    if raw.rstrip().endswith(("?", "؟")):
        return True
    return any(t in QUESTION_WORDS for t in toks)


def _is_number_word(t: str) -> bool:
    return t[0].isdigit() or t in UNITS or t in MULTIPLIERS or t in FRACTIONS or t in MODIFIERS


def _intent(toks: list[str], text: str, person_found: bool) -> tuple[str, str | None]:
    expense = None
    for cat, words, phrases in EXPENSE_WORDS:
        if _has(toks, text, words, phrases):
            expense = cat
            break
    udhaar = _has(toks, text, UDHAAR_WORDS, UDHAAR_PHRASES)
    wasooli = _has(toks, text, WASOOLI_WORDS, WASOOLI_PHRASES)
    explicit_udhaar = _has(toks, text, UDHAAR_WORDS)
    # "Ali bijli ke bill ke liye 3000 udhaar le gaya" is udhaar, not a shop expense.
    if explicit_udhaar:
        return "udhaar", None
    if expense in {"owner_drawings", "bank_deposit"}:
        return "kharcha", expense
    if wasooli and not (udhaar and not _has(toks, text, WASOOLI_WORDS)):
        if expense and not person_found:
            return "kharcha", expense
        return "wasooli", None
    if udhaar:
        return ("kharcha", expense) if expense and not person_found else ("udhaar", None)
    if expense:
        return "kharcha", expense
    if person_found and any(t in {"diye", "diya", "دیے", "دیا"} for t in toks):
        return "wasooli", None   # "Imran ne 2000 diye"
    return "unknown", None


def _guess_name(raw: str) -> str | None:
    """Words before "ne / se / mujh se ..." that are not time, number or verb words."""
    words = re.findall(r"[^\W_]+", raw, re.UNICODE)
    name: list[str] = []
    for w in words:
        lw = w.lower()
        if lw[0].isdigit() or lw in UNIT_WORDS:   # "Ali 2 kilo cheeni": the name ends at the quantity
            if name:
                break
            continue
        if lw in TIME_WORDS and not name:
            continue
        if lw in REASON_NOUNS and name:
            break
        if lw in NAME_STOP or lw in TIME_WORDS or _is_number_word(lw) or lw in {"le", "de", "kar", "gaya", "gayi"}:
            if name:
                break
            continue
        name.append(w)
        if len(name) == 4:
            break
    if not name or all(n.lower() in HONORIFICS for n in name):
        return None if not name else " ".join(n.capitalize() for n in name)
    if not all(re.match(r"[A-Za-z]", n) for n in name):
        return " ".join(name)  # Urdu script: keep as it is
    return " ".join(n[:1].upper() + n[1:] for n in name)


def _days_ago_and_due(toks: list[str], text: str) -> tuple[int, int | None]:
    days_ago, due = 0, None
    for i, t in enumerate(toks):
        after = toks[i + 1:i + 5]
        if t in {"kal", "کل"}:
            if any(a in FUTURE_MARKERS for a in after):
                due = 1 if due is None else due
            elif any(a in PAST_MARKERS for a in toks):
                days_ago = 1
        elif t in {"parson", "parso", "پرسوں"}:
            if any(a in FUTURE_MARKERS for a in after):
                due = 2 if due is None else due
            else:
                days_ago = 2
        elif t == "yesterday":
            days_ago = 1
    if any(p in text for p in ("agle hafte", "agle haftay", "agley haftay", "next week", "aglay hafte", "اگلے ہفتے")):
        due = 7
    if any(p in text for p in ("agle mahine", "agle mahinay", "aglay mahine", "next month", "اگلے مہینے")):
        due = 30
    m = re.search(r"(\d+)\s*(din|days|دن)\s*(mein|main|me|baad|tak|میں|بعد|تک)", text)
    if m:
        due = int(m.group(1))
    m = re.search(r"(\d{1,2})\s*(tareekh|tarikh|تاریخ)", text)
    if m:
        due = ("date", int(m.group(1)))  # type: ignore[assignment]  # resolved by the caller
    return min(days_ago, 7), due


def _reason(raw: str, name: str | None = None) -> str | None:
    low = raw.lower()
    name_words = {w.lower() for w in re.findall(r"[^\W\d_]+", name or "", re.UNICODE)}
    for end in REASON_END:
        idx = low.find(end)
        if idx <= 0:
            continue
        before = re.findall(r"[^\W\d_]+", raw[:idx], re.UNICODE)
        kept: list[str] = []
        for w in reversed(before):
            if w.lower() in REASON_STOP or w.lower() in name_words or _is_number_word(w.lower()) or len(kept) == 4:
                break
            kept.append(w)
        if kept:
            return " ".join(reversed(kept))
    return None


def _items(raw: str, name: str | None, products: list[Product]) -> list[dict[str, Any]]:
    """Item phrases in a typed sentence: split on "aur" / commas, keep the parts that fit a product."""
    drop = ({w.lower() for w in re.findall(r"[^\W\d_]+", name or "", re.UNICODE)} | TIME_WORDS | NAME_STOP
            | {"le", "gaya", "gayi", "gaye", "liya", "liye", "kar", "hai", "tha", "lay", "gya"})
    out = []
    for seg in split_items(raw):
        words = [w for w in re.findall(r"[^\W_]+", seg, re.UNICODE) if w.lower() not in drop]
        phrase = " ".join(words)
        if not phrase:
            continue
        ranked = rank_items(phrase, products, quantity(phrase))
        if ranked and ranked[0].score >= 0.6:
            out.append({"words": phrase, "words_urdu": None, "hint": None})
    return out


def parse(text: str, customers: list[tuple[int, str]] | None = None, products: list[Product] | None = None) -> Understanding:
    raw = " ".join(text.split())
    low = raw.lower()
    toks = tokens(raw)
    known = find_known_name(raw, customers or [])
    name = known or _guess_name(raw)
    if name and not known and products:
        # "Imran Butt cheeni le gaya": the name stops where the item starts.
        kept = name.split()
        while len(kept) > 1 and any(rank_items(kept[-1], products)):
            kept.pop()
        name = " ".join(kept)
    intent, category = _intent(toks, low, bool(name))
    u = Understanding(intent=intent, expense_category=category)
    if raw and re.search(r"[؀-ۿ]", raw):
        u.transcript_urdu = raw
    else:
        u.transcript_roman = raw
    # "Imran ka kitna baqi hai?" is a question for the copilot, unless there is an amount to
    # book ("kal 500 diye the, kitna baqi hai?" is still a question: it ends with "?").
    if _is_question(raw, toks) and (raw.rstrip().endswith(("?", "؟")) or best_amount(raw) is None):
        u.intent, u.expense_category, u.question = "question", None, raw
        return u

    a = best_amount(raw)
    if a:
        u.amount, u.amount_text = a.value, a.text
    if intent in {"udhaar", "wasooli"}:
        u.person_name = name
    if intent == "udhaar":
        u.items = _items(raw, name, products or [])
        goods = _has(toks, low, GOODS_WORDS) or bool(u.items)
        cash_said = _has(toks, low, CASH_WORDS - {"rupay", "rupaye", "rupees", "روپے"} | {"naqad", "cash"})
        u.cash_from_galla = True if cash_said and a else False if goods else True if _has(toks, low, CASH_WORDS) or a else None
    if intent == "wasooli":
        u.method = "cash"
        for m, words, phrases in METHODS:
            if _has(toks, low, words, phrases):
                u.method = m
                break
    u.days_ago, due = _days_ago_and_due(toks, low)
    if isinstance(due, int):
        u.due_in_days = due
    elif isinstance(due, tuple):
        u.notes.append(f"due_day_of_month:{due[1]}")
    u.reason = _reason(raw, name if intent in {"udhaar", "wasooli"} else None)
    return u
