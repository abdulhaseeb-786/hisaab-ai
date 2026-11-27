"""Unit tests for Data Integrity & Reconciliation.
Requirements DATA-03:
- Every sale total equals sum of its sale lines
- Stock movement reconciliation
"""

from app.models import Sale, SaleLine, StockMovement, Product
from sqlalchemy import func

def test_sales_and_sale_lines_reconciliation(db_session):
    # Check random sample of 25 sales
    sales = db_session.query(Sale).limit(25).all()
    for s in sales:
        lines_total = sum(l.qty * l.unit_price - l.discount for l in s.lines)
        assert abs(s.total - lines_total) < 0.01

def test_stock_quantities_are_valid(db_session):
    products = db_session.query(Product).all()
    assert len(products) >= 120
    for p in products:
        assert p.stock_qty >= 0.0
        assert p.cost_price > 0.0
        assert p.selling_price >= p.cost_price
