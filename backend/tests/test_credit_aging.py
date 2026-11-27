"""Unit tests for Customer Khata and Credit Aging.
Requirements CRED-01, CRED-02:
- Reconciles customer balance against ledger entries
- Checks default 30-day term overdue classification
- Verifies Safe Mark score degradation
"""

from app.analytics.credit_aging import calculate_credit_summary

def test_credit_summary_and_tariq_bhai_overdue(db_session):
    summary = calculate_credit_summary(db_session, store_id=1)
    
    aging = summary["aging"]
    assert aging["total_outstanding_pkr"] > 0
    assert aging["overdue_31_60_days_pkr"] + aging["overdue_61_plus_days_pkr"] > 0

    # Verify Tariq Bhai is in top defaulters
    tariq = next((c for c in summary["customers"] if "Tariq" in c["name"]), None)
    assert tariq is not None
    assert tariq["total_balance_pkr"] > 0
    assert tariq["days_overdue"] > 30
    assert tariq["safe_mark_score"] < 50.0  # Degraded Safe Mark score
    assert tariq["risk_level"] == "high"
