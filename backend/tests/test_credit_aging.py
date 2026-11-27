"""Khata: FIFO aging, default credit term, Safe Mark reasons (CRED-01)."""

from datetime import datetime, timedelta
from types import SimpleNamespace

from app.analytics.credit_aging import _analyse_customer, calculate_credit_summary


def _entry(ts, debit=0.0, credit=0.0, due=None):
    return SimpleNamespace(timestamp=ts, debit=debit, credit=credit, due_date=due)


NOW = datetime(2026, 6, 30, 12, 0)


def test_payments_clear_oldest_bills_first():
    entries = [
        _entry(NOW - timedelta(days=90), debit=1000),  # 60 days overdue
        _entry(NOW - timedelta(days=45), debit=2000),  # 15 days overdue
        _entry(NOW - timedelta(days=10), debit=500),   # not due yet
        _entry(NOW - timedelta(days=5), credit=1500),  # pays the first bill and half of the second
    ]
    info = _analyse_customer(entries, default_term=30, now=NOW)
    assert info["balance"] == 2000
    assert info["buckets"]["overdue_61_plus"] == 0
    assert info["buckets"]["overdue_1_30"] == 1500
    assert info["buckets"]["not_due"] == 500
    assert info["max_days"] == 15


def test_default_term_applies_when_no_due_date():
    entries = [_entry(NOW - timedelta(days=31), debit=800)]
    info = _analyse_customer(entries, default_term=30, now=NOW)
    assert info["overdue"] == 800 and info["max_days"] == 1


def test_explicit_due_date_wins():
    entries = [_entry(NOW - timedelta(days=31), debit=800, due=NOW + timedelta(days=5))]
    assert _analyse_customer(entries, default_term=30, now=NOW)["overdue"] == 0


def test_summary_reconciles_with_customers(db_session):
    s = calculate_credit_summary(db_session)
    a = s["aging"]
    assert round(sum(c["total_balance_pkr"] for c in s["customers"]), 2) == a["total_outstanding_pkr"]
    buckets = a["not_due_pkr"] + a["overdue_1_30_days_pkr"] + a["overdue_31_60_days_pkr"] + a["overdue_61_plus_days_pkr"]
    assert abs(buckets - a["total_outstanding_pkr"]) < 1
    assert abs(a["total_overdue_pkr"] - (buckets - a["not_due_pkr"])) < 1


def test_tariq_bhai_is_the_top_collection_and_score_is_explained(db_session):
    s = calculate_credit_summary(db_session)
    top = s["top_defaulters"][0]
    assert "Tariq" in top["name"]
    assert top["days_overdue"] > 30
    assert top["risk_level"] == "high"
    assert top["over_limit"] is True
    assert top["score_factors"]
    assert round(100 + sum(f["points"] for f in top["score_factors"]), 1) == max(0.0, top["safe_mark_score"]) or top["safe_mark_score"] == 0


def test_not_every_customer_is_overdue(db_session):
    s = calculate_credit_summary(db_session)
    assert 0 < s["total_overdue_customers"] < s["total_customers_with_balance"]


def test_summary_does_not_write_to_the_database(db_session):
    calculate_credit_summary(db_session)
    assert not db_session.dirty and not db_session.new
