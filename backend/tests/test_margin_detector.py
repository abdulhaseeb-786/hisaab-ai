"""Margin squeeze detection (PROF-01)."""

from fastapi.testclient import TestClient

from app.analytics.margin_detector import detect_margin_squeezes


def test_flags_cost_rises_not_passed_on(db_session):
    names = {s["sku"]: s for s in detect_margin_squeezes(db_session)}
    assert {"OIL-004", "TEA-001"} <= set(names)
    sufi = names["OIL-004"]
    assert sufi["cost_increase_pkr"] == 60
    assert sufi["current_margin_pct"] < sufi["previous_margin_pct"]
    assert sufi["recommended_selling_price_pkr"] == 630
    assert sufi["recommended_selling_price_pkr"] % 5 == 0


def test_passed_on_price_changes_are_not_flagged(db_session):
    flagged = {s["sku"] for s in detect_margin_squeezes(db_session)}
    for sku in ("GRN-003", "GRN-001", "SPC-009"):  # cost changed and the shelf price followed
        assert sku not in flagged


def test_sorted_by_money_at_risk(db_session):
    squeezes = detect_margin_squeezes(db_session)
    values = [s["monthly_profit_at_risk_pkr"] for s in squeezes]
    assert values == sorted(values, reverse=True)


def test_fixing_the_price_clears_the_squeeze(client: TestClient, reseed):
    assert any(s["sku"] == "OIL-004" for s in client.get("/api/insights").json()["margin_squeezes"])
    r = client.patch("/api/products/4/price", json={"new_selling_price": 630, "reason": "Restore margin"})
    assert r.status_code == 200 and r.json()["new_margin_pct"] == 14.3
    assert not any(s["sku"] == "OIL-004" for s in client.get("/api/insights").json()["margin_squeezes"])
