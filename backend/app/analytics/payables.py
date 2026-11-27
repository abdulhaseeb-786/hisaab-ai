"""Supplier payables: what the shop owes distributors, and when it is due.

Payments clear the oldest invoices first (FIFO). An invoice is overdue when its due
date has passed and it is not fully paid. The dashboard, the cash outlook and the
copilot all use this one function, so they always show the same numbers.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.clock import store_now
from app.models import Purchase, Supplier, SupplierLedgerEntry


def open_supplier_invoices(db: Session, store_id: int = 1, now: datetime | None = None) -> dict[int, list[dict[str, Any]]]:
    """Unpaid (or part-paid) invoices per supplier, oldest first."""
    now = now or store_now()
    invoices: dict[int, list[dict[str, Any]]] = defaultdict(list)
    paid: dict[int, float] = defaultdict(float)
    for e in (
        db.query(SupplierLedgerEntry)
        .filter(SupplierLedgerEntry.store_id == store_id, SupplierLedgerEntry.timestamp <= now)
        .order_by(SupplierLedgerEntry.timestamp, SupplierLedgerEntry.entry_id)
    ):
        if e.credit > 0:
            invoices[e.supplier_id].append({
                "reference": e.reference,
                "invoice_date": e.timestamp,
                "due_date": e.due_date or e.timestamp,
                "amount_pkr": e.credit,
            })
        if e.debit > 0:
            paid[e.supplier_id] += e.debit

    result: dict[int, list[dict[str, Any]]] = {}
    for supplier_id, items in invoices.items():
        remaining_payment = paid.get(supplier_id, 0.0)
        open_items = []
        for inv in items:
            if remaining_payment >= inv["amount_pkr"] - 0.01:
                remaining_payment -= inv["amount_pkr"]
                continue
            open_amount = inv["amount_pkr"] - remaining_payment
            remaining_payment = 0.0
            open_items.append({
                **inv,
                "open_amount_pkr": round(open_amount, 2),
                "is_overdue": inv["due_date"] < now,
                "days_overdue": max(0, (now - inv["due_date"]).days),
            })
        result[supplier_id] = open_items
    return result


def calculate_payables(db: Session, store_id: int = 1, horizon_days: int = 7, now: datetime | None = None) -> dict[str, Any]:
    now = now or store_now()
    horizon_end = now + timedelta(days=horizon_days)
    open_invoices = open_supplier_invoices(db, store_id, now)

    pending_orders: dict[int, dict[str, Any]] = defaultdict(lambda: {"count": 0, "value": 0.0, "next": None})
    for p in db.query(Purchase).filter(Purchase.store_id == store_id, Purchase.status == "pending"):
        entry = pending_orders[p.supplier_id]
        entry["count"] += 1
        entry["value"] += p.total
        if p.expected_date and (entry["next"] is None or p.expected_date < entry["next"]):
            entry["next"] = p.expected_date

    suppliers_out = []
    for s in db.query(Supplier).filter(Supplier.store_id == store_id).order_by(Supplier.supplier_id):
        items = open_invoices.get(s.supplier_id, [])
        total = sum(i["open_amount_pkr"] for i in items)
        overdue = sum(i["open_amount_pkr"] for i in items if i["is_overdue"])
        due_soon = sum(i["open_amount_pkr"] for i in items if i["due_date"] <= horizon_end)
        next_due = min((i["due_date"] for i in items if not i["is_overdue"]), default=None)
        po = pending_orders.get(s.supplier_id, {"count": 0, "value": 0.0, "next": None})
        suppliers_out.append({
            "supplier_id": s.supplier_id,
            "name": s.name,
            "contact": s.contact,
            "payment_terms_days": s.payment_terms_days,
            "total_payable_pkr": round(total, 2),
            "overdue_pkr": round(overdue, 2),
            "due_within_horizon_pkr": round(due_soon, 2),
            "next_due_date": next_due,
            "open_invoices": [
                {k: v for k, v in i.items() if k != "amount_pkr"} | {"invoice_amount_pkr": i["amount_pkr"]}
                for i in items
            ],
            "pending_orders_count": po["count"],
            "pending_orders_value_pkr": round(po["value"], 2),
            "next_delivery_date": po["next"],
        })

    suppliers_out.sort(key=lambda x: (-x["overdue_pkr"], -x["due_within_horizon_pkr"]))
    return {
        "store_id": store_id,
        "as_of": now,
        "horizon_days": horizon_days,
        "total_payables_pkr": round(sum(s["total_payable_pkr"] for s in suppliers_out), 2),
        "overdue_pkr": round(sum(s["overdue_pkr"] for s in suppliers_out), 2),
        "due_within_horizon_pkr": round(sum(s["due_within_horizon_pkr"] for s in suppliers_out), 2),
        "pending_orders_value_pkr": round(sum(s["pending_orders_value_pkr"] for s in suppliers_out), 2),
        "suppliers": suppliers_out,
    }
