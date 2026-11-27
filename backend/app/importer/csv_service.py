"""CSV import with preview and row-level errors (DATA-02).

Two steps:
1. Preview: parse and check every row, report each problem with its row number, and
   stage the valid rows under a batch token. Nothing is written yet.
2. Commit: write the staged rows in one transaction.

Products CSV columns: sku, name, category, cost_price, selling_price
    optional: unit, pack_unit, units_per_pack, stock_qty, lead_time_days
Sales CSV columns: sku, qty, unit_price
    optional: timestamp (YYYY-MM-DD or YYYY-MM-DD HH:MM), payment_type (cash or udhaar)
"""

from __future__ import annotations

import csv
import io
import threading
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.core.clock import store_now
from app.models import PriceHistory, Product, ProductPack, Sale, SaleLine, StockMovement

BATCH_TTL = timedelta(minutes=30)
MAX_ROWS = 5000
PREVIEW_ROWS = 8

_STAGED: dict[str, dict[str, Any]] = {}
_LOCK = threading.Lock()

TEMPLATES = {
    "products": (
        "sku,name,category,cost_price,selling_price,unit,pack_unit,units_per_pack,stock_qty,lead_time_days\n"
        "NEW-001,Shan Sunflower Cooking Oil 1L,Cooking Oil & Ghee,520,570,pouch,carton,16,24,3\n"
        "NEW-002,Danedar Gold Leaf Tea 250g,Tea & Beverages,380,430,pouch,carton,24,12,3\n"
    ),
    "sales": (
        "sku,qty,unit_price,timestamp,payment_type\n"
        "OIL-001,2,550,2026-11-20 18:30,cash\n"
        "GRN-001,1,1320,2026-11-20 19:05,udhaar\n"
    ),
}
REQUIRED = {
    "products": ["sku", "name", "category", "cost_price", "selling_price"],
    "sales": ["sku", "qty", "unit_price"],
}


def _purge_expired() -> None:
    now = datetime.now(timezone.utc)
    with _LOCK:
        for token in [t for t, b in _STAGED.items() if now - b["created_at"] > BATCH_TTL]:
            _STAGED.pop(token, None)


def _number(raw: str, field: str, row_no: int, errors: list[dict[str, Any]], *, positive: bool = True,
            integer: bool = False) -> float | None:
    try:
        value = int(raw) if integer else float(raw)
    except (TypeError, ValueError):
        errors.append({"row_number": row_no, "field": field, "value": raw, "error": f"'{raw}' is not a number."})
        return None
    if positive and value <= 0:
        errors.append({"row_number": row_no, "field": field, "value": raw, "error": f"{field} must be more than zero."})
        return None
    return value


def _parse_timestamp(raw: str) -> datetime | None:
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d", "%d/%m/%Y %H:%M", "%d/%m/%Y"):
        try:
            return datetime.strptime(raw.strip(), fmt)
        except ValueError:
            continue
    return None


def validate_and_preview_csv(db: Session, file_content: str, import_type: str = "products", store_id: int = 1) -> dict[str, Any]:
    if import_type not in REQUIRED:
        raise ValueError("Import type must be 'products' or 'sales'.")
    _purge_expired()

    reader = csv.DictReader(io.StringIO(file_content.strip()))
    if not reader.fieldnames:
        raise ValueError("The file is empty or has no header row.")
    headers = [h.strip().lower() for h in reader.fieldnames if h]
    missing = [h for h in REQUIRED[import_type] if h not in headers]
    if missing:
        raise ValueError(f"Missing required column(s): {', '.join(missing)}. Download the template to see the format.")

    known_skus = {sku for (sku,) in db.query(Product.sku).filter(Product.store_id == store_id)}
    now = store_now()
    errors: list[dict[str, Any]] = []
    valid: list[dict[str, Any]] = []
    preview: list[dict[str, Any]] = []
    seen_skus: set[str] = set()
    total = 0

    for row_no, raw_row in enumerate(reader, start=2):  # row 1 is the header
        total += 1
        if total > MAX_ROWS:
            raise ValueError(f"The file has more than {MAX_ROWS} rows. Please split it.")
        row = {(k or "").strip().lower(): (v or "").strip() for k, v in raw_row.items()}
        row_errors: list[dict[str, Any]] = []
        sku = row.get("sku", "").upper()
        if not sku:
            row_errors.append({"row_number": row_no, "field": "sku", "value": "", "error": "SKU is empty."})

        if import_type == "products":
            name = row.get("name", "")
            if not name:
                row_errors.append({"row_number": row_no, "field": "name", "value": "", "error": "Product name is empty."})
            if sku and sku in seen_skus:
                row_errors.append({"row_number": row_no, "field": "sku", "value": sku, "error": "This SKU appears twice in the file."})
            cost = _number(row.get("cost_price", ""), "cost_price", row_no, row_errors)
            price = _number(row.get("selling_price", ""), "selling_price", row_no, row_errors)
            if cost and price and price < cost:
                row_errors.append({"row_number": row_no, "field": "selling_price", "value": row.get("selling_price"),
                                   "error": f"Selling price ({price:g}) is below cost price ({cost:g})."})
            per_pack = _number(row.get("units_per_pack") or "1", "units_per_pack", row_no, row_errors, integer=True)
            stock = _number(row.get("stock_qty") or "0", "stock_qty", row_no, row_errors, positive=False)
            if stock is not None and stock < 0:
                row_errors.append({"row_number": row_no, "field": "stock_qty", "value": row.get("stock_qty"), "error": "Stock cannot be negative."})
            lead = _number(row.get("lead_time_days") or "3", "lead_time_days", row_no, row_errors, integer=True)
            cleaned = {
                "sku": sku, "name": name, "category": row.get("category") or "General",
                "unit": row.get("unit") or "piece", "cost_price": cost, "selling_price": price,
                "pack_unit": row.get("pack_unit") or "carton", "units_per_pack": per_pack,
                "stock_qty": stock or 0.0, "lead_time_days": lead,
                "action": "update" if sku in known_skus else "new",
            }
        else:
            if sku and sku not in known_skus:
                row_errors.append({"row_number": row_no, "field": "sku", "value": sku,
                                   "error": "No product with this SKU. Import it in a products file first."})
            qty = _number(row.get("qty", ""), "qty", row_no, row_errors)
            price = _number(row.get("unit_price", ""), "unit_price", row_no, row_errors)
            ts_raw = row.get("timestamp", "")
            ts = _parse_timestamp(ts_raw) if ts_raw else now
            if ts is None:
                row_errors.append({"row_number": row_no, "field": "timestamp", "value": ts_raw,
                                   "error": "Date not understood. Use YYYY-MM-DD HH:MM."})
            elif ts > now + timedelta(minutes=5):
                row_errors.append({"row_number": row_no, "field": "timestamp", "value": ts_raw, "error": "Date is in the future."})
            payment = (row.get("payment_type") or "cash").lower()
            if payment not in ("cash", "udhaar"):
                row_errors.append({"row_number": row_no, "field": "payment_type", "value": payment,
                                   "error": "Payment type must be cash or udhaar."})
            cleaned = {"sku": sku, "qty": qty, "unit_price": price, "timestamp": ts, "payment_type": payment}

        if sku:
            seen_skus.add(sku)
        errors.extend(row_errors)
        if not row_errors:
            valid.append(cleaned)
        if len(preview) < PREVIEW_ROWS:
            preview.append({**cleaned, "row_number": row_no, "is_valid": not row_errors,
                            "errors": [e["error"] for e in row_errors]})

    token = str(uuid.uuid4())
    with _LOCK:
        _STAGED[token] = {"import_type": import_type, "rows": valid, "store_id": store_id, "created_at": datetime.now(timezone.utc)}

    return {
        "import_type": import_type,
        "total_rows": total,
        "valid_rows_count": len(valid),
        "invalid_rows_count": total - len(valid),
        "sample_preview": preview,
        "row_errors": errors[:200],
        "batch_token": token,
        "expires_in_minutes": int(BATCH_TTL.total_seconds() // 60),
    }


def commit_csv_batch(db: Session, batch_token: str, store_id: int = 1) -> dict[str, Any]:
    _purge_expired()
    with _LOCK:
        staged = _STAGED.pop(batch_token, None)
    if not staged:
        raise ValueError("This preview has expired or was already imported. Please upload the file again.")
    if staged["store_id"] != store_id:
        raise ValueError("This preview belongs to a different store.")

    now = store_now()
    rows = staged["rows"]
    created = updated = 0
    try:
        if staged["import_type"] == "products":
            existing = {p.sku: p for p in db.query(Product).filter(Product.store_id == store_id)}
            for r in rows:
                prod = existing.get(r["sku"])
                if prod:
                    prod.name, prod.category, prod.unit = r["name"], r["category"], r["unit"]
                    prod.cost_price, prod.selling_price = r["cost_price"], r["selling_price"]
                    prod.lead_time_days = r["lead_time_days"]
                    if prod.pack:
                        prod.pack.pack_unit, prod.pack.units_per_pack = r["pack_unit"], r["units_per_pack"]
                    updated += 1
                else:
                    prod = Product(
                        store_id=store_id, sku=r["sku"], name=r["name"], category=r["category"], unit=r["unit"],
                        cost_price=r["cost_price"], selling_price=r["selling_price"], stock_qty=r["stock_qty"],
                        lead_time_days=r["lead_time_days"], safety_stock_days=2, active=True, created_at=now,
                    )
                    db.add(prod)
                    db.flush()
                    db.add(ProductPack(product_id=prod.product_id, pack_unit=r["pack_unit"],
                                       units_per_pack=r["units_per_pack"], sell_unit=r["unit"]))
                    if r["stock_qty"]:
                        db.add(StockMovement(store_id=store_id, product_id=prod.product_id, timestamp=now,
                                             movement_type="opening_stock", qty_delta=r["stock_qty"],
                                             reference_id="CSV-IMPORT", reason="Opening stock from CSV"))
                    created += 1
                db.add(PriceHistory(product_id=prod.product_id, effective_date=now, cost_price=r["cost_price"],
                                    selling_price=r["selling_price"], reason="CSV import"))
        else:
            products = {p.sku: p for p in db.query(Product).filter(Product.store_id == store_id)}
            for r in rows:
                prod = products[r["sku"]]
                qty = min(r["qty"], max(0.0, prod.stock_qty))
                sale = Sale(store_id=store_id, timestamp=r["timestamp"], payment_type=r["payment_type"],
                            status="completed", total=round(r["qty"] * r["unit_price"], 2), discount=0.0)
                db.add(sale)
                db.flush()
                db.add(SaleLine(sale_id=sale.sale_id, product_id=prod.product_id, qty=r["qty"],
                                unit_price=r["unit_price"], unit_cost_snapshot=prod.cost_price, discount=0.0))
                prod.stock_qty = round(prod.stock_qty - qty, 2)
                db.add(StockMovement(store_id=store_id, product_id=prod.product_id, timestamp=r["timestamp"],
                                     movement_type="sale", qty_delta=-qty, reference_id=f"CSV-SALE-{sale.sale_id}",
                                     reason="Sale imported from CSV"))
                created += 1
        db.commit()
    except Exception:
        db.rollback()
        raise

    kind = staged["import_type"]
    return {
        "success": True,
        "rows_imported": created + updated,
        "created": created,
        "updated": updated,
        "message": f"Imported {created + updated} {kind} rows ({created} new, {updated} updated)." if kind == "products"
        else f"Imported {created} sales.",
    }
