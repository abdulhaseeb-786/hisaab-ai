"""Items said on udhaar: "do kilo cheeni, ek Dalda ghee aur teen Lux sabun".

Three jobs, all without trusting an AI blindly:

1. quantity(): "do kilo" = 2 kg, "aadha kilo" = 0.5 kg, "paav" = 0.25 kg, "ek darjan" = 12,
   "250 gram" = 0.25 kg. A quantity is only taken from the words that were said.
2. rank(): match the spoken item to the shop's products. Shopkeepers say "cheeni", not
   "Loose White Sugar (Cheeni) 1kg", so products get everyday names (ALIASES). A size that
   was said picks the right pack ("5 kilo atta" is the 5 kg bag). When two products fit
   equally ("Dalda": oil or ghee?) nothing is picked; the shopkeeper chooses, and the one
   this shop sells most is shown first.
3. to_product_qty(): turn what was said into the product's own unit: "2 kilo ghee" is two
   1 kg pouches, "6 anday" is half a dozen.

Prices always come from the shelf price, never from speech.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher

from app.voice.numbers import FRACTIONS, MODIFIERS, UNITS, tokens

# Everyday names for words found in product names. Key: a word in the product name.
ALIASES: dict[str, list[str]] = {
    "sugar": ["cheeni", "chini", "chinni", "shakar", "sugar"],
    "rice": ["chawal", "chaawal", "chaval", "rice"],
    "basmati": ["basmati"],
    "atta": ["atta", "aata", "ata", "flour"],
    "daal": ["daal", "dal", "dhal"],
    "chana": ["chana", "chanay", "chane", "channa"],
    "moong": ["moong", "mung"],
    "masoor": ["masoor", "masur"],
    "mash": ["mash", "maash", "urad"],
    "besan": ["besan", "baisan"],
    "maida": ["maida", "maidah"],
    "sooji": ["sooji", "suji", "soji"],
    "salt": ["namak", "salt"],
    "tea": ["chai", "patti", "pati", "chaye", "tea"],
    "milk": ["doodh", "dudh", "milk"],
    "whitener": ["whitener", "tea whitener"],
    "eggs": ["anday", "anday", "ande", "anda", "egg", "eggs"],
    "bread": ["double roti", "dabal roti", "dbl roti", "bread", "roti"],
    "butter": ["makhan", "makkhan", "butter"],
    "cream": ["malai", "cream"],
    "soap": ["sabun", "saban", "soap"],
    "shampoo": ["shampoo", "shampu"],
    "toothpaste": ["manjan", "toothpaste", "paste"],
    "cavity": ["manjan", "toothpaste"],
    "washing": ["surf", "sarf", "kapre dhone", "washing powder", "powder"],
    "detergent": ["surf", "sarf", "washing powder", "powder"],
    "dishwash": ["bartan", "bartan dhone", "dishwash"],
    "oil": ["tel", "teil", "oil"],
    "ghee": ["ghee", "ghi", "banaspati"],
    "chilli": ["mirch", "lal mirch", "chilli"],
    "turmeric": ["haldi", "haldee"],
    "haldi": ["haldi"],
    "coriander": ["dhania", "dhaniya"],
    "cumin": ["zeera", "zira", "jeera"],
    "pepper": ["kali mirch"],
    "pickle": ["achar", "achaar"],
    "ketchup": ["ketchup", "chatni", "sauce"],
    "biscuits": ["biscuit", "biskut", "biscuits"],
    "biscuit": ["biscuit", "biskut"],
    "chips": ["chips", "chip"],
    "water": ["pani", "paani", "water"],
    "jam": ["jam", "jaam"],
    "chocolate": ["chocolate", "chaklait"],
    "toffees": ["toffee", "tofi", "taafi"],
    "tissue": ["tissue", "tishu"],
    "razors": ["blade", "razor"],
    "phenyl": ["phenyl", "finail", "fenail"],
    "insect": ["machhar", "machar", "spray"],
    "cleaner": ["cleaner"],
    "coca-cola": ["coke", "coca cola", "cola"],
    "pepsi": ["pepsi"],
    "sprite": ["sprite"],
    "masala": ["masala"],
    "macaroni": ["macaroni", "makroni"],
    "spaghetti": ["spaghetti"],
    "jam-e-shirin": ["jam e shirin", "sharbat"],
    "rooh": ["rooh afza", "sharbat"],
    "corn": ["corn flakes", "cornflakes"],
    "nimco": ["nimko", "nimco", "daal moth"],
    "sponge": ["sponge", "jhanwa"],
    "liquid": ["liquid"],
}
# Product-name words that say nothing about what the item is.
NAME_NOISE = {"loose", "premium", "pouch", "bag", "box", "tin", "bottle", "jar", "pack", "packet", "tetra", "pak", "pet",
              "tub", "large", "small", "half", "roll", "family", "the", "and", "&", "with", "plus", "pro", "v", "ii", "s",
              "white", "red", "original", "classic", "advanced", "fortified", "super", "maximum", "power", "pure", "total"}
# Spoken words that are not about the item.
FILLER = {"ka", "ki", "ke", "kay", "wala", "wali", "walay", "aur", "or", "and", "bhi", "le", "gaya", "gayi", "gaye", "liya",
          "liye", "kar", "ko", "se", "ne", "udhaar", "udhar", "par", "pe", "per", "mein", "main", "ek", "aik", "do", "teen",
          "char", "paanch", "hai", "tha", "saath", "sath", "diya", "diye", "de", "dein", "of", "a", "an"}

# Spoken units -> (kind, size in base unit). kind: mass (kg), volume (litre), dozen, count.
UNIT_WORDS: dict[str, tuple[str, float]] = {}
for _w in ("kilo", "kg", "kilogram", "kilos", "کلو"):
    UNIT_WORDS[_w] = ("mass", 1.0)
for _w in ("gram", "grams", "gm", "g", "گرام"):
    UNIT_WORDS[_w] = ("mass", 0.001)
for _w in ("paav", "pao", "paao", "pav", "پاؤ"):
    UNIT_WORDS[_w] = ("mass", 0.25)
for _w in ("litre", "liter", "ltr", "l", "لیٹر"):
    UNIT_WORDS[_w] = ("volume", 1.0)
for _w in ("ml",):
    UNIT_WORDS[_w] = ("volume", 0.001)
for _w in ("darjan", "dozen", "درجن"):
    UNIT_WORDS[_w] = ("dozen", 12.0)
for _w in ("packet", "packets", "paket", "pouch", "dabba", "dabbay", "dabbe", "dibba", "botal", "bottle", "bottles",
           "piece", "pieces", "adad", "bag", "bori", "tin", "jar", "tube", "bar", "tikki", "tikkiyan", "box", "pack",
           "پیکٹ", "ڈبہ", "ڈبے", "بوتل", "عدد"):
    UNIT_WORDS[_w] = ("count", 1.0)

_SIZE = re.compile(r"(\d+(?:\.\d+)?)\s*(kg|g|l|ml)\b", re.IGNORECASE)


@dataclass
class Product:
    product_id: int
    name: str
    unit: str
    selling_price: float
    stock_qty: float
    image_url: str | None = None
    sold_30d: float = 0.0
    words: set[str] = field(default_factory=set)
    phrases: set[str] = field(default_factory=set)
    size: tuple[str, float] | None = None    # ("mass", 5.0) for a 5 kg bag


@dataclass
class Quantity:
    qty: float
    kind: str           # mass, volume, dozen, count
    text: str           # the words, e.g. "do kilo"


@dataclass
class Ranked:
    product: Product
    score: float


def _norm(w: str) -> str:
    w = w.lower()
    for a, b in (("ee", "i"), ("oo", "u"), ("aa", "a"), ("q", "k"), ("w", "v")):
        w = w.replace(a, b)
    return re.sub(r"(.)\1+", r"\1", w)


def build(products: list[Product]) -> list[Product]:
    """Give every product its searchable words: name words + everyday names."""
    for p in products:
        low = p.name.lower()
        raw = re.findall(r"[a-z][a-z\-]*", re.sub(r"\(|\)", " ", low))
        p.words = {w for w in raw if w not in NAME_NOISE and len(w) > 1}
        p.phrases = set()
        for key, names in ALIASES.items():
            if key in low:
                for n in names:
                    (p.phrases if " " in n else p.words).add(n)
        m = _SIZE.search(p.name)
        if m:
            v, u = float(m.group(1)), m.group(2).lower()
            p.size = ("mass", v if u == "kg" else v / 1000) if u in ("kg", "g") else ("volume", v if u == "l" else v / 1000)
        elif p.unit == "kg":
            p.size = ("mass", 1.0)
    return products


def quantity(text: str) -> Quantity | None:
    """The first quantity in an item phrase: number (digits or words) + optional unit."""
    toks = tokens(text)
    for i, t in enumerate(toks):
        nxt = toks[i + 1] if i + 1 < len(toks) else ""
        if t in UNIT_WORDS and UNIT_WORDS[t][0] == "mass" and t in ("paav", "pao", "paao", "pav", "پاؤ"):
            return Quantity(0.25, "mass", t)          # "paav cheeni" = a quarter kilo
        if t in ("aadha", "adha", "آدھا") and nxt in UNIT_WORDS:
            kind, size = UNIT_WORDS[nxt]
            return Quantity(0.5 * size if kind != "count" else 0.5, kind, f"{t} {nxt}")
        value: float | None = None
        used = 1
        if t[0].isdigit():
            try:
                value = float(t.replace(",", ""))
            except ValueError:
                value = None
        elif t in FRACTIONS:
            value = FRACTIONS[t]
        elif t in MODIFIERS and nxt in UNITS:
            value = UNITS[nxt] + MODIFIERS[t]
            used = 2
            nxt = toks[i + 2] if i + 2 < len(toks) else ""
        elif t in UNITS and UNITS[t] <= 50:
            value = UNITS[t]
        if value is None or value <= 0:
            continue
        if nxt in UNIT_WORDS:
            kind, size = UNIT_WORDS[nxt]
            q = value * size if kind in ("mass", "volume") else value * (12 if kind == "dozen" else 1)
            return Quantity(round(q, 3), kind, " ".join(toks[i:i + used + 1]))
        # A bare number word only counts at the start of the phrase ("do Lux sabun"),
        # so "Ali do" (give) or "ek baat" does not become a quantity.
        if t[0].isdigit() or i == 0:
            return Quantity(value, "count", " ".join(toks[i:i + used]))
    return None


def _spoken_words(text: str) -> list[str]:
    toks = tokens(text)
    return [t for t in toks if t not in FILLER and t not in UNIT_WORDS and not t[0].isdigit()
            and t not in UNITS and t not in FRACTIONS and t not in MODIFIERS and len(t) > 1]


def _hit(word: str, p: Product) -> bool:
    nw = _norm(word)
    for w in p.words:
        nw2 = _norm(w)
        if nw == nw2 or (len(nw) > 3 and SequenceMatcher(None, nw, nw2).ratio() >= 0.84):
            return True
    return False


def rank(text: str, products: list[Product], said: Quantity | None = None) -> list[Ranked]:
    """Products that fit the spoken item, best first."""
    words = _spoken_words(text)
    low = " " + " ".join(tokens(text)) + " "
    if not words:
        return []
    out: list[Ranked] = []
    for p in products:
        phrase_hits = [ph for ph in p.phrases if f" {ph} " in low]
        covered = {w for ph in phrase_hits for w in ph.split()}
        hits = [w for w in words if w in covered or _hit(w, p)]
        if not hits:
            continue
        recall = len(hits) / len(words)
        # Fewer unexplained product words = a closer fit ("cheeni" fits the sugar, not sugar syrup).
        precision = min(1.0, (len(hits) + 1) / (len(p.words) + 1))
        score = 0.8 * recall + 0.2 * precision
        if said and p.size and said.kind == p.size[0]:
            ratio = said.qty / p.size[1] if p.size[1] else 0
            if abs(ratio - round(ratio)) < 0.01 and round(ratio) >= 1:
                score += 0.2 if abs(ratio - 1) < 0.01 else 0.05   # "5 kilo atta" -> the 5 kg bag
            elif p.unit not in ("kg", "litre"):
                score -= 0.1
        out.append(Ranked(p, round(min(score, 1.2), 3)))
    out.sort(key=lambda r: (r.score, r.product.sold_30d), reverse=True)
    return out


def pick(ranked: list[Ranked], hint: str | None = None) -> Ranked | None:
    """Preselect only a clear winner. An AI hint can break a tie, never overrule a better fit."""
    if not ranked:
        return None
    top = ranked[0]
    if hint:
        for r in ranked:
            if r.product.name.lower() == hint.lower() and r.score >= 0.6 and r.score >= top.score - 0.05:
                return r
    second = ranked[1].score if len(ranked) > 1 else 0.0
    if top.score >= 0.7 and top.score - second >= 0.12:
        return top
    return None


def to_product_qty(said: Quantity | None, p: Product) -> tuple[float, bool]:
    """(quantity in the product's own unit, whether it was really said)."""
    if said is None:
        return 1.0, False
    if p.unit == "dozen":
        if said.kind == "dozen":
            return said.qty / 12, True
        return round(said.qty / 12, 3), True                # "6 anday" = half a dozen
    if said.kind in ("mass", "volume"):
        if p.unit in ("kg", "litre") and (not p.size or p.size[0] == said.kind):
            return said.qty, True
        if p.size and p.size[0] == said.kind and p.size[1] > 0:
            return round(said.qty / p.size[1], 3), True      # "2 kilo ghee" = two 1 kg pouches
        return said.qty, True
    if said.kind == "dozen":
        return said.qty, True                                 # 12 pieces
    return said.qty, True


SPLIT = re.compile(r",|،|\baur\b|\band\b|\bor\b|\bphir\b|اور|\+", re.IGNORECASE)


def split_items(text: str) -> list[str]:
    return [s.strip() for s in SPLIT.split(text) if s and s.strip()]
