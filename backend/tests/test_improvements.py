"""Workflow fixes from improve01.md: the whole-shop budget plan saves real orders, the day
close leaves tomorrow's brief, and so on. Each test checks the books, not just the response."""

from app.core.database import SessionLocal
from app.models import Purchase


def pending_orders() -> int:
    db = SessionLocal()
    try:
        return db.query(Purchase).filter(Purchase.status == "pending").count()
    finally:
        db.close()


def plan_lines(client, budget: int = 50_000) -> tuple[dict, list[dict]]:
    plan = client.post("/api/reorder-plan", json={"budget_pkr": budget, "target_cover_days": 14}).json()
    lines = [{"product_id": l["product_id"], "supplier_id": l["supplier_id"], "packs": l["recommended_packs"]}
             for l in plan["recommendations"] if l["supplier_id"]]
    assert lines, "the demo plan should recommend something"
    return plan, lines


def test_budget_plan_saves_one_order_per_distributor(client, reseed):
    plan, lines = plan_lines(client)
    before = pending_orders()
    r = client.post("/api/orders/from-plan", json={"budget_pkr": 50_000, "lines": lines})
    assert r.status_code == 201, r.text
    body = r.json()
    suppliers = {l["supplier_id"] for l in lines}
    assert len(body["orders"]) == len(suppliers)
    assert all(o["status"] == "pending" and o["draft"]["roman_urdu"] for o in body["orders"])
    assert body["total_pkr"] <= 50_000 + 0.5, "saved orders never exceed the budget"
    assert abs(body["total_pkr"] - plan["total_allocated_spend_pkr"]) < 1, "orders cost what the plan showed"
    assert pending_orders() == before + len(suppliers)

    # The saved order goes through Maal aaya like any booker order.
    o = body["orders"][0]
    rec = client.post(f"/api/orders/{o['purchase_id']}/receive", json={
        "lines": [{"product_id": l["product_id"], "received_qty": l["qty"], "unit_cost": l["unit_cost"]} for l in o["lines"]],
        "bill_number": "TEST-1", "pay_now_pkr": 0, "method": "cash"})
    assert rec.status_code == 200, rec.text


def test_budget_plan_over_budget_saves_nothing(client, reseed):
    _, lines = plan_lines(client)
    before = pending_orders()
    r = client.post("/api/orders/from-plan", json={"budget_pkr": 1_000, "lines": lines})
    assert r.status_code == 422 and "budget" in r.json()["detail"]
    assert pending_orders() == before


def test_budget_plan_is_all_or_nothing(client, reseed):
    _, lines = plan_lines(client)
    before = pending_orders()
    bad = lines + [{"product_id": lines[0]["product_id"], "supplier_id": 9999, "packs": 1}]
    r = client.post("/api/orders/from-plan", json={"budget_pkr": 10_000_000, "lines": bad})
    assert r.status_code in (404, 422)
    assert pending_orders() == before, "a failure part-way must not leave some orders saved"


def test_booker_order_still_works(client, reseed):
    s = client.get("/api/orders/suppliers").json()["suppliers"][0]
    sug = client.post("/api/orders/suggest", json={"supplier_id": s["supplier_id"], "budget_pkr": 20_000}).json()
    line = next(l for l in sug["recommendations"] if l["recommended_packs"] > 0)
    r = client.post("/api/orders", json={"supplier_id": s["supplier_id"], "lines": [{"product_id": line["product_id"], "packs": 1}]})
    assert r.status_code == 201 and r.json()["status"] == "pending"


def test_tomorrow_brief_stays_on_today_after_closing(client, reseed):
    status = client.get("/api/day/today").json()
    if status["state"] == "not_opened":
        assert client.post("/api/day/open", json={"counted_cash": status["cash_in_drawer_expected_pkr"]}).status_code == 200
    assert client.get("/api/day/today").json()["tomorrow"] is None, "no brief while the shop is open"
    expected = client.get("/api/day/today").json()["cash_in_drawer_expected_pkr"]
    closed = client.post("/api/day/close", json={"counted_cash": expected}).json()
    after = client.get("/api/day/today").json()
    assert after["state"] == "closed"
    assert after["tomorrow"] == closed["tomorrow"], "the same plan the close screen showed"
    assert after["tomorrow"]["weekday"]
