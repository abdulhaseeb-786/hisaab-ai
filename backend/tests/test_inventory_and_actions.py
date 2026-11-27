"""Inventory risk, dead stock, Today's actions and the demo scenarios (INV-01..03, HOME-01)."""

from app.analytics.dead_stock import detect_dead_stock
from app.analytics.inventory_rules import compute_inventory_health
from app.analytics.today_actions import get_today_three_actions
from app.simulator.reset import reset_and_seed_database


def _by_sku(db):
    return {i["sku"]: i for i in compute_inventory_health(db)}


def test_dalda_is_critical_with_a_reason(db_session):
    dalda = _by_sku(db_session)["OIL-001"]
    assert dalda["stock_qty"] == 8
    assert dalda["stockout_risk"] == "critical"
    assert dalda["days_of_cover"] < dalda["lead_time_days"]
    assert "4 days" in dalda["risk_reason"]
    assert dalda["risk_reason_ur"]


def test_risk_rule_matches_its_definition(db_session):
    for i in compute_inventory_health(db_session):
        cover, lead, safety = i["effective_cover_days"], i["lead_time_days"], i["safety_stock_days"]
        if cover is None:
            assert i["stockout_risk"] == "unknown"
        elif cover < lead:
            assert i["stockout_risk"] == "critical"
        elif cover < lead + safety:
            assert i["stockout_risk"] == "high"


def test_dead_stock_is_a_signal_with_evidence(db_session):
    dead = detect_dead_stock(db_session)
    sparkle = next(d for d in dead if d["sku"] == "CLN-012")
    assert sparkle["days_since_last_sale"] >= 30
    assert sparkle["tied_up_capital_pkr"] > 5000


def test_actions_are_ranked_by_the_visible_rule(db_session):
    actions = get_today_three_actions(db_session)
    assert actions[0]["action_type"] == "restock" and actions[0]["urgency"] == "critical"
    assert actions[0]["evidence"]["sku"] == "OIL-001"
    assert actions[1]["action_type"] == "fix_price"
    assert actions[2]["action_type"] == "collect_khata"
    assert actions[2]["target"]["kind"] == "customer"
    assert all(a["money_at_stake_pkr"] > 0 for a in actions)


def test_reset_is_deterministic(db_session):
    first = reset_and_seed_database(seed=42)
    a = _by_sku(db_session)
    second = reset_and_seed_database(seed=42)
    db_session.expire_all()
    b = _by_sku(db_session)
    assert first["sales"] == second["sales"]
    assert {k: v["stock_qty"] for k, v in a.items()} == {k: v["stock_qty"] for k, v in b.items()}
