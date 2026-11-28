"""Amounts as Pakistani shopkeepers say them, in Roman Urdu, Urdu script, English or digits.

    "5000", "5,000", "۵۰۰۰", "5k", "5 hazaar", "paanch hazaar", "پانچ ہزار",
    "dedh hazaar" (1,500), "dhai sau" (250), "sawa do hazaar" (2,250),
    "saadhe teen hazaar" (3,500), "paune do sau" (175), "ek lakh bees hazaar" (120,000)

This is the check that keeps voice entry honest: an AI may suggest an amount, but it is
only accepted if these words (or digits) are really in what was said.
A bare number word with no "sau / hazaar / lakh / rupay" after it is not an amount
("do" also means "give", "ek" also means "a").
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Urdu (Extended Arabic-Indic) and Arabic-Indic digits -> ASCII
_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")

UNITS: dict[str, float] = {}


def _add(value: float, *words: str) -> None:
    for w in words:
        UNITS[w] = value


_add(1, "ek", "aik", "ik", "one", "ایک", "اک")
_add(2, "do", "doo", "two", "دو")
_add(3, "teen", "tin", "three", "تین")
_add(4, "char", "chaar", "chaar", "four", "چار")
_add(5, "paanch", "panch", "panj", "paanj", "five", "پانچ")
_add(6, "chhe", "chay", "chhay", "chey", "che", "chhah", "six", "چھ", "چھے")
_add(7, "saat", "sat", "seven", "سات")
_add(8, "aath", "ath", "aat", "eight", "آٹھ")
_add(9, "nau", "nao", "nine", "نو")
_add(10, "das", "dus", "ten", "دس")
_add(11, "gyarah", "gyara", "giyara", "giara", "eleven", "گیارہ")
_add(12, "barah", "bara", "baara", "twelve", "بارہ")
_add(13, "terah", "tera", "thirteen", "تیرہ")
_add(14, "chaudah", "chauda", "choda", "chodah", "fourteen", "چودہ")
_add(15, "pandrah", "pandra", "fifteen", "پندرہ")
_add(16, "solah", "sola", "sixteen", "سولہ")
_add(17, "satrah", "satra", "seventeen", "سترہ")
_add(18, "atharah", "athara", "attharah", "eighteen", "اٹھارہ")
_add(19, "unnees", "unees", "unnis", "nineteen", "انیس")
_add(20, "bees", "bis", "twenty", "بیس")
_add(25, "pachees", "pachis", "pachchees", "twenty-five", "پچیس")
_add(30, "tees", "tis", "thirty", "تیس")
_add(35, "paintees", "paintis", "پینتیس")
_add(40, "chalees", "chalis", "chaalees", "forty", "چالیس")
_add(45, "paintalees", "paintalis", "پینتالیس")
_add(50, "pachaas", "pachas", "pachaas", "fifty", "پچاس")
_add(60, "saath", "sixty", "ساٹھ")
_add(70, "sattar", "seventy", "ستر")
_add(75, "pachattar", "pachhattar", "پچھتر")
_add(80, "assi", "assee", "eighty", "اسی")
_add(90, "nabbe", "nawway", "nabbay", "navve", "ninety", "نوے")

MULTIPLIERS: dict[str, float] = {}
for _w in ("sau", "so", "saw", "hundred", "سو"):
    MULTIPLIERS[_w] = 100
for _w in ("hazaar", "hazar", "hajar", "hazaar", "hzar", "hazzar", "thousand", "ہزار"):
    MULTIPLIERS[_w] = 1_000
for _w in ("lakh", "lac", "laakh", "lakhs", "لاکھ"):
    MULTIPLIERS[_w] = 100_000
for _w in ("crore", "karor", "karod", "کروڑ"):
    MULTIPLIERS[_w] = 10_000_000

# Words that are a whole number with a fraction on their own: dedh = 1.5, dhai = 2.5, aadha = 0.5
FRACTIONS = {"dedh": 1.5, "derh": 1.5, "deda": 1.5, "ڈیڑھ": 1.5,
             "dhai": 2.5, "dhaai": 2.5, "adhai": 2.5, "ڈھائی": 2.5, "اڑھائی": 2.5,
             "aadha": 0.5, "adha": 0.5, "آدھا": 0.5}
# Words that change the number after them: sawa do = 2.25, saadhe teen = 3.5, paune do = 1.75
MODIFIERS = {"sawa": 0.25, "sava": 0.25, "سوا": 0.25,
             "saadhe": 0.5, "sadhe": 0.5, "sarhe": 0.5, "saarhe": 0.5, "ساڑھے": 0.5,
             "paune": -0.25, "pone": -0.25, "پونے": -0.25}
CURRENCY = {"rupay", "rupaye", "rupey", "rupee", "rupees", "rupe", "roopay", "rs", "pkr", "rupiya", "rupaiya",
            "روپے", "روپیہ", "روپئے", "روپیے"}
# Digits followed by these are quantities, not money.
QUANTITY_UNITS = {"kilo", "kg", "kilogram", "gram", "g", "litre", "liter", "ltr", "packet", "packets", "dabba", "dabbay",
                  "bottle", "botal", "carton", "darjan", "dozen", "piece", "pcs", "adad", "din", "days", "day",
                  "tareekh", "tarikh", "baje", "minute", "mahine", "hafte",
                  "کلو", "لیٹر", "پیکٹ", "ڈبہ", "ڈبے", "دن", "تاریخ", "بجے"}

_TOKEN = re.compile(r"\d[\d,]*(?:\.\d+)?k?|[^\W\d_]+(?:-[^\W\d_]+)?", re.UNICODE)


@dataclass
class Amount:
    value: float
    text: str           # the words it came from, e.g. "paanch hazaar"
    with_currency: bool  # followed by "rupay", "Rs" etc.
    start: int          # token index


def tokens(text: str) -> list[str]:
    return _TOKEN.findall(text.translate(_DIGITS).lower())


def _digit_value(tok: str) -> float | None:
    k = tok.endswith("k")
    raw = tok[:-1] if k else tok
    raw = raw.replace(",", "")
    try:
        v = float(raw)
    except ValueError:
        return None
    return v * 1000 if k else v


def find_amounts(text: str) -> list[Amount]:
    """Every money amount in the text, in order."""
    toks = tokens(text)
    out: list[Amount] = []
    i = 0
    while i < len(toks):
        amount = _read_amount(toks, i)
        if amount is None:
            i += 1
            continue
        out.append(amount)
        i = amount.start + len(amount.text.split())
    return out


def _read_amount(toks: list[str], start: int) -> Amount | None:
    total = 0.0
    group: float | None = None    # the number before a multiplier
    modifier = 0.0
    used_multiplier = False
    used_digits = False
    j = start
    while j < len(toks):
        t = toks[j]
        if t in MODIFIERS and group is None:
            modifier = MODIFIERS[t]
            j += 1
            continue
        if t[0].isdigit():
            if group is not None:
                break
            v = _digit_value(t)
            if v is None:
                break
            group, used_digits = v, True
            j += 1
            continue
        if t in FRACTIONS and group is None:
            group = FRACTIONS[t]
            j += 1
            continue
        if t in UNITS and group is None:
            group = UNITS[t]
            j += 1
            continue
        if t in UNITS and group is not None and group < 100 and not used_digits and UNITS[t] < 10 and group % 10 == 0 and group >= 20:
            group += UNITS[t]  # English "twenty five"
            j += 1
            continue
        if t in MULTIPLIERS:
            if group is None and t in {"so", "saw"}:
                break                           # "so" alone is a word, not a hundred
            # Each group adds up: "ek lakh bees hazaar" = 100,000 + 20,000,
            # "do hazaar paanch sau" = 2,000 + 500, "barah sau" = 1,200.
            base = (group if group is not None else 1.0) + modifier
            total += base * MULTIPLIERS[t]
            group, modifier, used_multiplier = None, 0.0, True
            j += 1
            continue
        break

    if group is not None:
        total += group + (modifier if modifier else 0.0)
        group = None
    if j == start or total <= 0:
        return None

    consumed = toks[start:j]
    nxt = toks[j] if j < len(toks) else ""
    with_currency = nxt in CURRENCY
    if not used_multiplier and not used_digits and not with_currency:
        return None                 # "do", "ek" on their own are not money
    if used_digits and not used_multiplier and nxt in QUANTITY_UNITS:
        return None                 # "2 kilo", "10 din"
    if modifier and not used_multiplier:
        return None
    text = " ".join(consumed)
    return Amount(value=round(total, 2), text=text, with_currency=with_currency, start=start)


def best_amount(text: str) -> Amount | None:
    """The amount the sentence is about: the first one said with "rupay", else the first one."""
    found = find_amounts(text)
    if not found:
        return None
    for a in found:
        if a.with_currency:
            return a
    return found[0]


def amount_is_in(value: float, *texts: str | None) -> bool:
    """Was this exact amount really said in any of these transcripts?"""
    for t in texts:
        if t and any(abs(a.value - value) < 0.5 for a in find_amounts(t)):
            return True
    return False
