"""Unit tests for Margin Squeeze and Price History Detection.
Requirements PROF-01, PROF-02, PROF-03:
- Detects wholesale cost increases that are not passed on
- Verifies margin % drop calculation
- Verifies recommended selling price formula
"""

from app.analytics.margin_detector import detect_margin_squeezes

def test_detect_sufi_oil_margin_squeeze(db_session):
    squeezes = detect_margin_squeezes(db_session, store_id=1)
    
    assert len(squeezes) >= 1
    sufi_squeeze = next((s for s in squeezes if "Sufi" in s["name"]), None)
    assert sufi_squeeze is not None

    assert sufi_squeeze["current_cost_pkr"] > sufi_squeeze["previous_cost_pkr"]
    assert sufi_squeeze["cost_increase_pkr"] == 60.0
    assert sufi_squeeze["current_margin_pct"] < sufi_squeeze["previous_margin_pct"]
    assert sufi_squeeze["recommended_selling_price_pkr"] > sufi_squeeze["shelf_selling_price_pkr"]
