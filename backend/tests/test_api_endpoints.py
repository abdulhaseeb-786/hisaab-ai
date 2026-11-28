"""End-to-end API tests: every endpoint answers with its typed contract."""

import pytest

from app.core.clock import store_now
from app.simulator.demand_profiles import HOUR_WEIGHTS


def shop_has_opened_today() -> bool:
    """The simulated shop sells from its first opening hour; earlier, today has no sales."""
    return store_now().hour > min(HOUR_WEIGHTS)


def test_health(client):
    assert client.get("/health").json() == {"status": "healthy"}


def test_store_profile_comes_from_the_database(client):
    data = client.get("/api/store").json()
    assert data["name"] == "Al-Madina General Store"
    assert data["product_count"] == 120
    assert data["data_label"] == "Demo Data"
    assert set(data["copilot"]) == {"mode", "gemini_configured", "groq_configured", "offline_available"}


def test_today_actions_have_evidence_and_both_languages(client):
    data = client.get("/api/actions/today").json()
    assert data["ranking_rule"]
    actions = data["actions"]
    assert len(actions) == 3
    assert [a["priority"] for a in actions] == [1, 2, 3]
    assert {a["action_type"] for a in actions} == {"restock", "fix_price", "collect_khata"}
    for a in actions:
        assert a["evidence"] and a["next_step"] and a["title_ur"] and a["summary_ur"]
        assert a["target"]["kind"] in ("product", "customer")


@pytest.mark.parametrize("period", ["today", "7d", "30d", "90d"])
def test_dashboard_periods(client, period):
    data = client.get(f"/api/dashboard?period={period}").json()
    assert data["period"] == period
    if period == "today" and not shop_has_opened_today():
        assert data["revenue_pkr"] == 0  # before opening time there are honestly no sales yet
    else:
        assert data["revenue_pkr"] > 0
    assert data["gross_profit_pkr"] == pytest.approx(data["revenue_pkr"] - data["cogs_pkr"], abs=1)
    assert len(data["daily_revenue"]) >= 1


def test_dashboard_rejects_unknown_period(client):
    assert client.get("/api/dashboard?period=1y").status_code == 422


def test_product_list_filters_and_counts(client):
    all_items = client.get("/api/products").json()
    assert all_items["total"] == 120
    assert all_items["counts_by_risk"]["all"] == 120
    at_risk = client.get("/api/products?status=at_risk").json()
    assert at_risk["total"] == all_items["counts_by_risk"]["at_risk"]
    assert all(p["stockout_risk"] in ("critical", "high") for p in at_risk["products"])
    search = client.get("/api/products?search=dalda").json()
    assert search["total"] >= 1 and all("dalda" in p["name"].lower() for p in search["products"])


def test_product_detail_and_404(client):
    detail = client.get("/api/products/1").json()
    assert detail["sku"] == "OIL-001"
    assert detail["image_url"].startswith("/static/")
    assert detail["price_history"]
    assert client.get("/api/products/99999").status_code == 404


def test_reorder_plan_contract(client):
    data = client.post("/api/reorder-plan", json={"budget_pkr": 50000}).json()
    assert data["total_allocated_spend_pkr"] <= 50000
    assert data["budget_respected"] is True
    assert data["plan_id"] is None  # previews are not saved unless asked
    line = data["recommendations"][0]
    assert line["reasons"] and line["reasons_ur"]
    assert client.post("/api/reorder-plan", json={"budget_pkr": 0}).status_code == 422


def test_forecast_targets(client):
    assert client.post("/api/forecast", json={"product_id": 1}).json()["target_type"] == "product"
    assert client.post("/api/forecast", json={"category": "Dairy & Breakfast"}).json()["target_type"] == "category"
    assert client.post("/api/forecast", json={}).json()["target_type"] == "store"
    assert client.post("/api/forecast", json={"product_id": 99999}).status_code == 404
    assert client.post("/api/forecast", json={"product_id": 1, "category": "x"}).status_code == 422


def test_insights_credit_payables_cash(client):
    insights = client.get("/api/insights").json()
    assert insights["margin_squeezes"] and insights["dead_stock"]
    credit = client.get("/api/credit/summary").json()
    assert credit["aging"]["total_outstanding_pkr"] > 0
    ledger = client.get("/api/credit/customers/1").json()
    assert ledger["entries"] and ledger["summary"]["customer_id"] == 1
    assert client.get("/api/credit/customers/99999").status_code == 404
    assert client.get("/api/payables/summary").json()["suppliers"]
    outlook = client.get("/api/payables/cash-outlook").json()
    assert len(outlook["days"]) == 7 and outlook["assumptions"]


def test_copilot_contract(client):
    res = client.post("/api/copilot/chat", json={
        "message": "Mere paas 50,000 rupay hain, aaj kya khareedun aur kyun?",
        "language": "roman_urdu",
        "history": [{"role": "user", "content": "salam"}, {"role": "assistant", "content": "Walaikum salam"}],
    }).json()
    assert res["provider_used"] == "offline"
    assert res["grounded"] is True
    assert res["tool_calls"][0]["tool_name"] == "generate_reorder_plan"
    assert res["tool_calls"][0]["tool_label"] == "Reorder planner"


def test_csv_template_download(client):
    r = client.get("/api/import/template/sales")
    assert r.status_code == 200
    assert r.text.startswith("sku,qty,unit_price")


def test_demo_reset_requires_key(client):
    assert client.post("/api/demo/reset").status_code == 403
    assert client.post("/api/demo/reset", headers={"X-Demo-Key": "wrong"}).status_code == 403


def test_openapi_covers_every_route(client):
    spec = client.get("/openapi.json").json()
    for path in ("/api/store", "/api/actions/today", "/api/reorder-plan", "/api/copilot/chat",
                 "/api/credit/customers/{customer_id}", "/api/payables/cash-outlook"):
        assert path in spec["paths"]
    # Every JSON endpoint declares a response model (no untyped dicts for the frontend).
    for path, methods in spec["paths"].items():
        for method, op in methods.items():
            content = op["responses"].get("200", {}).get("content", {})
            if "application/json" in content and path.startswith("/api/"):
                assert content["application/json"]["schema"], f"{method} {path} has no response schema"
