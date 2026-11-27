"""CSV import: preview with row errors, then commit (DATA-02)."""

from pathlib import Path

import pytest

from app.importer.csv_service import commit_csv_batch, validate_and_preview_csv
from app.models import Product, Sale

FIXTURES = Path(__file__).parent / "fixtures"


def test_products_preview_reports_bad_rows(db_session):
    res = validate_and_preview_csv(db_session, (FIXTURES / "sample_products.csv").read_text(), "products")
    assert res["total_rows"] == 5
    assert res["valid_rows_count"] == 4
    assert res["invalid_rows_count"] == 1
    assert res["row_errors"][0]["row_number"] == 6
    assert "below cost price" in res["row_errors"][0]["error"]


def test_sales_preview_checks_sku_exists(db_session):
    res = validate_and_preview_csv(db_session, (FIXTURES / "sample_sales.csv").read_text(), "sales")
    assert res["valid_rows_count"] == 4
    assert res["invalid_rows_count"] == 1  # one row, two problems
    fields = {e["field"] for e in res["row_errors"]}
    assert fields == {"sku", "qty"}


def test_missing_columns_are_explained(db_session):
    with pytest.raises(ValueError, match="Missing required column"):
        validate_and_preview_csv(db_session, "sku,name\nA,B\n", "products")


def test_bad_dates_and_payment_types(db_session):
    csv = "sku,qty,unit_price,timestamp,payment_type\nOIL-001,1,550,yesterday,cash\nOIL-001,1,550,2026-01-05 10:00,card\n"
    res = validate_and_preview_csv(db_session, csv, "sales")
    assert res["valid_rows_count"] == 0
    assert {e["field"] for e in res["row_errors"]} == {"timestamp", "payment_type"}


def test_commit_products_and_token_is_single_use(db_session, reseed):
    preview = validate_and_preview_csv(db_session, (FIXTURES / "sample_products.csv").read_text(), "products")
    result = commit_csv_batch(db_session, preview["batch_token"])
    assert result["created"] == 4
    assert db_session.query(Product).filter(Product.sku == "NEW-OIL-01").one().pack.units_per_pack == 16
    with pytest.raises(ValueError, match="expired or was already imported"):
        commit_csv_batch(db_session, preview["batch_token"])


def test_commit_sales_uses_the_given_timestamp(db_session, reseed):
    csv = "sku,qty,unit_price,timestamp\nGRN-001,1,1320,2026-01-05 10:30\n"
    preview = validate_and_preview_csv(db_session, csv, "sales")
    before = db_session.query(Product).filter(Product.sku == "GRN-001").one().stock_qty
    commit_csv_batch(db_session, preview["batch_token"])
    sale = db_session.query(Sale).order_by(Sale.sale_id.desc()).first()
    assert sale.timestamp.strftime("%Y-%m-%d %H:%M") == "2026-01-05 10:30"
    db_session.expire_all()
    assert db_session.query(Product).filter(Product.sku == "GRN-001").one().stock_qty == before - 1
