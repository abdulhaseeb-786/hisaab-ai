"""Voice entry ("bol kar likhein"): understanding, safety checks, and the effect on the books.

The cloud tiers are replaced by stubs here (the suite runs offline), so these tests check
our own guards: amounts must be in the words heard, a shared surname is not a match,
nothing is written before confirmation, and a cash loan leaves the galla.
"""

import io
import struct
import wave

import pytest

from app.core.database import SessionLocal
from app.models import Customer, LedgerEntry
from app.simulator.seed_generator import CUSTOMERS
from app.voice import llm
from app.voice import service as voice_service
from app.voice.names import pick, rank
from app.voice.numbers import amount_is_in, best_amount, find_amounts
from app.voice.text_parser import parse

PAIRS = [(i + 1, c.name) for i, c in enumerate(CUSTOMERS)]


# ---- amounts as people say them ---------------------------------------------------------

@pytest.mark.parametrize("said, value", [
    ("5000", 5000), ("5,000 rupay", 5000), ("۵۰۰۰ روپے", 5000), ("5k", 5000), ("5 hazaar", 5000),
    ("paanch hazaar", 5000), ("پانچ ہزار", 5000), ("dedh hazaar", 1500), ("dhai sau", 250),
    ("sawa do hazaar", 2250), ("saadhe teen hazaar", 3500), ("paune do sau", 175),
    ("ek lakh bees hazaar", 120000), ("do hazaar paanch sau", 2500), ("barah sau rupay", 1200),
    ("pachas rupay", 50), ("dedh lakh", 150000), ("two thousand five hundred", 2500),
])
def test_amount_words(said, value):
    a = best_amount(said)
    assert a is not None and a.value == value


@pytest.mark.parametrize("said", ["do kilo cheeni", "Ali 2 kilo cheeni le gaya", "do", "ek baat suno", "10 din mein"])
def test_not_amounts(said):
    assert find_amounts(said) == []


def test_amount_must_be_in_the_words():
    assert amount_is_in(5000, "Ali paanch hazaar le gaya")
    assert not amount_is_in(50000, "Ali paanch hazaar le gaya")


# ---- names -------------------------------------------------------------------------------

def test_shared_surname_is_not_a_match():
    ranked = rank("Ali Butt", PAIRS)
    assert pick(ranked) is None, "Ali Butt must never be written in Imran Butt's khata"
    assert ranked and ranked[0].name == "Imran Butt"  # offered as a choice, not picked


@pytest.mark.parametrize("spoken, khata", [
    ("Imran", "Imran Butt"), ("Tariq bhai", "Tariq Mahmood (Tariq Bhai)"), ("Tarik", "Tariq Mahmood (Tariq Bhai)"),
    ("Akram", "Chaudhry Akram"), ("Shazia baji", "Baji Shazia"), ("Salman", "Dr. Salman Qureshi"),
])
def test_clear_names_are_picked(spoken, khata):
    chosen = pick(rank(spoken, PAIRS))
    assert chosen is not None and chosen.name == khata


# ---- offline understanding ---------------------------------------------------------------

def test_parse_the_example_sentence():
    u = parse("Aaj Ali butt mujh se 5000 rupay ka udhaar le kar gaya hai, beti ki fees ke liye", PAIRS)
    assert (u.intent, u.person_name, u.amount, u.cash_from_galla, u.days_ago) == ("udhaar", "Ali Butt", 5000, True, 0)
    assert u.reason == "beti ki fees"


@pytest.mark.parametrize("said, intent, extra", [
    ("Imran ne 2000 wapas diye easypaisa pe", "wasooli", {"method": "easypaisa", "amount": 2000}),
    ("Zahid 1200 de gaya", "wasooli", {"method": "cash", "amount": 1200}),
    ("bijli ka bill 3500 diya", "kharcha", {"expense_category": "electricity", "amount": 3500}),
    ("rickshaw ka kiraya 300", "kharcha", {"expense_category": "transport"}),
    ("Kal Tariq bhai dedh hazaar ka saamaan udhaar le gaya", "udhaar", {"days_ago": 1, "cash_from_galla": False, "amount": 1500}),
    ("Ali Butt 5000 le gaya, agle hafte de dega", "udhaar", {"due_in_days": 7}),
    ("آج علی بٹ پانچ ہزار روپے ادھار لے گیا", "udhaar", {"amount": 5000}),
])
def test_parse_shop_sentences(said, intent, extra):
    u = parse(said, PAIRS)
    assert u.intent == intent
    for k, v in extra.items():
        assert getattr(u, k) == v, (k, getattr(u, k))


# ---- the API flow ------------------------------------------------------------------------

def cash(client) -> float:
    return client.get("/api/day/today").json()["cash_in_drawer_expected_pkr"]


def wav_bytes(seconds: float = 0.5) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(struct.pack("<h", 0) * int(16000 * seconds))
    return buf.getvalue()


def test_cash_loan_by_voice_leaves_the_galla(client, reseed):
    before = cash(client)
    r = client.post("/api/voice/understand", data={"text": "Aaj Ali Butt mujh se 5000 rupay ka udhaar le kar gaya, dawai ke liye"})
    assert r.status_code == 201, r.text
    p = r.json()
    assert p["provider"] == "offline" and p["intent"] == "udhaar" and p["amount_pkr"] == 5000
    assert p["person"]["match"] is None and p["person"]["spoken_name"] == "Ali Butt"
    assert p["cash_from_galla"] is True and p["reason"] == "dawai"
    assert cash(client) == before, "nothing is written before the shopkeeper confirms"

    r = client.post(f"/api/voice/captures/{p['capture_id']}/confirm", json={
        "intent": "udhaar", "amount": 5000, "new_customer_name": "Ali Butt", "cash_from_galla": True, "reason": "dawai"})
    assert r.status_code == 200, r.text
    saved = r.json()
    assert saved["new_customer"] is True and saved["edited"] is False
    assert saved["udhaar"]["total_pkr"] == 5000 and saved["udhaar"]["cash_from_galla"] is True
    assert abs(cash(client) - (before - 5000)) < 0.01, "naqad udhaar must come out of the galla"

    ledger = client.get(f"/api/credit/customers/{saved['customer_id']}").json()
    line = ledger["entries"][0]
    assert line["cash_loan"] is True and line["voice_capture_id"] == p["capture_id"] and line["has_recording"] is False
    assert "dawai" in line["description"]

    again = client.post(f"/api/voice/captures/{p['capture_id']}/confirm", json={"intent": "udhaar", "amount": 5000, "customer_id": saved["customer_id"]})
    assert again.status_code == 422, "a capture is saved only once"


def test_goods_udhaar_does_not_touch_the_galla(client, reseed):
    before = cash(client)
    p = client.post("/api/voice/understand", data={"text": "Imran dedh hazaar ka saamaan udhaar le gaya"}).json()
    assert p["person"]["match"]["name"] == "Imran Butt" and p["cash_from_galla"] is False
    r = client.post(f"/api/voice/captures/{p['capture_id']}/confirm", json={
        "intent": "udhaar", "amount": 1500, "customer_id": p["person"]["match"]["customer_id"], "cash_from_galla": False})
    assert r.status_code == 200, r.text
    assert cash(client) == before


def test_wasooli_and_kharcha_by_voice(client, reseed):
    owed = next(c for c in client.get("/api/credit/customers").json() if c["name"] == "Imran Butt")["balance_pkr"]
    assert owed >= 500
    p = client.post("/api/voice/understand", data={"text": "Imran ne 500 wapas diye jazz cash pe"}).json()
    assert p["intent"] == "wasooli" and p["method"] == "jazzcash"
    before = cash(client)
    r = client.post(f"/api/voice/captures/{p['capture_id']}/confirm", json={
        "intent": "wasooli", "amount": 500, "customer_id": p["person"]["match"]["customer_id"], "method": "jazzcash"})
    assert r.status_code == 200, r.text
    assert r.json()["payment"]["new_balance"] == round(owed - 500, 2)
    assert cash(client) == before, "JazzCash does not go in the galla"

    p = client.post("/api/voice/understand", data={"text": "bijli ka bill 300 diya"}).json()
    assert p["intent"] == "kharcha" and p["expense_category"] == "electricity"
    # The shopkeeper corrects the amount: saved, and marked as edited.
    r = client.post(f"/api/voice/captures/{p['capture_id']}/confirm", json={"intent": "kharcha", "amount": 350, "expense_category": "electricity"})
    assert r.status_code == 200 and r.json()["edited"] is True
    assert abs(cash(client) - (before - 350)) < 0.01
    log = client.get("/api/voice/log").json()
    assert log["saved"] == 2 and log["saved_without_changes"] == 1


def test_recording_is_kept_and_played_back(client, reseed):
    r = client.post("/api/voice/understand", files={"audio": ("clip.wav", wav_bytes(), "audio/wav")}, data={"seconds": "0.5"})
    assert r.status_code == 201, r.text
    p = r.json()
    assert p["has_recording"] is True and p["intent"] is None and "intent" in p["missing"]
    assert p["notes"], "the shopkeeper is told why it was not understood (no online AI permission)"
    audio = client.get(f"/api/voice/captures/{p['capture_id']}/audio")
    assert audio.status_code == 200 and audio.headers["content-type"] == "audio/wav" and audio.content[:4] == b"RIFF"
    assert client.post(f"/api/voice/captures/{p['capture_id']}/discard").status_code == 200
    assert client.get("/api/voice/log").json()["discarded"] == 1


def test_unsupported_or_empty_input(client):
    assert client.post("/api/voice/understand", data={"text": ""}).status_code == 422
    r = client.post("/api/voice/understand", files={"audio": ("x.txt", b"hello", "text/plain")})
    assert r.status_code == 422


def test_cloud_amount_not_said_is_thrown_out(client, reseed, monkeypatch):
    """The AI says Rs 50,000 but the words say paanch hazaar: the words win."""
    monkeypatch.setattr(voice_service, "providers", lambda: ["gemini", "offline"])
    monkeypatch.setattr(llm, "gemini", lambda *a, **k: {
        "transcript_urdu": "آج علی بٹ پانچ ہزار روپے ادھار لے گیا", "transcript_roman": "Aaj Ali Butt paanch hazaar rupay udhaar le gaya",
        "intent": "udhaar", "person_name_roman": "Ali Butt", "customer_match": "Imran Butt", "amount_pkr": 50000,
        "amount_words": "paanch hazaar", "cash_from_galla": True, "days_ago": 0, "due_in_days": None})
    assert client.patch("/api/voice/settings", json={"cloud_allowed": True}).json()["cloud_allowed"] is True
    p = client.post("/api/voice/understand", files={"audio": ("clip.wav", wav_bytes(), "audio/wav")}).json()
    assert p["provider"] == "gemini"
    assert p["amount_pkr"] == 5000, "an amount that was not said must never be proposed"
    assert any("50,000" in n["en"] for n in p["notes"])
    assert p["person"]["match"] is None, "the AI's surname-only match is not accepted"
    assert p["transcript_urdu"] and p["transcript_roman"]


def test_cloud_failure_falls_back_offline(client, reseed, monkeypatch):
    def boom(*a, **k):
        raise TimeoutError("no network")
    monkeypatch.setattr(voice_service, "providers", lambda: ["gemini", "offline"])
    monkeypatch.setattr(llm, "gemini", boom)
    client.patch("/api/voice/settings", json={"cloud_allowed": True})
    p = client.post("/api/voice/understand", data={"text": "Zahid 1200 de gaya"}).json()
    assert p["provider"] == "offline" and p["intent"] == "wasooli" and p["amount_pkr"] == 1200
    assert p["notes"]


def test_manual_udhaar_can_be_cash_too(client, reseed):
    """The Udhaar sheet's "other amount" can now be marked as cash from the galla."""
    before = cash(client)
    cid = next(c for c in client.get("/api/credit/customers").json() if c["name"] == "Imran Butt")["customer_id"]
    r = client.post("/api/credit/udhaar", json={"customer_id": cid, "extra_amount": 700, "note": "dawai", "cash_from_galla": True})
    assert r.status_code == 201, r.text
    assert abs(cash(client) - (before - 700)) < 0.01
    db = SessionLocal()
    try:
        e = db.get(LedgerEntry, r.json()["entry_id"])
        assert e.kind == "cash_loan"
        assert db.query(Customer).filter(Customer.name == "Imran Butt").count() == 1
    finally:
        db.close()
    too_much = client.post("/api/credit/udhaar", json={"customer_id": cid, "extra_amount": 9_000_000, "cash_from_galla": True})
    assert too_much.status_code == 422 and "cash box" in too_much.json()["detail"]


def test_retired_gemini_model_falls_through_to_the_next(monkeypatch):
    """Google retired gemini-2.5-flash (404): the next configured model must be tried."""
    from app.core import gemini_models
    from app.core.config import settings

    class Missing(Exception):
        code = 404

    calls = []

    class Models:
        def generate_content(self, model, contents, config):
            calls.append(model)
            if model == "old-model":
                raise Missing("404 NOT_FOUND. This model models/old-model is no longer available to new users.")
            return f"answer from {model}"

    class Client:
        models = Models()

    monkeypatch.setattr(settings, "GEMINI_MODEL", "old-model")
    monkeypatch.setattr(settings, "GEMINI_FALLBACK_MODELS", "new-model")
    monkeypatch.setattr(gemini_models, "_working", None)
    monkeypatch.setattr(gemini_models, "_retired", set())
    monkeypatch.setattr(gemini_models, "_resting_until", {})
    assert gemini_models.generate(Client(), [], None) == "answer from new-model"
    assert gemini_models.generate(Client(), [], None) == "answer from new-model"
    assert calls == ["old-model", "new-model", "new-model"], "the retired model is not retried"


def test_busy_model_is_skipped_and_thinking_refusal_retried(monkeypatch):
    """Overloaded (503) -> next model; a 400 on the thinking setting -> same model without it."""
    from google.genai import types

    from app.core import gemini_models
    from app.core.config import settings

    class Busy(Exception):
        code = 503

    class Invalid(Exception):
        code = 400

    calls = []

    class Models:
        def generate_content(self, model, contents, config):
            calls.append((model, config.thinking_config is not None))
            if model == "busy":
                raise Busy("503 UNAVAILABLE high demand")
            if config.thinking_config is not None:
                raise Invalid("400 INVALID_ARGUMENT")
            return "ok"

    class Client:
        models = Models()

    monkeypatch.setattr(settings, "GEMINI_MODEL", "busy")
    monkeypatch.setattr(settings, "GEMINI_FALLBACK_MODELS", "lite")
    monkeypatch.setattr(gemini_models, "_working", None)
    monkeypatch.setattr(gemini_models, "_retired", set())
    monkeypatch.setattr(gemini_models, "_resting_until", {})
    config = types.GenerateContentConfig(thinking_config=types.ThinkingConfig(thinking_budget=0))
    assert gemini_models.generate(Client(), [], config) == "ok"
    assert calls == [("busy", True), ("lite", True), ("lite", False)]
    assert "busy" in gemini_models.candidates(), "a busy model is not retired"


# ---- Phase B: goods with items ------------------------------------------------------------

from app.simulator.catalog_pakistan import CATALOG_ITEMS  # noqa: E402
from app.voice import items as item_match  # noqa: E402

CATALOG = item_match.build([item_match.Product(i + 1, c["name"], c["unit"], c["price"], 50) for i, c in enumerate(CATALOG_ITEMS)])


@pytest.mark.parametrize("said, qty, kind", [
    ("do kilo cheeni", 2, "mass"), ("2 kilo cheeni", 2, "mass"), ("aadha kilo daal", 0.5, "mass"), ("paav zeera", 0.25, "mass"),
    ("250 gram besan", 0.25, "mass"), ("ek darjan anday", 12, "dozen"), ("teen Lux sabun", 3, "count"),
    ("do packet Lays", 2, "count"), ("dedh kilo chawal", 1.5, "mass"),
])
def test_item_quantities(said, qty, kind):
    q = item_match.quantity(said)
    assert q is not None and q.qty == qty and q.kind == kind


def test_no_quantity_is_not_invented():
    assert item_match.quantity("Dalda ghee") is None
    assert item_match.to_product_qty(None, CATALOG[0]) == (1.0, False), "1 is filled in, and marked as not said"


@pytest.mark.parametrize("said, product, qty", [
    ("do kilo cheeni", "Loose White Sugar (Cheeni) 1kg", 2),
    ("5 kilo atta", "Sunridge Fortified Atta 5kg Bag", 1),        # the 5 kg bag, not five 10 kg bags
    ("Dalda ghee", "Dalda Banaspati Ghee 1kg Pouch", 1),
    ("teen Lux sabun", "Lux Soft Touch Soap 115g", 3),
    ("6 anday", "Farm Fresh Eggs White (Dozen)", 0.5),
    ("2 kilo Dalda ghee", "Dalda Banaspati Ghee 1kg Pouch", 2),    # two 1 kg pouches
    ("dalda ka tel 5 litre", "Dalda Cooking Oil 5L Tin", 1),
])
def test_items_are_matched_to_products(said, product, qty):
    q = item_match.quantity(said)
    chosen = item_match.pick(item_match.rank(said, CATALOG, q))
    assert chosen is not None and chosen.product.name == product
    assert item_match.to_product_qty(q, chosen.product)[0] == qty


@pytest.mark.parametrize("said", ["Dalda", "sabun", "double roti", "surf"])
def test_ambiguous_items_are_not_picked(said):
    ranked = item_match.rank(said, CATALOG)
    assert len(ranked) >= 2 and item_match.pick(ranked) is None


def test_ai_hint_breaks_a_tie_but_never_overrules():
    ranked = item_match.rank("Dalda", CATALOG)
    assert item_match.pick(ranked, "Dalda Banaspati Ghee 1kg Pouch").product.name == "Dalda Banaspati Ghee 1kg Pouch"
    ranked = item_match.rank("do kilo cheeni", CATALOG, item_match.quantity("do kilo cheeni"))
    assert item_match.pick(ranked, "Lux Soft Touch Soap 115g").product.name == "Loose White Sugar (Cheeni) 1kg"


def test_parse_items_from_a_sentence():
    u = parse("Aaj Tariq bhai do kilo cheeni, teen Lux sabun aur ek darjan anday udhaar le gaya", PAIRS, CATALOG)
    assert u.intent == "udhaar" and u.person_name == "Tariq Bhai" and u.cash_from_galla is False
    assert [i["words"] for i in u.items] == ["do kilo cheeni", "teen Lux sabun", "ek darjan anday"]
    u = parse("Ali 2 kilo cheeni aur ek Dalda ghee le gaya", PAIRS, CATALOG)
    assert u.person_name == "Ali" and [i["words"] for i in u.items] == ["2 kilo cheeni", "ek Dalda ghee"]
    u = parse("Zahid 500 rupay cash aur 2 kilo cheeni le gaya", PAIRS, CATALOG)
    assert u.cash_from_galla is True and u.amount == 500 and len(u.items) == 1


def _stock(product_id: int) -> float:
    db = SessionLocal()
    try:
        from app.models import Product
        return db.get(Product, product_id).stock_qty
    finally:
        db.close()


def test_goods_by_voice_takes_stock_not_cash(client, reseed):
    before = cash(client)
    p = client.post("/api/voice/understand", data={"text": "Imran do kilo cheeni aur teen Lux sabun le gaya"}).json()
    assert p["intent"] == "udhaar" and p["cash_from_galla"] is False and p["extra_amount_pkr"] is None
    assert "amount" not in p["missing"] and "item" not in p["missing"]
    sugar, soap = (i["match"] for i in p["items"])
    assert (sugar["qty"], soap["qty"]) == (2, 3)
    assert p["items_total_pkr"] == round(2 * sugar["selling_price"] + 3 * soap["selling_price"], 2)
    stock = _stock(sugar["product_id"])
    r = client.post(f"/api/voice/captures/{p['capture_id']}/confirm", json={
        "intent": "udhaar", "amount": 0, "customer_id": p["person"]["match"]["customer_id"], "cash_from_galla": False,
        "items": [{"product_id": sugar["product_id"], "qty": 2}, {"product_id": soap["product_id"], "qty": 3}]})
    assert r.status_code == 200, r.text
    saved = r.json()
    assert saved["edited"] is False and saved["udhaar"]["total_pkr"] == p["items_total_pkr"]
    assert [i["name"] for i in saved["udhaar"]["items"]] == [sugar["name"], soap["name"]]
    assert _stock(sugar["product_id"]) == stock - 2, "items leave the shelf"
    assert cash(client) == before, "goods on udhaar do not touch the cash box"
    line = client.get(f"/api/credit/customers/{saved['customer_id']}").json()["entries"][0]
    assert len(line["items"]) == 2 and line["voice_capture_id"] == p["capture_id"]


def test_cash_and_goods_together(client, reseed):
    before = cash(client)
    p = client.post("/api/voice/understand", data={"text": "Zahid 500 rupay cash aur 2 kilo cheeni le gaya"}).json()
    assert p["extra_amount_pkr"] == 500 and p["cash_from_galla"] is True and len(p["items"]) == 1
    sugar = p["items"][0]["match"]
    r = client.post(f"/api/voice/captures/{p['capture_id']}/confirm", json={
        "intent": "udhaar", "amount": 500, "customer_id": p["person"]["match"]["customer_id"], "cash_from_galla": True,
        "items": [{"product_id": sugar["product_id"], "qty": 2}]})
    assert r.status_code == 200, r.text
    assert r.json()["udhaar"]["total_pkr"] == round(500 + 2 * sugar["selling_price"], 2)
    assert abs(cash(client) - (before - 500)) < 0.01, "only the cash part leaves the cash box"


def test_ambiguous_item_waits_for_the_shopkeeper(client, reseed):
    p = client.post("/api/voice/understand", data={"text": "Imran Dalda le gaya"}).json()
    item = p["items"][0]
    assert item["match"] is None and "item" in p["missing"] and len(item["options"]) >= 2
    assert item["qty_heard"] is False and any("quantity" in n["en"] for n in p["notes"])
    empty = client.post(f"/api/voice/captures/{p['capture_id']}/confirm", json={
        "intent": "udhaar", "amount": 0, "customer_id": p["person"]["match"]["customer_id"], "items": []})
    assert empty.status_code == 422, "nothing to write: no item, no amount"


def test_ai_items_must_be_in_the_words(client, reseed, monkeypatch):
    """The AI adds an item nobody said, and a quantity that is not in the words: both are ignored."""
    monkeypatch.setattr(voice_service, "providers", lambda: ["gemini", "offline"])
    monkeypatch.setattr(llm, "gemini", lambda *a, **k: {
        "transcript_urdu": "عمران دو کلو چینی لے گیا", "transcript_roman": "Imran do kilo cheeni le gaya",
        "intent": "udhaar", "person_name_roman": "Imran", "amount_pkr": None, "days_ago": 0, "cash_from_galla": False,
        "items": [{"words_roman": "do kilo cheeni", "words_urdu": "دو کلو چینی", "product_match": "Loose White Sugar (Cheeni) 1kg"},
                  {"words_roman": "panch Pepsi", "product_match": "Pepsi 1.5L PET Bottle"}]})
    client.patch("/api/voice/settings", json={"cloud_allowed": True})
    p = client.post("/api/voice/understand", data={"text": "Imran do kilo cheeni le gaya"}).json()
    assert [i["words"] for i in p["items"]] == ["do kilo cheeni"], "Pepsi was never said"
    assert p["items"][0]["match"]["qty"] == 2 and p["items"][0]["words_urdu"] == "دو کلو چینی"
    assert any("Pepsi" in n["en"] for n in p["notes"])


def test_manual_udhaar_items_plus_cash_takes_only_the_cash(client, reseed):
    """Same bug, manual screen: items + 'given as cash' must take only the cash out of the cash box."""
    before = cash(client)
    cid = next(c for c in client.get("/api/credit/customers").json() if c["name"] == "Imran Butt")["customer_id"]
    sugar = next(i for i, c in enumerate(CATALOG_ITEMS) if c["sku"] == "GRN-003") + 1
    r = client.post("/api/credit/udhaar", json={"customer_id": cid, "items": [{"product_id": sugar, "qty": 1}],
                                                "extra_amount": 300, "cash_from_galla": True})
    assert r.status_code == 201, r.text
    assert abs(cash(client) - (before - 300)) < 0.01


def test_busy_model_is_tried_first_again_next_time(monkeypatch):
    """Once the main model is free again it answers, not the less accurate fallback."""
    from app.core import gemini_models
    from app.core.config import settings

    class Busy(Exception):
        code = 503

    state = {"busy": True}
    calls = []

    class Models:
        def generate_content(self, model, contents, config):
            calls.append(model)
            if model == "main" and state["busy"]:
                raise Busy("503 UNAVAILABLE")
            return model

    class Client:
        models = Models()

    monkeypatch.setattr(settings, "GEMINI_MODEL", "main")
    monkeypatch.setattr(settings, "GEMINI_FALLBACK_MODELS", "lite")
    monkeypatch.setattr(gemini_models, "_working", None)
    monkeypatch.setattr(gemini_models, "_retired", set())
    monkeypatch.setattr(gemini_models, "_resting_until", {})
    clock = {"t": 1000.0}
    monkeypatch.setattr(gemini_models, "_clock", lambda: clock["t"])
    assert gemini_models.generate(Client(), [], None) == "lite"
    # Within the rest period the busy model is not waited on again...
    assert gemini_models.generate(Client(), [], None) == "lite"
    # ...and after it, it is first again.
    state["busy"] = False
    clock["t"] += gemini_models.BUSY_COOLDOWN_SECONDS + 1
    assert gemini_models.generate(Client(), [], None) == "main"
    assert calls == ["main", "lite", "lite", "main"]


# ---- Phase C: questions ---------------------------------------------------------------------

@pytest.mark.parametrize("said", ["Imran ka kitna baqi hai?", "aaj kitni sale hui", "cheeni kitni bachi hai",
                                  "کیا عمران کا ادھار باقی ہے؟", "kal 500 diye the, kitna baqi hai?"])
def test_questions_are_recognised(said):
    assert parse(said, PAIRS).intent == "question"


@pytest.mark.parametrize("said", ["Ali Butt 5000 rupay udhaar le gaya", "Zahid 1200 de gaya", "bijli ka bill 3500 diya"])
def test_entries_are_not_questions(said):
    assert parse(said, PAIRS).intent != "question"


def test_offline_copilot_reads_a_named_customer_as_khata(db_session):
    from app.copilot.fallback_engine import run_deterministic_copilot
    out = run_deterministic_copilot(db_session, "Imran ka kitna baqi hai?")
    assert [c["tool_name"] for c in out["tool_calls"]][-1] == "get_credit_summary"
    assert "Imran Butt" in out["response"]


def test_question_by_voice_is_answered_and_nothing_is_written(client, reseed):
    db = SessionLocal()
    try:
        entries = db.query(LedgerEntry).count()
    finally:
        db.close()
    before = cash(client)
    p = client.post("/api/voice/understand", data={"text": "Imran ka kitna baqi hai?"}).json()
    assert p["intent"] == "question" and p["question"] == "Imran ka kitna baqi hai?"
    a = p["answer"]
    assert a["provider_used"] == "offline" and a["grounded"] is True
    assert "Imran Butt" in a["response"] and a["tool_calls"][0]["tool_name"] == "get_credit_summary"
    owed = next(c for c in client.get("/api/credit/customers").json() if c["name"] == "Imran Butt")["balance_pkr"]
    assert f"Rs {owed:,.0f}" in a["response"], "the number comes from the khata, not from speech"
    db = SessionLocal()
    try:
        assert db.query(LedgerEntry).count() == entries
    finally:
        db.close()
    assert cash(client) == before
    again = client.post(f"/api/voice/captures/{p['capture_id']}/confirm", json={"intent": "udhaar", "amount": 100, "customer_id": 1})
    assert again.status_code == 422 and "question" in again.json()["detail"]
    assert client.get("/api/voice/log").json()["answered"] == 1


def test_ai_question_uses_the_exact_name(client, reseed, monkeypatch):
    """The AI rewrites the spoken question with the khata's exact name; the copilot answers it."""
    seen = {}
    monkeypatch.setattr(voice_service, "providers", lambda: ["gemini", "offline"])
    monkeypatch.setattr(llm, "gemini", lambda *a, **k: {
        "transcript_urdu": "طارق بھائی کا کتنا ادھار ہے", "transcript_roman": "Tariq bhai ka kitna udhaar hai",
        "intent": "question", "question_roman": "Tariq Mahmood (Tariq Bhai) ka kitna udhaar baqi hai?",
        "amount_pkr": None, "days_ago": 0})
    import app.copilot.llm_client as copilot

    real = copilot.chat_with_copilot

    def spy(db, message, language="roman_urdu", history=None, store_id=1):
        seen["message"], seen["language"] = message, language
        return real(db, message=message, language=language, history=history, store_id=store_id)

    monkeypatch.setattr(copilot, "chat_with_copilot", spy)
    client.patch("/api/voice/settings", json={"cloud_allowed": True})
    p = client.post("/api/voice/understand", files={"audio": ("clip.wav", wav_bytes(), "audio/wav")},
                    data={"answer_language": "urdu"}).json()
    assert p["intent"] == "question" and p["provider"] == "gemini"
    assert seen == {"message": "Tariq Mahmood (Tariq Bhai) ka kitna udhaar baqi hai?", "language": "urdu"}
    assert "Tariq" in p["answer"]["response"] and p["has_recording"] is True


def test_typed_question_is_shown_as_typed(client, reseed, monkeypatch):
    """For typed text the AI's 'transcript' is a translation: 'You asked' shows what was typed."""
    monkeypatch.setattr(voice_service, "providers", lambda: ["gemini", "offline"])
    monkeypatch.setattr(llm, "gemini", lambda *a, **k: {
        "transcript_urdu": "عمران کا کتنا بقایا ہے؟", "transcript_roman": "Imran ka kitna baqaya hai?",
        "intent": "question", "question_roman": "How much does Imran Butt owe?", "amount_pkr": None, "days_ago": 0})
    client.patch("/api/voice/settings", json={"cloud_allowed": True})
    p = client.post("/api/voice/understand", data={"text": "How much does Imran owe?", "answer_language": "english"}).json()
    assert p["intent"] == "question" and p["transcript_roman"] == "How much does Imran owe?" and p["transcript_urdu"] is None
    assert p["question"] == "How much does Imran Butt owe?" and p["answer"]["language"] == "english"
