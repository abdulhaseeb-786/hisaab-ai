"""Data integrity and cross-screen consistency (DATA-01, DATA-03)."""

from sqlalchemy import func

from app.analytics.cash_book import cash_position
from app.analytics.cash_outlook import calculate_cash_outlook
from app.analytics.credit_aging import calculate_credit_summary
from app.analytics.kpi_calculator import calculate_kpis
from app.analytics.payables import calculate_payables
from app.core.clock import store_today
from app.models import LedgerEntry, Product, Purchase, Sale, SaleLine, StockMovement


def test_every_sale_total_matches_its_lines(db_session):
    mismatches = (
        db_session.query(Sale.sale_id)
        .join(SaleLine, SaleLine.sale_id == Sale.sale_id)
        .group_by(Sale.sale_id)
        .having(func.abs(Sale.total - func.sum(SaleLine.qty * SaleLine.unit_price - SaleLine.discount)) > 0.01)
        .count()
    )
    assert mismatches == 0


def test_stock_equals_sum_of_movements(db_session):
    sums = dict(db_session.query(StockMovement.product_id, func.sum(StockMovement.qty_delta)).group_by(StockMovement.product_id))
    for p in db_session.query(Product):
        assert abs(p.stock_qty - sums.get(p.product_id, 0.0)) < 0.01, p.sku
        assert p.stock_qty >= 0


def test_khata_balances_reconcile_to_the_ledger(db_session):
    debit, credit = db_session.query(func.sum(LedgerEntry.debit), func.sum(LedgerEntry.credit)).one()
    summary = calculate_credit_summary(db_session)
    assert abs((debit - credit) - summary["aging"]["total_outstanding_pkr"]) < 1


def test_prices_are_sane(db_session):
    for p in db_session.query(Product):
        assert p.cost_price > 0 and p.selling_price > 0


def test_data_ends_today_and_has_pending_orders(db_session):
    last_sale = db_session.query(func.max(Sale.timestamp)).scalar()
    assert last_sale.date() == store_today()
    assert db_session.query(Purchase).filter(Purchase.status == "pending").count() > 0


def test_screens_agree_on_payables_and_cash(db_session):
    kpis = calculate_kpis(db_session)
    payables = calculate_payables(db_session)
    outlook = calculate_cash_outlook(db_session)
    assert kpis["payables_due_7d_pkr"] == payables["due_within_horizon_pkr"]
    assert kpis["payables_total_pkr"] == payables["total_payables_pkr"]
    assert kpis["cash_in_hand_pkr"] == outlook["opening_cash_pkr"] == cash_position(db_session)["cash_in_hand_pkr"]
    assert kpis["overdue_receivables_pkr"] == calculate_credit_summary(db_session)["aging"]["total_overdue_pkr"]


def test_cash_outlook_days_add_up(db_session):
    o = calculate_cash_outlook(db_session)
    balance = o["opening_cash_pkr"]
    for d in o["days"]:
        assert d["opening_cash_pkr"] == balance
        balance = d["opening_cash_pkr"] + d["cash_sales_in_pkr"] + d["wasooli_in_pkr"] - d["supplier_payments_out_pkr"] - d["expenses_out_pkr"]
        assert abs(balance - d["closing_cash_pkr"]) <= 1
    assert o["projected_closing_cash_pkr"] == o["days"][-1]["closing_cash_pkr"]
    assert o["opening_cash_pkr"] > 0


def test_demo_is_realistic(db_session):
    k = calculate_kpis(db_session, period="30d")
    assert 8 <= k["gross_margin_pct"] <= 16
    assert k["operating_expenses_pkr"] < k["gross_profit_pkr"]  # the shop makes money
    assert k["cash_in_hand_pkr"] > 0
    assert k["overdue_receivables_pkr"] < k["receivables_outstanding_pkr"]
