"""Who did the shopkeeper mean? Match a spoken name to a khata.

Spoken names are messy: "Tariq bhai" for "Tariq Mahmood (Tariq Bhai)", "Akram" for
"Chaudhry Akram", "Tarik" for "Tariq". But a shared surname is not the same person:
"Ali Butt" must not be written in Imran Butt's khata. So a match is only picked for the
shopkeeper when it is clear; otherwise they see the closest khatas and choose, or open
a new one with the spoken name.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from difflib import SequenceMatcher

# Titles and kinship words: they help a match but are not a name on their own.
HONORIFICS = {
    "bhai", "bhaiya", "bhaijan", "sahab", "sahib", "saab", "sb", "ji", "jee", "baji", "baaji", "apa", "aapa",
    "chacha", "chachi", "mamu", "mama", "khala", "phuppo", "bibi", "begum", "haji", "hajji", "chaudhry",
    "chaudhary", "ch", "malik", "rana", "sheikh", "shaikh", "mirza", "master", "dr", "doctor", "qari", "maulana",
    "molvi", "ustad", "mohallah", "mohalla", "uncle", "aunty", "auntie", "beta", "mr", "mrs", "miss",
}
AUTO_PICK = 0.80        # clear match
UNIQUE_PICK = 0.55      # every spoken word matched and no other khata does
SHOW = 0.35             # close enough to offer as a choice


def _key(word: str) -> str:
    """A rough sound-alike key so Tariq/Tarik, Butt/But, Shazia/Shaziya compare equal."""
    w = word.lower()
    w = re.sub(r"[^a-z]", "", w)
    for a, b in (("ee", "i"), ("oo", "u"), ("aa", "a"), ("q", "k"), ("iya", "ia"), ("w", "v"), ("ph", "f")):
        w = w.replace(a, b)
    w = re.sub(r"(.)\1+", r"\1", w)
    if len(w) > 3 and w.endswith("h"):
        w = w[:-1]
    return w


def words(name: str) -> list[str]:
    return [w for w in re.split(r"[^A-Za-z]+", name) if w]


def variants(name: str) -> list[list[str]]:
    """"Tariq Mahmood (Tariq Bhai)" -> [Tariq Mahmood (Tariq Bhai) as one, Tariq Mahmood, Tariq Bhai]."""
    inside = re.findall(r"\((.*?)\)", name)
    outside = re.sub(r"\(.*?\)", " ", name)
    out = [words(outside)]
    out += [words(x) for x in inside]
    return [v for v in out if v]


def _weight(w: str) -> float:
    return 0.4 if w.lower() in HONORIFICS else 1.0


def _sim(a: str, b: str) -> float:
    ka, kb = _key(a), _key(b)
    if not ka or not kb:
        return 0.0
    if ka == kb:
        return 1.0
    return SequenceMatcher(None, ka, kb).ratio()


def _score(spoken: list[str], name: list[str]) -> tuple[float, float]:
    """(score, recall): recall = share of the spoken name that is found in this name."""
    if not spoken or not name:
        return 0.0, 0.0
    hit_name = sum(_weight(n) for n in name if max(_sim(n, s) for s in spoken) >= 0.8)
    total_name = sum(_weight(n) for n in name)
    real_spoken = [s for s in spoken if s.lower() not in HONORIFICS] or spoken
    hit_spoken = sum(_weight(s) for s in real_spoken if max(_sim(s, n) for n in name) >= 0.8)
    total_spoken = sum(_weight(s) for s in real_spoken)
    precision = hit_name / total_name
    recall = hit_spoken / total_spoken
    if precision + recall == 0:
        return 0.0, 0.0
    # The first real word of a name is the one people use; a surname alone is weak.
    first_spoken = real_spoken[0]
    first_name = next((n for n in name if n.lower() not in HONORIFICS), name[0])
    f1 = 2 * precision * recall / (precision + recall)
    only_titles = all(w.lower() in HONORIFICS for w in spoken)
    if not only_titles and _sim(first_spoken, first_name) < 0.8:
        f1 *= 0.75
    return f1, recall


@dataclass
class NameMatch:
    customer_id: int
    name: str
    score: float
    recall: float


def rank(spoken_name: str | None, customers: list[tuple[int, str]]) -> list[NameMatch]:
    """Khatas whose name is close to the spoken one, best first."""
    spoken = words(spoken_name or "")
    if not spoken:
        return []
    out = []
    for cid, name in customers:
        best = (0.0, 0.0)
        for v in variants(name):
            best = max(best, _score(spoken, v))
        if best[0] >= SHOW:
            out.append(NameMatch(cid, name, round(best[0], 3), round(best[1], 3)))
    out.sort(key=lambda m: m.score, reverse=True)
    return out


def pick(ranked: list[NameMatch]) -> NameMatch | None:
    """The khata to preselect, only if the match is clear."""
    if not ranked:
        return None
    top = ranked[0]
    second = ranked[1].score if len(ranked) > 1 else 0.0
    if top.score >= AUTO_PICK and top.score - second >= 0.1:
        return top
    full = [m for m in ranked if m.recall >= 0.999]
    if len(full) == 1 and full[0] is top and top.score >= UNIQUE_PICK:
        return top
    return None


def find_known_name(text: str, customers: list[tuple[int, str]]) -> str | None:
    """For typed text without an AI: the longest khata name (or alias) that appears in it."""
    toks = words(text)
    best: tuple[float, str] | None = None
    for _cid, name in customers:
        for v in variants(name):
            real = [w for w in v if w.lower() not in HONORIFICS]
            if not real:
                real = v
            if all(any(_sim(w, t) >= 0.85 for t in toks) for w in real):
                found = " ".join(v)
                weight = sum(_weight(w) for w in v)
                if best is None or weight > best[0]:
                    best = (weight, found)
    return best[1] if best else None
