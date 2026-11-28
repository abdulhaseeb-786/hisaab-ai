"""Bol kar likhein: say it, check it, save it.

1. understand(): keep the recording, find out what was said and meant (Gemini -> Groq ->
   offline parser on typed text), check the amount against the words, match the name to
   a khata, and return a proposal. Nothing is written to the books yet.
2. confirm(): the shopkeeper has checked (and maybe corrected) the proposal. Write it with
   the same services the manual screens use (khata, wasooli, kharcha), and link the
   recording to the khata line so it can be played back later.
3. discard(): the shopkeeper said "rehne dein". The capture is kept as discarded.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.analytics.cash_book import cash_position
from app.core.clock import store_now
from app.core.config import settings
from app.models import Customer, Product, Sale, SaleLine, Store, VoiceCapture
from app.services import day as day_service
from app.services import khata
from app.voice import items as item_match
from app.voice import llm
from app.voice import names as name_match
from app.voice.numbers import amount_is_in, best_amount, tokens
from app.voice.text_parser import Understanding, parse

logger = logging.getLogger(__name__)

MAX_SECONDS = 30
NEW_CUSTOMER_LIMIT = 5000.0   # same starting limit the "new khata" form suggests
AUDIO_TYPES = {"audio/wav": ".wav", "audio/x-wav": ".wav", "audio/wave": ".wav", "audio/webm": ".webm",
               "audio/ogg": ".ogg", "audio/mp4": ".m4a", "audio/mpeg": ".mp3"}


class VoiceError(ValueError):
    pass


def _note(en: str, ur: str) -> dict[str, str]:
    return {"en": en, "ur": ur}


def voice_dir() -> Path:
    d = Path(settings.VOICE_DIR)
    d.mkdir(parents=True, exist_ok=True)
    return d


def providers() -> list[str]:
    out = []
    if settings.COPILOT_MODE != "offline":
        if settings.GEMINI_API_KEY.strip():
            out.append("gemini")
        if settings.GROQ_API_KEY.strip():
            out.append("groq")
    return out + ["offline"]


def status(db: Session, store_id: int = 1) -> dict[str, Any]:
    store = db.get(Store, store_id)
    cloud = [p for p in providers() if p != "offline"]
    return {"cloud_allowed": bool(store and store.voice_cloud_allowed), "cloud_available": bool(cloud),
            "providers": providers(), "max_seconds": MAX_SECONDS}


def set_cloud_allowed(db: Session, allowed: bool, store_id: int = 1) -> dict[str, Any]:
    store = db.get(Store, store_id)
    if not store:
        raise LookupError("Store not found.")
    store.voice_cloud_allowed = allowed
    db.commit()
    return status(db, store_id)


# ---- 1. understand -----------------------------------------------------------------------

def _run_cloud(now: datetime, names: list[str], audio: bytes | None, mime: str | None,
               text: str | None, notes: list[dict[str, str]], products: list[str] | None = None) -> tuple[str, dict[str, Any]] | None:
    available = providers()
    if "gemini" in available:
        try:
            raw = llm.gemini(now, names, audio=audio, mime=mime, text=text, products=products)
            if raw:
                return "gemini", raw
        except Exception as exc:  # network, quota, bad audio...
            logger.warning("Voice tier gemini failed: %s", exc.__class__.__name__)
    if "groq" in available:
        try:
            heard = llm.groq_transcribe(audio, mime, names) if audio else text
            if heard:
                raw = llm.groq_read(now, names, heard, products=products)
                if raw:
                    # Keep Whisper's own words as the transcript: they are what was heard.
                    if audio:
                        raw["transcript_urdu"] = heard
                    return "groq", raw
        except Exception as exc:
            logger.warning("Voice tier groq failed: %s", exc.__class__.__name__)
    if len(available) > 1:
        notes.append(_note("The online AI did not answer, so this was understood offline.",
                           "Online AI ne jawab nahi diya, is liye yeh offline samjha gaya."))
    return None


def _check_amount(u: Understanding, typed: str | None, notes: list[dict[str, str]]) -> None:
    """An amount is only kept if it was really said (digits or Urdu number words)."""
    texts = (u.transcript_roman, u.transcript_urdu, typed, u.amount_text)
    if u.amount is not None and not amount_is_in(u.amount, u.transcript_roman, u.transcript_urdu, typed):
        heard = next((a for a in (best_amount(t) for t in texts if t) if a), None)
        notes.append(_note(
            f"The AI suggested Rs {u.amount:,.0f}, but that is not in the words heard"
            + (f"; using Rs {heard.value:,.0f} from \"{heard.text}\"." if heard else ". Please write the amount."),
            f"AI ne Rs {u.amount:,.0f} kaha magar yeh suni hui baat mein nahi"
            + (f"; \"{heard.text}\" se Rs {heard.value:,.0f} liya." if heard else ". Raqam khud likhein."),
        ))
        u.amount, u.amount_text = (heard.value, heard.text) if heard else (None, None)
    if u.amount is None:
        heard = next((a for a in (best_amount(t) for t in texts if t) if a), None)
        if heard:
            u.amount, u.amount_text = heard.value, heard.text


def _candidate(item: dict[str, Any], score: float) -> dict[str, Any]:
    return {**item, "score": round(score, 3)}


def _person(db: Session, u: Understanding, hint: str | None, store_id: int, now: datetime) -> dict[str, Any]:
    items = {c["customer_id"]: c for c in khata.list_customers(db, store_id, now=now)}
    pairs = [(cid, c["name"]) for cid, c in items.items()]
    ranked = name_match.rank(u.person_name, pairs)
    chosen = name_match.pick(ranked)
    if not chosen and hint:
        # The AI said it is a known customer: accept only if our matcher also sees a strong
        # likeness (a shared surname alone scores below this).
        for m in ranked:
            if m.name.lower() == hint.lower() and m.score >= name_match.UNIQUE_PICK and ranked[0] is m:
                chosen = m
                break
    return {
        "spoken_name": u.person_name,
        "spoken_name_urdu": u.person_name_urdu,
        "match": _candidate(items[chosen.customer_id], chosen.score) if chosen else None,
        "candidates": [_candidate(items[m.customer_id], m.score) for m in ranked[:4]],
    }


def _due(u: Understanding, today: date) -> date | None:
    if u.due_in_days is not None:
        return today + timedelta(days=max(1, u.due_in_days))
    for n in u.notes:
        if n.startswith("due_day_of_month:"):
            day_n = int(n.split(":")[1])
            if 1 <= day_n <= 31:
                y, m = today.year, today.month
                for _ in range(3):
                    try:
                        d = date(y, m, day_n)
                    except ValueError:
                        d = None
                    if d and d > today:
                        return d
                    m = m + 1 if m < 12 else 1
                    y = y + 1 if m == 1 else y
    return None


def _catalog(db: Session, store_id: int, now: datetime) -> list[item_match.Product]:
    """The shop's products, with how much of each sold in the last 30 days (to order ties)."""
    sold = dict(
        db.query(SaleLine.product_id, func.sum(SaleLine.qty))
        .join(Sale, Sale.sale_id == SaleLine.sale_id)
        .filter(Sale.store_id == store_id, Sale.timestamp >= now - timedelta(days=30), Sale.timestamp <= now)
        .group_by(SaleLine.product_id)
    )
    rows = db.query(Product).filter(Product.store_id == store_id, Product.active.is_(True)).all()
    return item_match.build([
        item_match.Product(p.product_id, p.name, p.unit or "piece", p.selling_price, p.stock_qty or 0.0, p.image_url,
                           float(sold.get(p.product_id) or 0.0))
        for p in rows
    ])


def _option(r: item_match.Ranked, said: item_match.Quantity | None) -> dict[str, Any]:
    p = r.product
    qty, _ = item_match.to_product_qty(said, p)
    return {"product_id": p.product_id, "name": p.name, "unit": p.unit, "selling_price": p.selling_price,
            "stock_qty": p.stock_qty, "image_url": p.image_url, "score": r.score, "qty": qty}


def _said_in(words: str, *texts: str | None) -> bool:
    """Were these item words really in what was heard? (most of them, in any transcript)"""
    want = [t for t in tokens(words) if len(t) > 1]
    if not want:
        return False
    for t in texts:
        if not t:
            continue
        have = set(tokens(t))
        if sum(1 for w in want if w in have) / len(want) >= 0.6:
            return True
    return False


def _resolve_items(u: Understanding, typed: str | None, catalog: list[item_match.Product],
                   notes: list[dict[str, str]]) -> list[dict[str, Any]]:
    out = []
    for it in u.items:
        words = it["words"]
        if not _said_in(words, u.transcript_roman, typed, u.transcript_urdu):
            notes.append(_note(f"The AI listed \"{words}\", but that is not in the words heard, so it was left out.",
                               f"AI ne \"{words}\" likha magar yeh suni hui baat mein nahi, is liye chhor diya."))
            continue
        said = item_match.quantity(words)
        ranked = item_match.rank(words, catalog, said)
        chosen = item_match.pick(ranked, it.get("hint"))
        options = ranked[:4]
        if chosen and chosen not in options:
            options = [chosen, *options[:3]]
        out.append({
            "words": words,
            "words_urdu": it.get("words_urdu"),
            "qty_heard": said is not None,
            "qty_said": said.text if said else None,
            "match": _option(chosen, said) if chosen else None,
            "options": [_option(r, said) for r in options],
        })
    return out


ANSWER_LANGUAGES = {"roman_urdu", "english", "urdu"}


def _answer_question(db: Session, *, u: Understanding, typed: str | None, audio_file: str | None, mime: str | None,
                     seconds: float | None, provider: str, notes: list[dict[str, str]], language: str,
                     store_id: int, now: datetime) -> dict[str, Any]:
    """A question is not written anywhere: the copilot answers it with its read-only tools,
    under the same rules as typed questions (every number from a tool, offline fallback)."""
    from app.copilot.llm_client import chat_with_copilot

    question = (u.question or u.transcript_roman or typed or u.transcript_urdu or "").strip()[:1000]
    if typed and not audio_file:
        # Typed, not heard: show it as typed (an AI "transcript" of typed text is a translation).
        urdu_script = any("\u0600" <= ch <= "\u06ff" for ch in typed)
        u.transcript_urdu, u.transcript_roman = (typed, None) if urdu_script else (None, typed)
    answer = chat_with_copilot(db, message=question, language=language if language in ANSWER_LANGUAGES else "roman_urdu",
                               history=[], store_id=store_id)
    proposal = {
        "source": "audio" if audio_file else "text", "provider": provider, "has_recording": bool(audio_file),
        "transcript_urdu": u.transcript_urdu, "transcript_roman": u.transcript_roman or (typed if typed and not u.transcript_urdu else None),
        "intent": "question", "question": question, "answer": answer,
        "amount_pkr": None, "amount_heard": None, "extra_amount_pkr": None, "items": [], "items_total_pkr": 0,
        "person": {"spoken_name": None, "spoken_name_urdu": None, "match": None, "candidates": []},
        "cash_from_galla": False, "cash_from_galla_heard": False, "method": "cash", "expense_category": None,
        "reason": None, "reason_urdu": None, "days_ago": 0, "occurred_on": now.date(), "due_date": None,
        "usual_due_date": now.date(), "cash_in_galla_pkr": cash_position(db, store_id, now)["cash_in_hand_pkr"],
        "missing": [], "notes": notes,
    }
    cap = VoiceCapture(
        store_id=store_id, created_at=now, source=proposal["source"], audio_file=audio_file, audio_mime=mime if audio_file else None,
        audio_seconds=round(seconds, 1) if seconds else None, transcript_urdu=u.transcript_urdu,
        transcript_roman=proposal["transcript_roman"], provider=provider,
        proposal_json=json.dumps({k: v for k, v in proposal.items() if k != "answer"}, default=str, ensure_ascii=False),
        final_json=json.dumps({"question": question, "answer": answer.get("response"), "provider": answer.get("provider_used"),
                               "tools": [c["tool_name"] for c in answer.get("tool_calls", [])]}, ensure_ascii=False),
        status="answered", intent="question", saved_at=now,
    )
    db.add(cap)
    db.commit()
    return {"capture_id": cap.capture_id, **proposal}


def understand(db: Session, *, audio: bytes | None = None, mime: str | None = None, seconds: float | None = None,
               text: str | None = None, store_id: int = 1, now: datetime | None = None,
               answer_language: str = "roman_urdu") -> dict[str, Any]:
    now = now or store_now()
    text = " ".join((text or "").split())[:300] or None
    if not audio and not text:
        raise VoiceError("Say or type what happened.")
    mime = (mime or "").split(";")[0].strip().lower() or None
    if audio:
        if len(audio) > settings.VOICE_MAX_BYTES:
            raise VoiceError("The recording is too long. Keep it under 30 seconds.")
        if mime not in AUDIO_TYPES:
            raise VoiceError("This recording format is not supported.")

    store = db.get(Store, store_id)
    if not store:
        raise LookupError("Store not found.")
    customers = db.query(Customer.customer_id, Customer.name).filter(Customer.store_id == store_id).all()
    pairs = [(c.customer_id, c.name) for c in customers]
    catalog = _catalog(db, store_id, now)
    notes: list[dict[str, str]] = []

    audio_file = None
    if audio:
        audio_file = f"{uuid.uuid4().hex}{AUDIO_TYPES[mime]}"
        (voice_dir() / audio_file).write_bytes(audio)

    provider, hint = "offline", None
    u: Understanding | None = None
    cloud_ok = store.voice_cloud_allowed and len(providers()) > 1
    if cloud_ok:
        got = _run_cloud(now, [n for _, n in pairs], audio, mime, text, notes, [p.name for p in catalog])
        if got:
            provider = got[0]
            u, hint = llm.clean(got[1])
            # If the AI could not tell what it was, the offline rules may still know.
            if u.intent == "unknown" and (u.transcript_roman or text):
                rules = parse(u.transcript_roman or text or "", pairs, catalog)
                if rules.intent != "unknown":
                    rules.transcript_urdu, rules.transcript_roman = u.transcript_urdu, u.transcript_roman
                    u = rules
    if u is None:
        if text:
            u = parse(text, pairs, catalog)
        else:
            u = Understanding()
            notes.append(_note(
                "This recording could not be understood here. Type it in the box instead."
                if cloud_ok else "Voice needs your permission to use online AI. Until then, type it in the box.",
                "Yeh recording yahan samajh nahi aayi. Neeche likh kar batayein."
                if cloud_ok else "Awaaz samajhne ke liye online AI ki ijazat chahiye. Tab tak neeche likh dein.",
            ))
    if u.intent == "question":
        return _answer_question(db, u=u, typed=text, audio_file=audio_file, mime=mime, seconds=seconds, provider=provider,
                                notes=notes, language=answer_language, store_id=store_id, now=now)
    _check_amount(u, text, notes)
    items = _resolve_items(u, text, catalog, notes) if u.intent == "udhaar" else []
    if items and u.cash_from_galla is None:
        u.cash_from_galla = False
    # With items, the spoken amount is usually their total, so it is not added again;
    # only cash said alongside the items ("500 cash aur 2 kilo cheeni") is extra.
    extra = u.amount if not items or u.cash_from_galla else None
    items_total = round(sum(i["match"]["qty"] * i["match"]["selling_price"] for i in items if i["match"]), 2)
    if items and u.amount and extra is None and all(i["match"] for i in items) and abs(u.amount - items_total) > 1:
        notes.append(_note(
            f"Rs {u.amount:,.0f} was said, but at shelf prices these items come to Rs {items_total:,.0f}. Shelf prices are used.",
            f"Rs {u.amount:,.0f} kaha gaya, magar shelf ki qeemat par yeh items Rs {items_total:,.0f} ke hain. Shelf ki qeemat lagegi.",
        ))
    if any(not i["qty_heard"] for i in items):
        notes.append(_note("A quantity was not said for some items, so 1 is filled in. Please check.",
                           "Kuch items ki miqdaar nahi suni, is liye 1 likha hai. Check kar lein."))

    today = now.date()
    occurred = today - timedelta(days=u.days_ago)
    term = store.default_credit_term_days or 30
    due = _due(u, today)
    person = _person(db, u, hint, store_id, now) if u.intent in {"udhaar", "wasooli"} else \
        {"spoken_name": None, "spoken_name_urdu": None, "match": None, "candidates": []}
    intent = u.intent if u.intent != "unknown" else None
    missing = []
    if not intent:
        missing.append("intent")
    if u.amount is None and not items:
        missing.append("amount")
    if any(not i["match"] for i in items):
        missing.append("item")
    if intent in {"udhaar", "wasooli"} and not person["match"] and not person["spoken_name"]:
        missing.append("person")
    if intent == "kharcha" and not u.expense_category:
        missing.append("category")
    if u.days_ago:
        notes.append(_note(
            f"Said to have happened on {occurred:%d %b}. It is written today, with that date in the note.",
            f"Yeh {occurred:%d %b} ki baat hai. Aaj likha jaye ga, tareekh note mein hogi.",
        ))

    proposal = {
        "source": "audio" if audio else "text",
        "provider": provider,
        "has_recording": bool(audio_file),
        "transcript_urdu": u.transcript_urdu,
        "transcript_roman": u.transcript_roman or (text if text and not u.transcript_urdu else None),
        "intent": intent,
        "amount_pkr": u.amount,
        "amount_heard": u.amount_text,
        "extra_amount_pkr": extra,
        "items": items,
        "items_total_pkr": items_total,
        "person": person,
        "cash_from_galla": u.cash_from_galla if u.cash_from_galla is not None else True,
        "cash_from_galla_heard": u.cash_from_galla is not None,
        "method": u.method or "cash",
        "expense_category": u.expense_category if intent == "kharcha" else None,
        "reason": u.reason,
        "reason_urdu": u.reason_urdu,
        "days_ago": u.days_ago,
        "occurred_on": occurred,
        "due_date": due,
        "usual_due_date": occurred + timedelta(days=term),
        "cash_in_galla_pkr": cash_position(db, store_id, now)["cash_in_hand_pkr"],
        "missing": missing,
        "notes": notes,
    }
    cap = VoiceCapture(
        store_id=store_id, created_at=now, source=proposal["source"], audio_file=audio_file, audio_mime=mime if audio else None,
        audio_seconds=round(seconds, 1) if seconds else None, transcript_urdu=u.transcript_urdu,
        transcript_roman=proposal["transcript_roman"], provider=provider,
        proposal_json=json.dumps(proposal, default=str, ensure_ascii=False), status="pending",
    )
    db.add(cap)
    db.commit()
    return {"capture_id": cap.capture_id, **proposal}


# ---- 2. confirm --------------------------------------------------------------------------

def _pending(db: Session, capture_id: int, store_id: int) -> VoiceCapture:
    cap = db.get(VoiceCapture, capture_id)
    if not cap or cap.store_id != store_id:
        raise LookupError("This voice entry was not found.")
    if cap.status != "pending":
        if cap.status == "answered":
            raise VoiceError("This was a question; it was answered and nothing is written.")
        raise VoiceError("This voice entry was already " + ("saved." if cap.status == "saved" else "set aside."))
    return cap


def _was_edited(proposal: dict[str, Any], final: dict[str, Any]) -> bool:
    match = (proposal.get("person") or {}).get("match") or {}
    heard_items = proposal.get("items") or []
    suggested = proposal.get("extra_amount_pkr") if heard_items else proposal.get("amount_pkr")
    checks = [
        proposal.get("intent") == final["intent"],
        abs(float(suggested or 0) - float(final.get("amount") or 0)) < 0.5 and (suggested is not None or heard_items),
        int(proposal.get("days_ago") or 0) == final["days_ago"],
    ]
    if final["intent"] == "udhaar" and (heard_items or final.get("items")):
        said = sorted((i["match"]["product_id"], round(float(i["match"]["qty"]), 3)) for i in heard_items if i.get("match"))
        saved = sorted((i["product_id"], round(float(i["qty"]), 3)) for i in final.get("items") or [])
        checks.append(len(said) == len(heard_items) and said == saved)
    if final["intent"] in {"udhaar", "wasooli"}:
        if final.get("new_customer_name"):
            checks.append(not match and (proposal["person"].get("spoken_name") or "").strip().lower()
                          == final["new_customer_name"].strip().lower())
        else:
            checks.append(match.get("customer_id") == final.get("customer_id"))
    if final["intent"] == "udhaar":
        checks.append(bool(proposal.get("cash_from_galla")) == final["cash_from_galla"])
    if final["intent"] == "wasooli":
        checks.append(proposal.get("method") == final["method"])
    if final["intent"] == "kharcha":
        checks.append(proposal.get("expense_category") == final.get("expense_category"))
    return not all(checks)


def _note_text(reason: str | None, days_ago: int, occurred: date) -> str | None:
    parts = [reason.strip()] if reason and reason.strip() else []
    if days_ago:
        parts.append(f"{occurred:%d %b} ka")
    return " · ".join(parts)[:120] or None


def confirm(db: Session, capture_id: int, req: dict[str, Any], store_id: int = 1, now: datetime | None = None) -> dict[str, Any]:
    now = now or store_now()
    cap = _pending(db, capture_id, store_id)
    proposal = json.loads(cap.proposal_json)
    intent = req["intent"]
    occurred = now.date() - timedelta(days=req.get("days_ago") or 0)
    note = _note_text(req.get("reason"), req.get("days_ago") or 0, occurred)

    customer_id, new_customer = req.get("customer_id"), False
    if intent in {"udhaar", "wasooli"} and not customer_id:
        name = (req.get("new_customer_name") or "").strip()
        if not name:
            raise VoiceError("Choose the customer, or write a name for a new khata.")
        if intent == "wasooli":
            raise VoiceError("A new customer cannot pay back. Choose who paid.")
        existing = db.query(Customer).filter(Customer.store_id == store_id, Customer.name.ilike(name)).first()
        if existing:
            customer_id = existing.customer_id
        else:
            customer_id = khata.create_customer(db, name, None, NEW_CUSTOMER_LIMIT, store_id=store_id)["customer_id"]
            new_customer = True

    lines = [{"product_id": i["product_id"], "qty": i["qty"]} for i in req.get("items") or []] if intent == "udhaar" else []
    if not lines and not req.get("amount"):
        raise VoiceError("Write the amount." if intent != "udhaar" else "Add an item or an amount.")
    out: dict[str, Any] = {"capture_id": capture_id, "intent": intent, "customer_id": customer_id, "new_customer": new_customer}
    try:
        if intent == "udhaar":
            store = db.get(Store, store_id)
            term = (store.default_credit_term_days if store else None) or 30
            due_day = req.get("due_date") or occurred + timedelta(days=term)
            if due_day <= now.date():
                due_day = now.date() + timedelta(days=1)
            due = datetime.combine(due_day, now.time().replace(microsecond=0))
            extra = float(req.get("amount") or 0)
            r = khata.record_udhaar(db, customer_id, lines, extra_amount=extra, note=note, store_id=store_id, now=now,
                                    cash_from_galla=bool(req.get("cash_from_galla")) and extra > 0, due_date=due)
            out["udhaar"], cap.ledger_entry_id = r, r["entry_id"]
        elif intent == "wasooli":
            r = khata.record_payment(db, customer_id, req["amount"], req.get("method") or "cash", note, store_id=store_id, now=now)
            out["payment"], cap.ledger_entry_id = r, r["entry_id"]
        else:
            category = req.get("expense_category")
            if not category:
                raise VoiceError("Choose what the kharcha was for.")
            r = day_service.record_expense(db, category, req["amount"], note, store_id=store_id, now=now)
            out["expense"], cap.expense_id = r, r["expense_id"]
    except Exception:
        db.rollback()
        if new_customer:  # do not leave an empty khata behind a failed save
            c = db.get(Customer, customer_id)
            if c and not c.ledger_entries:
                db.delete(c)
                db.commit()
        raise

    final = {**req, "customer_id": customer_id}
    out["edited"] = _was_edited(proposal, final)
    cap = db.get(VoiceCapture, capture_id)
    cap.status, cap.intent, cap.edited, cap.saved_at = "saved", intent, out["edited"], now
    cap.ledger_entry_id = out.get("udhaar", out.get("payment", {})).get("entry_id") if intent != "kharcha" else None
    cap.expense_id = out["expense"]["expense_id"] if intent == "kharcha" else None
    cap.final_json = json.dumps(final, default=str, ensure_ascii=False)
    db.commit()
    return out


def discard(db: Session, capture_id: int, store_id: int = 1) -> dict[str, Any]:
    cap = _pending(db, capture_id, store_id)
    cap.status = "discarded"
    db.commit()
    return {"capture_id": capture_id, "status": "discarded"}


def recording(db: Session, capture_id: int, store_id: int = 1) -> tuple[Path, str]:
    cap = db.get(VoiceCapture, capture_id)
    if not cap or cap.store_id != store_id or not cap.audio_file:
        raise LookupError("No recording for this entry.")
    path = voice_dir() / cap.audio_file
    if not path.is_file():
        raise LookupError("The recording file is missing.")
    return path, cap.audio_mime or "audio/wav"


def log(db: Session, store_id: int = 1, limit: int = 20) -> dict[str, Any]:
    q = db.query(VoiceCapture).filter(VoiceCapture.store_id == store_id)
    saved = q.filter(VoiceCapture.status == "saved").count()
    clean = q.filter(VoiceCapture.status == "saved", VoiceCapture.edited.is_(False)).count()
    discarded = q.filter(VoiceCapture.status == "discarded").count()
    answered = q.filter(VoiceCapture.status == "answered").count()
    rows = q.order_by(VoiceCapture.created_at.desc(), VoiceCapture.capture_id.desc()).limit(limit).all()
    return {
        "saved": saved, "saved_without_changes": clean, "discarded": discarded, "answered": answered,
        "captures": [{
            "capture_id": c.capture_id, "created_at": c.created_at, "source": c.source, "provider": c.provider,
            "status": c.status, "intent": c.intent, "edited": c.edited, "transcript_urdu": c.transcript_urdu,
            "transcript_roman": c.transcript_roman, "has_recording": bool(c.audio_file),
        } for c in rows],
    }
