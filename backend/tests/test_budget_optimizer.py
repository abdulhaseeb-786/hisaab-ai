"""Unit tests for Budget Reorder Engine (The Hero Flow).
Requirements REC-01, REC-02, REC-03, REC-04:
- Hero flow PKR 50,000 budget test
- Strict budget cap (Total spend <= Budget entered)
- Pack rounding (recommends integers of cartons/packs)
- Zero/Negative budget rejection
"""

import pytest
from app.reorder.budget_optimizer import generate_budget_reorder_plan

def test_hero_flow_budget_reorder_50k(db_session):
    plan = generate_budget_reorder_plan(db_session, budget_pkr=50000.0, store_id=1, save_draft=False)
    
    assert plan["budget_entered_pkr"] == 50000.0
    assert plan["budget_respected"] is True
    assert plan["total_allocated_spend_pkr"] <= 50000.0
    assert plan["total_allocated_spend_pkr"] > 0.0
    assert plan["total_skus_recommended"] > 0

    # Ensure Dalda Cooking Oil (critical 2.9d cover) is prioritized #1
    top_item = plan["recommendations"][0]
    assert "Oil" in top_item["product_name"]
    assert top_item["recommended_packs"] >= 1
    assert top_item["total_units"] % top_item["units_per_pack"] == 0

def test_small_budget_constraint_enforcement(db_session):
    small_budget = 8000.0
    plan = generate_budget_reorder_plan(db_session, budget_pkr=small_budget, store_id=1, save_draft=False)

    assert plan["budget_respected"] is True
    assert plan["total_allocated_spend_pkr"] <= small_budget
    assert plan["remaining_unallocated_pkr"] >= 0.0

    for line in plan["recommendations"]:
        assert line["recommended_packs"] >= 1
        assert line["line_total_cost_pkr"] <= small_budget

def test_negative_budget_raises_error(db_session):
    with pytest.raises(ValueError):
        generate_budget_reorder_plan(db_session, budget_pkr=-500.0, store_id=1)
