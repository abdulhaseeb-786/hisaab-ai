"""Hero flow: the budget reorder planner (REC-01..04)."""

import math

import pytest

from app.analytics.inventory_rules import compute_inventory_health
from app.reorder.budget_optimizer import generate_budget_reorder_plan


@pytest.mark.parametrize("budget", [1_000, 5_000, 8_000, 25_000, 50_000, 73_456, 100_000, 250_000, 2_000_000])
def test_never_exceeds_budget(db_session, budget):
    plan = generate_budget_reorder_plan(db_session, budget_pkr=budget)
    assert plan["total_allocated_spend_pkr"] <= budget + 0.01
    assert plan["remaining_unallocated_pkr"] >= -0.01
    assert plan["total_allocated_spend_pkr"] == pytest.approx(
        sum(l["line_total_cost_pkr"] for l in plan["recommendations"]), abs=0.01)


def test_whole_packs_only(db_session):
    plan = generate_budget_reorder_plan(db_session, budget_pkr=100_000)
    for line in plan["recommendations"]:
        assert line["recommended_packs"] >= 1
        assert line["total_units"] == line["recommended_packs"] * line["units_per_pack"]
        assert line["line_total_cost_pkr"] == pytest.approx(line["total_units"] * line["estimated_unit_cost"], abs=0.01)


def test_hero_question_puts_the_critical_item_first(db_session):
    plan = generate_budget_reorder_plan(db_session, budget_pkr=50_000)
    top = plan["recommendations"][0]
    assert top["sku"] == "OIL-001"
    assert top["days_of_cover_before"] < top["lead_time_days"]
    assert top["projected_cover_after"] > top["lead_time_days"]


def test_orders_already_on_the_way_are_netted(db_session):
    items = {i["product_id"]: i for i in compute_inventory_health(db_session)}
    plan = generate_budget_reorder_plan(db_session, budget_pkr=2_000_000)
    for line in plan["recommendations"]:
        item = items[line["product_id"]]
        need = item["recommended_order_qty"]
        # Never orders more than one extra pack beyond the net need (rounding up to packs).
        assert line["total_units"] < need + line["units_per_pack"] + 1e-6 or line["recommended_packs"] == 1


def test_tiny_budget_skips_with_reasons(db_session):
    plan = generate_budget_reorder_plan(db_session, budget_pkr=1_000)
    assert plan["total_allocated_spend_pkr"] <= 1_000
    assert plan["skipped_count"] > 0
    assert all(s["reason"] for s in plan["skipped"])


def test_invalid_budget(db_session):
    with pytest.raises(ValueError):
        generate_budget_reorder_plan(db_session, budget_pkr=-500)


def _protected(plan_lines, items) -> int:
    """How many at-risk items end up with enough stock to last until a delivery arrives."""
    bought = {l["product_id"]: l["total_units"] for l in plan_lines}
    count = 0
    for i in items:
        if i["stockout_risk"] not in ("critical", "high"):
            continue
        cover = (i["stock_qty"] + i["pending_receipts"] + bought.get(i["product_id"], 0)) / i["average_daily_demand"]
        if cover >= i["lead_time_days"] + i["safety_stock_days"]:
            count += 1
    return count


def test_beats_a_proportional_baseline_on_stockout_protection(db_session):
    """PRD rule: compare against a simple proportional split of the budget."""
    budget = 25_000
    items = [i for i in compute_inventory_health(db_session) if i["average_daily_demand"]]
    needing = [i for i in items if i["recommended_order_qty"] > 0]
    need_cost = {i["product_id"]: i["recommended_order_qty"] * i["cost_price"] for i in needing}
    total_need = sum(need_cost.values())

    baseline_lines = []
    for i in needing:
        share = budget * need_cost[i["product_id"]] / total_need
        per_pack = i["pack_info"]["units_per_pack"]
        packs = math.floor(share / (per_pack * i["cost_price"]))
        if packs:
            baseline_lines.append({"product_id": i["product_id"], "total_units": packs * per_pack})

    plan = generate_budget_reorder_plan(db_session, budget_pkr=budget)
    assert _protected(plan["recommendations"], items) >= _protected(baseline_lines, items)
    assert _protected(plan["recommendations"], items) >= 1
