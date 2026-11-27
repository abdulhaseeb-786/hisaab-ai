"""Unit tests for CSV Ingestion Pipeline.
Requirements DATA-02:
- Preview with row errors
- Transactional commit
"""

from pathlib import Path
from app.importer.csv_service import validate_and_preview_csv, commit_csv_batch

def test_csv_products_validation_and_preview():
    csv_path = Path(__file__).parent / "fixtures" / "sample_products.csv"
    with open(csv_path) as f:
        res = validate_and_preview_csv(f.read(), import_type="products")

    assert res["total_rows"] == 5
    assert res["valid_rows_count"] == 4
    assert res["invalid_rows_count"] == 1
    assert len(res["row_errors"]) == 1
    assert "Selling price" in res["row_errors"][0]["error"]

def test_csv_sales_validation_and_preview():
    csv_path = Path(__file__).parent / "fixtures" / "sample_sales.csv"
    with open(csv_path) as f:
        res = validate_and_preview_csv(f.read(), import_type="sales")

    assert res["total_rows"] == 5
    assert res["valid_rows_count"] == 4
    assert res["invalid_rows_count"] == 1
    assert "Quantity must be greater than zero" in res["row_errors"][0]["error"]
