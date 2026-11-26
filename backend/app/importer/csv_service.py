"""CSV Data Ingestion & Validation Pipeline.
Requirement DATA-02:
- Two-phase import: Preview with row-level validation errors before commit
- Supports 'products' and 'sales' CSV files
- Atomic transactional database commit
"""

import io
import csv
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models import Product, ProductPack, PriceHistory, Sale, SaleLine, StockMovement

# In-memory batch staging cache (maps batch_token -> batch data)
STAGED_BATCHES: Dict[str, Dict[str, Any]] = {}

def validate_and_preview_csv(file_content: str, import_type: str = "products") -> Dict[str, Any]:
    """Parse CSV, validate schema and row data, and generate preview with errors."""
    f = io.StringIO(file_content.strip())
    reader = csv.DictReader(f)

    if not reader.fieldnames:
        raise ValueError("Empty or invalid CSV file with no header row.")

    headers = [h.strip().lower() for h in reader.fieldnames]
    row_errors = []
    valid_rows = []
    sample_preview = []

    row_idx = 1  # 1-based indexing for user visibility

    if import_type == "products":
        required_headers = {"sku", "name", "category", "cost_price", "selling_price"}
        missing_headers = required_headers - set(headers)
        if missing_headers:
            raise ValueError(f"Missing required columns in products CSV: {', '.join(missing_headers)}")

        for raw_row in reader:
            row_idx += 1
            row = {k.strip().lower(): v.strip() for k, v in raw_row.items() if k}
            is_valid = True

            sku = row.get("sku", "")
            name = row.get("name", "")
            category = row.get("category", "")
            cost_str = row.get("cost_price", "")
            price_str = row.get("selling_price", "")

            if not sku:
                row_errors.append({"row_number": row_idx, "field": "sku", "value": "", "error": "SKU cannot be empty."})
                is_valid = False

            if not name:
                row_errors.append({"row_number": row_idx, "field": "name", "value": "", "error": "Product name cannot be empty."})
                is_valid = False

            try:
                cost = float(cost_str)
                if cost <= 0:
                    row_errors.append({"row_number": row_idx, "field": "cost_price", "value": cost_str, "error": "Cost price must be positive."})
                    is_valid = False
            except ValueError:
                row_errors.append({"row_number": row_idx, "field": "cost_price", "value": cost_str, "error": "Invalid numeric cost price."})
                is_valid = False
                cost = 0.0

            try:
                price = float(price_str)
                if price <= 0:
                    row_errors.append({"row_number": row_idx, "field": "selling_price", "value": price_str, "error": "Selling price must be positive."})
                    is_valid = False
                elif cost > 0 and price < cost:
                    row_errors.append({"row_number": row_idx, "field": "selling_price", "value": price_str, "error": f"Selling price ({price}) is lower than cost price ({cost})."})
                    is_valid = False
            except ValueError:
                row_errors.append({"row_number": row_idx, "field": "selling_price", "value": price_str, "error": "Invalid numeric selling price."})
                is_valid = False
                price = 0.0

            pack_unit = row.get("pack_unit", "carton")
            try:
                units_per_pack = int(row.get("units_per_pack", 12))
            except ValueError:
                units_per_pack = 12

            cleaned_row = {
                "sku": sku,
                "name": name,
                "category": category or "General Grocery",
                "unit": row.get("unit", "piece"),
                "cost_price": cost,
                "selling_price": price,
                "pack_unit": pack_unit,
                "units_per_pack": units_per_pack
            }

            if is_valid:
                valid_rows.append(cleaned_row)

            if len(sample_preview) < 5:
                sample_preview.append(cleaned_row)

    elif import_type == "sales":
        required_headers = {"sku", "qty", "unit_price"}
        missing_headers = required_headers - set(headers)
        if missing_headers:
            raise ValueError(f"Missing required columns in sales CSV: {', '.join(missing_headers)}")

        for raw_row in reader:
            row_idx += 1
            row = {k.strip().lower(): v.strip() for k, v in raw_row.items() if k}
            is_valid = True

            sku = row.get("sku", "")
            qty_str = row.get("qty", "")
            price_str = row.get("unit_price", "")

            if not sku:
                row_errors.append({"row_number": row_idx, "field": "sku", "value": "", "error": "SKU cannot be empty."})
                is_valid = False

            try:
                qty = float(qty_str)
                if qty <= 0:
                    row_errors.append({"row_number": row_idx, "field": "qty", "value": qty_str, "error": "Quantity must be greater than zero."})
                    is_valid = False
            except ValueError:
                row_errors.append({"row_number": row_idx, "field": "qty", "value": qty_str, "error": "Invalid numeric quantity."})
                is_valid = False
                qty = 0.0

            try:
                unit_price = float(price_str)
                if unit_price <= 0:
                    row_errors.append({"row_number": row_idx, "field": "unit_price", "value": price_str, "error": "Unit price must be positive."})
                    is_valid = False
            except ValueError:
                row_errors.append({"row_number": row_idx, "field": "unit_price", "value": price_str, "error": "Invalid numeric unit price."})
                is_valid = False
                unit_price = 0.0

            timestamp_str = row.get("timestamp") or datetime.now(timezone.utc).isoformat()
            payment_type = row.get("payment_type", "cash").lower()
            if payment_type not in ("cash", "udhaar"):
                payment_type = "cash"

            cleaned_row = {
                "sku": sku,
                "qty": qty,
                "unit_price": unit_price,
                "timestamp": timestamp_str,
                "payment_type": payment_type
            }

            if is_valid:
                valid_rows.append(cleaned_row)

            if len(sample_preview) < 5:
                sample_preview.append(cleaned_row)

    else:
        raise ValueError(f"Unsupported import type '{import_type}'. Must be 'products' or 'sales'.")

    # Generate a unique batch token and stage in memory
    batch_token = str(uuid.uuid4())
    STAGED_BATCHES[batch_token] = {
        "import_type": import_type,
        "valid_rows": valid_rows,
        "created_at": datetime.now(timezone.utc)
    }

    return {
        "import_type": import_type,
        "total_rows": row_idx - 1,
        "valid_rows_count": len(valid_rows),
        "invalid_rows_count": len(row_errors),
        "sample_preview": sample_preview,
        "row_errors": row_errors,
        "batch_token": batch_token
    }

def commit_csv_batch(db: Session, batch_token: str, store_id: int = 1) -> Dict[str, Any]:
    """Atomically commit staged CSV rows into the database."""
    if batch_token not in STAGED_BATCHES:
        raise ValueError("Invalid or expired batch token. Please re-upload the CSV.")

    staged = STAGED_BATCHES.pop(batch_token)
    import_type = staged["import_type"]
    valid_rows = staged["valid_rows"]

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    committed_count = 0

    if import_type == "products":
        for r in valid_rows:
            # Check if product with this SKU already exists
            existing = db.query(Product).filter(Product.store_id == store_id, Product.sku == r["sku"]).first()
            if existing:
                existing.name = r["name"]
                existing.category = r["category"]
                existing.unit = r["unit"]
                existing.cost_price = r["cost_price"]
                existing.selling_price = r["selling_price"]
                prod = existing
            else:
                prod = Product(
                    store_id=store_id,
                    sku=r["sku"],
                    name=r["name"],
                    category=r["category"],
                    unit=r["unit"],
                    cost_price=r["cost_price"],
                    selling_price=r["selling_price"],
                    stock_qty=0.0,
                    active=True,
                    created_at=now
                )
                db.add(prod)
                db.flush()

                # Add pack
                pack = ProductPack(
                    product_id=prod.product_id,
                    pack_unit=r["pack_unit"],
                    units_per_pack=r["units_per_pack"],
                    sell_unit=r["unit"]
                )
                db.add(pack)

            # Record price history
            ph = PriceHistory(
                product_id=prod.product_id,
                effective_date=now,
                cost_price=r["cost_price"],
                selling_price=r["selling_price"],
                reason="csv_import"
            )
            db.add(ph)
            committed_count += 1

    elif import_type == "sales":
        # Group by transaction or insert individual sales
        for r in valid_rows:
            prod = db.query(Product).filter(Product.store_id == store_id, Product.sku == r["sku"]).first()
            if not prod:
                continue

            sale_time = now
            sale = Sale(
                store_id=store_id,
                timestamp=sale_time,
                payment_type=r["payment_type"],
                status="completed",
                total=r["qty"] * r["unit_price"],
                discount=0.0
            )
            db.add(sale)
            db.flush()

            sline = SaleLine(
                sale_id=sale.sale_id,
                product_id=prod.product_id,
                qty=r["qty"],
                unit_price=r["unit_price"],
                unit_cost_snapshot=prod.cost_price,
                discount=0.0
            )
            db.add(sline)

            # Decrement stock and log movement
            prod.stock_qty = max(0.0, prod.stock_qty - r["qty"])
            sm = StockMovement(
                store_id=store_id,
                product_id=prod.product_id,
                timestamp=sale_time,
                movement_type="sale",
                qty_delta=-r["qty"],
                reference_id=f"CSV-{sale.sale_id}",
                reason="CSV imported sale"
            )
            db.add(sm)
            committed_count += 1

    db.commit()

    return {
        "success": True,
        "rows_imported": committed_count,
        "message": f"Successfully committed {committed_count} {import_type} rows to database."
    }
