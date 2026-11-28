"""The shop's daily workflows end to end: day open/close, khata entry, orders, ginti, report.

Each test that writes data runs on a freshly seeded store (the `reseed` fixture) and
checks the effect on the one cash book, stock and ledgers, not just the response.
"""

from app.core.database import SessionLocal
from app.models import PriceHistory, Product, Sale, StockMovement


def cash(client) -> float:
    return client.get("/api/day/today").json()["cash_in_drawer_expected_pkr"]


def stock_of(product_id: int) -> float:
    db = SessionLocal()
    try:
        return db.get(Product, product_id).stock_qty
    finally:
        db.close()


def in_stock_products(client, n: int) -> list[dict]:
    items = client.get("/api/stock-count/sheet").json()["items"]
    return [i for i in items if i["expected_qty"] >= 5][:n]


# ---- 1. Day loop -----------------------------------------------------------------

def test_day_close_books_the_galla_difference(client, reseed):
    status = client.get("/api/day/today").json()
    if status["state"] == "not_opened":
        r = client.post("/api/day/open", json={"counted_cash": status["cash_in_drawer_expected_pkr"]})
        assert r.status_code == 200 and r.json()["difference_pkr"] == 0
    assert client.post("/api/day/open", json={"counted_cash": 0}).status_code == 409  # already open

    expected = cash(client)
    r = client.post("/api/day/close", json={"counted_cash": expected - 100, "note": "test"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["difference_pkr"] == -100
    assert body["session"]["closing_difference_pkr"] == -100
    assert body["tomorrow"]["weekday"]
    assert abs(cash(client) - (expected - 100)) < 0.01, "the cash book must match the counted drawer"
    assert client.get("/api/day/today").json()["state"] == "closed"
    assert client.post("/api/day/close", json={"counted_cash": 0}).status_code == 409


def test_day_history_has_a_month_of_counts(client):
    history = client.get("/api/day/history?days=30").json()
    assert len(history) >= 29
    closed = [h for h in history if h["closed_at"]]
    assert all(h["closing_difference_pkr"] is not None for h in closed)
    assert any(h["closing_difference_pkr"] != 0 for h in closed), "a few nights are short or over"


def test_expense_comes_out_of_the_galla(client, reseed):
    before = cash(client)
    r = client.post("/api/expenses", json={"category": "electricity", "amount": 500, "note": "K-Electric"})
    assert r.status_code == 201, r.text
    assert abs(cash(client) - (before - 500)) < 0.01
    assert client.post("/api/expenses", json={"category": "general", "amount": before + 10_000}).status_code == 409


# ---- 2. Khata entry ----------------------------------------------------------------

def test_itemised_udhaar_and_wasooli_by_method(client, reseed):
    r = client.post("/api/credit/customers", json={"name": "Test Bilal", "phone": "0300-0000000", "credit_limit": 20000})
    assert r.status_code == 201, r.text
    cid = r.json()["customer_id"]
    assert client.post("/api/credit/customers", json={"name": "test bilal"}).status_code == 422  # duplicate

    check = client.post("/api/credit/check", json={"customer_id": cid, "amount": 1000}).json()
    assert check["decision"] == "yes" and check["reasons"]

    a, b = in_stock_products(client, 2)
    stock_a, cash_before = stock_of(a["product_id"]), cash(client)
    r = client.post("/api/credit/udhaar", json={
        "customer_id": cid, "items": [{"product_id": a["product_id"], "qty": 2}, {"product_id": b["product_id"], "qty": 1}],
        "extra_amount": 300, "note": "Cash loan",
    })
    assert r.status_code == 201, r.text
    u = r.json()
    expected_total = 2 * a["selling_price"] + b["selling_price"] + 300
    assert abs(u["total_pkr"] - expected_total) < 0.01
    assert abs(u["balance_pkr"] - expected_total) < 0.01
    assert a["name"] in u["receipt"]["roman_urdu"] and a["name"] in u["receipt"]["english"]
    assert u["due_date"] > u["timestamp"]
    assert abs(stock_of(a["product_id"]) - (stock_a - 2)) < 1e-6, "udhaar items leave the shelf"
    assert abs(cash(client) - cash_before) < 0.01, "udhaar brings no cash into the galla"

    ledger = client.get(f"/api/credit/customers/{cid}").json()
    line = ledger["entries"][0]
    assert line["kind"] == "purchase"
    assert {i["name"] for i in line["items"]} == {a["name"], b["name"]}

    r = client.post("/api/credit/payment", json={"customer_id": cid, "amount": 500, "method": "easypaisa"})
    assert r.status_code == 200 and r.json()["method"] == "easypaisa"
    assert abs(cash(client) - cash_before) < 0.01, "Easypaisa does not go into the galla"
    r = client.post("/api/credit/payment", json={"customer_id": cid, "amount": 400, "method": "cash"})
    assert r.status_code == 200 and "Rs 400" in r.json()["receipt"]["roman_urdu"]
    assert abs(cash(client) - (cash_before + 400)) < 0.01
    assert client.get(f"/api/credit/customers/{cid}").json()["entries"][0]["method"] == "cash"

    assert client.post("/api/credit/payment", json={"customer_id": cid, "amount": 1e6}).status_code == 422
    too_many = {"customer_id": cid, "items": [{"product_id": a["product_id"], "qty": 1e4}]}
    assert client.post("/api/credit/udhaar", json=too_many).status_code == 422


def test_credit_check_warns_on_a_late_payer(client):
    worst = client.get("/api/credit/summary").json()["top_defaulters"][0]
    check = client.post("/api/credit/check", json={"customer_id": worst["customer_id"], "amount": 2000}).json()
    assert check["decision"] in ("careful", "no")
    assert all(r["en"] and r["ur"] for r in check["reasons"])


def test_customer_list_is_most_recent_first(client):
    customers = client.get("/api/credit/customers").json()
    assert len(customers) >= 10
    stamps = [c["last_activity"] for c in customers if c["last_activity"]]
    assert stamps == sorted(stamps, reverse=True)
    assert client.get("/api/credit/customers?search=zzzz-none").json() == []


# ---- 3. Order booker -----------------------------------------------------------------

def test_order_suggest_create_receive_pay(client, reseed):
    overview = client.get("/api/orders/suppliers").json()
    budget = overview["budget"]
    assert budget["safe_to_order_pkr"] >= 0 and len(budget["explanation"]) == 4
    assert all(s["visit_days"] for s in overview["suppliers"])

    supplier = overview["suppliers"][0]
    plan = client.post("/api/orders/suggest", json={"supplier_id": supplier["supplier_id"], "budget_pkr": 100_000}).json()
    assert plan["total_allocated_spend_pkr"] <= 100_000
    assert all(l["supplier_id"] == supplier["supplier_id"] for l in plan["recommendations"])

    lines = [{"product_id": l["product_id"], "packs": l["recommended_packs"]} for l in plan["recommendations"][:3]]
    if len(lines) < 2:  # this distributor needs nothing today; order two of its products anyway
        sheet = client.get("/api/stock-count/sheet").json()["items"]
        db = SessionLocal()
        ids = [p.product_id for p in db.query(Product).filter(Product.supplier_id == supplier["supplier_id"]).limit(2)]
        db.close()
        lines = [{"product_id": pid, "packs": 1} for pid in ids]
    r = client.post("/api/orders", json={"supplier_id": supplier["supplier_id"], "lines": lines})
    assert r.status_code == 201, r.text
    order = r.json()
    assert order["status"] == "pending" and order["draft"]["roman_urdu"]
    assert any(o["purchase_id"] == order["purchase_id"] for o in client.get("/api/orders").json())

    first, second = order["lines"][0], order["lines"][1]
    stock_first = stock_of(first["product_id"])
    payable_before = next(s for s in client.get("/api/orders/suppliers").json()["suppliers"]
                          if s["supplier_id"] == supplier["supplier_id"])["total_payable_pkr"]
    receive = {
        "bill_number": "B-777",
        "lines": [
            {"product_id": first["product_id"], "received_qty": first["qty"], "unit_cost": round(first["unit_cost"] * 1.1, 2)},
            {"product_id": second["product_id"], "received_qty": max(0, second["qty"] - second["units_per_pack"]),
             "unit_cost": second["unit_cost"]},
        ],
    }
    r = client.post(f"/api/orders/{order['purchase_id']}/receive", json=receive)
    assert r.status_code == 200, r.text
    got = r.json()
    assert got["order"]["status"] == "received" and got["order"]["bill_number"] == "B-777"
    change = next(c for c in got["price_changes"] if c["product_id"] == first["product_id"])
    assert abs(change["change_pct"] - 10) < 0.2 and change["new_margin_pct"] < change["old_margin_pct"]
    assert any(s["product_id"] == second["product_id"] for s in got["short_items"])
    assert abs(stock_of(first["product_id"]) - (stock_first + first["qty"])) < 1e-6

    db = SessionLocal()
    try:
        assert abs(db.get(Product, first["product_id"]).cost_price - change["new_cost"]) < 0.01
        assert db.query(PriceHistory).filter(PriceHistory.product_id == first["product_id"],
                                             PriceHistory.reason.like("Bill B-777%")).count() == 1
    finally:
        db.close()

    after = next(s for s in client.get("/api/orders/suppliers").json()["suppliers"]
                 if s["supplier_id"] == supplier["supplier_id"])
    assert abs(after["total_payable_pkr"] - (payable_before + got["bill_total_pkr"])) < 0.5
    assert client.post(f"/api/orders/{order['purchase_id']}/receive", json=receive).status_code == 422

    before = cash(client)
    pay = min(1000.0, after["total_payable_pkr"], before)
    r = client.post("/api/payables/pay", json={"supplier_id": supplier["supplier_id"], "amount": pay, "method": "cash"})
    assert r.status_code == 200, r.text
    assert abs(cash(client) - (before - pay)) < 0.01
    r = client.post("/api/payables/pay", json={"supplier_id": supplier["supplier_id"], "amount": 1e7 - 1, "method": "bank"})
    assert r.status_code == 422


# ---- 4. Ginti ---------------------------------------------------------------------------

def test_stock_count_books_shortfall_as_sales_or_loss(client, reseed):
    sheet = client.get("/api/stock-count/sheet").json()
    assert sheet["categories"]
    cat = sheet["categories"][0]["category"]
    shelf = client.get("/api/stock-count/sheet", params={"category": cat}).json()["items"]
    assert shelf and all(i["category"] == cat for i in shelf)

    a, b, c = in_stock_products(client, 3)
    before = cash(client)
    db = SessionLocal()
    sales_before = db.query(Sale).count()
    db.close()
    r = client.post("/api/stock-count", json={"treat_short_as": "sales", "lines": [
        {"product_id": a["product_id"], "counted_qty": a["expected_qty"] - 2},
        {"product_id": b["product_id"], "counted_qty": b["expected_qty"] + 1},
        {"product_id": c["product_id"], "counted_qty": c["expected_qty"]},
    ]})
    assert r.status_code == 201, r.text
    res = r.json()
    assert (res["items_short"], res["items_extra"], res["items_matched"]) == (1, 1, 1)
    assert abs(res["inferred_sales_pkr"] - 2 * a["selling_price"]) < 0.01
    assert abs(cash(client) - (before + 2 * a["selling_price"])) < 0.01, "inferred cash sales are expected in the galla"
    assert abs(stock_of(a["product_id"]) - (a["expected_qty"] - 2)) < 1e-6
    assert abs(stock_of(b["product_id"]) - (b["expected_qty"] + 1)) < 1e-6
    db = SessionLocal()
    try:
        assert db.query(Sale).count() == sales_before + 1
    finally:
        db.close()

    # A second count of the same item knows when it was last counted.
    r = client.post("/api/stock-count", json={"lines": [{"product_id": a["product_id"], "counted_qty": a["expected_qty"] - 3}]})
    line = r.json()["lines"][0]
    assert line["last_counted_at"] is not None and line["difference_qty"] == -1
    assert line["sold_since_last_count"] == line["recorded_sales_since_last_count"] + 1
    db = SessionLocal()
    try:
        assert db.query(StockMovement).filter(StockMovement.reason == "Ginti: short on shelf").count() == 1
    finally:
        db.close()
    assert len(client.get("/api/stock-count/history").json()) == 2


# ---- 5. Business report ------------------------------------------------------------------

def test_business_report_adds_up(client):
    rep = client.get("/api/reports/business").json()
    assert rep["store"]["name"] and rep["store"]["days_of_records"] > 300
    assert len(rep["months"]) == 7 and rep["months"][-1]["is_partial"]
    for m in rep["months"]:
        assert abs(m["net_profit_pkr"] - (m["gross_profit_pkr"] - m["operating_expenses_pkr"])) <= 1
    p = rep["position"]
    wc = p["cash_in_hand_pkr"] + p["stock_value_at_cost_pkr"] + p["customer_credit_outstanding_pkr"] - p["supplier_bills_outstanding_pkr"]
    assert abs(p["working_capital_pkr"] - wc) <= 2
    assert rep["strengths"] and rep["method_notes"]
    rk = rep["record_keeping"]
    assert 29 <= rk["days_closed_last_30"] <= 30, "a 30-day window cannot hold 31 days"
    assert rk["days_galla_matched"] <= rk["days_closed_last_30"]


# ---- Regressions -------------------------------------------------------------------------

def test_suggested_budget_is_within_what_the_galla_can_bear(client):
    for s in client.get("/api/orders/suppliers").json()["suppliers"]:
        assert 0 <= s["suggested_budget_pkr"] <= s["budget"]["safe_to_order_pkr"]
        assert s["budget"]["bill_due_date"] >= client.get("/api/day/today").json()["business_date"]
        if s["usual_order_pkr"] > 0:
            assert s["suggested_budget_pkr"] <= s["usual_order_pkr"] * 1.5 + 500


def test_one_day_is_singular():
    from app.core.wording import days
    assert days(1) == "1 day" and days(3) == "3 days" and days(2.5) == "2.5 days"


def test_reasons_never_say_1_days(client):
    plan = client.post("/api/reorder-plan", json={"budget_pkr": 200000}).json()
    import re
    bad = [r for line in plan["recommendations"] for r in line["reasons"] if re.search(r"(?<![\d.])1 days", r)]
    assert not bad, bad
