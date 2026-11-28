"""The order booker workflow, the way a kiryana shop actually buys.

1. The distributor's order booker visits on fixed route days. HisaabAI shows who is due,
   what the shop owes them, and how much it can safely order: the lowest cash expected in
   the next two weeks, minus the safety cash, minus orders already on the way.
2. The suggestion for that distributor is built from the same budget optimizer, limited
   to their products. The shopkeeper edits packs, then saves the order (pending). The
   order text is shown on screen to read out or copy; nothing is sent.
3. "Maal aaya": when the delivery comes, the shopkeeper enters what actually arrived and
   the bill price. Stock goes up, a supplier bill is created, and any price change is
   flagged with the new margin, and the cost is updated for every later calculation.
4. Paying the distributor clears the oldest bills first (FIFO, in analytics.payables).
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.analytics.cash_book import CASH, cash_position
from app.analytics.cash_outlook import calculate_cash_outlook
from app.analytics.payables import calculate_payables
from app.core.clock import store_now
from app.models import (
    PriceHistory, Product, ProductPack, Purchase, PurchaseLine, StockMovement, Store, Supplier, SupplierLedgerEntry,
    SupplierProduct,
)
from app.reorder.budget_optimizer import generate_budget_reorder_plan
from app.core.wording import days

WEEKDAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
WEEKDAYS_UR = ["Peer", "Mangal", "Budh", "Jumeraat", "Juma", "Hafta", "Itwar"]
PAYMENT_METHODS = {"cash", "easypaisa", "jazzcash", "bank"}
PRICE_CHANGE_TOLERANCE = 0.005  # half a percent: rounding on a bill is not a price change
BUDGET_HORIZON_DAYS = 28  # long enough to reach any distributor's bill due date plus a week


class OrderError(ValueError):
    pass


def _visit_days(s: Supplier) -> list[int]:
    return [int(d) for d in (s.visit_days or "").split(",") if d.strip().isdigit()]


def _cash_timeline(db: Session, store_id: int, now: datetime) -> dict[str, Any]:
    """Projected closing cash per day, with orders on the way paid when their bills fall due."""
    outlook = calculate_cash_outlook(db, store_id, days_ahead=BUDGET_HORIZON_DAYS, now=now)
    closing = {d["date"]: d["closing_cash_pkr"] for d in outlook["days"]}
    terms = {s.supplier_id: s.payment_terms_days or 7 for s in db.query(Supplier).filter(Supplier.store_id == store_id)}
    pending_total = 0.0
    for po in db.query(Purchase).filter(Purchase.store_id == store_id, Purchase.status == "pending"):
        arrives = (po.expected_date or now).date()
        due = max(arrives, now.date()) + timedelta(days=terms.get(po.supplier_id, 7))
        pending_total += po.total
        for d in closing:
            if d >= due:
                closing[d] -= po.total
    return {"outlook": outlook, "closing": closing, "pending_total": round(pending_total, 2)}


def _lead_days(db: Session, supplier_id: int) -> int:
    leads = [sp.lead_time_days or 1 for sp in db.query(SupplierProduct).filter(SupplierProduct.supplier_id == supplier_id)]
    return max(1, round(sum(leads) / len(leads))) if leads else 2


USUAL_ORDER_MULTIPLE = 1.5


def _usual_orders(db: Session, store_id: int, now: datetime) -> dict[int, float]:
    """Average bill per order from each distributor over the last 90 days."""
    since = now - timedelta(days=90)
    totals: dict[int, list[float]] = {}
    for po in db.query(Purchase).filter(Purchase.store_id == store_id, Purchase.status == "received", Purchase.date >= since):
        totals.setdefault(po.supplier_id, []).append(po.total)
    return {k: round(sum(v) / len(v), 0) for k, v in totals.items()}


def _suggested(safe: float, usual: float) -> float:
    """The galla limit, but not far above what the shop normally buys from this distributor.

    The cash projection cannot know about the orders the shop will place with others
    before this bill is due, so a normal-size order is the sensible default.
    """
    if usual <= 0:
        return safe
    return float(min(safe, math.ceil(usual * USUAL_ORDER_MULTIPLE / 500) * 500))


def safe_budget(db: Session, store_id: int = 1, now: datetime | None = None, supplier_id: int | None = None,
                timeline: dict[str, Any] | None = None) -> dict[str, Any]:
    """How much a new order can cost without the galla dropping below the safety cash.

    A distributor is paid when the bill falls due: delivery (lead time) plus their credit
    days. The order has to fit in the cash expected from that day for a week after,
    once the bills already due and the orders already on the way are paid.
    """
    now = now or store_now()
    tl = timeline or _cash_timeline(db, store_id, now)
    outlook, closing = tl["outlook"], tl["closing"]
    supplier = db.get(Supplier, supplier_id) if supplier_id else None
    terms = (supplier.payment_terms_days or 7) if supplier else 7
    lead = _lead_days(db, supplier_id) if supplier_id else 2
    due = now.date() + timedelta(days=lead + terms)
    window = [d for d in closing if due <= d <= due + timedelta(days=7)] or [max(closing)]
    low_day = min(window, key=lambda d: closing[d])
    low = round(closing[low_day], 0)
    safety = outlook["safety_cash_pkr"]
    safe = float(max(0, math.floor((low - safety) / 500) * 500))
    cash_now = outlook["cash_position"]["cash_in_hand_pkr"]
    pending = tl["pending_total"]
    return {
        "safe_to_order_pkr": safe,
        "cash_in_hand_pkr": cash_now,
        "bill_due_date": due,
        "lowest_cash_pkr": low,
        "lowest_cash_date": low_day,
        "safety_cash_pkr": safety,
        "orders_on_the_way_pkr": pending,
        "explanation": [
            f"Cash in the cash box now: Rs {cash_now:,.0f}.",
            f"A new order is paid when its bill is due, about {due:%d %b} ({days(lead)} delivery + {days(terms)} credit).",
            f"By then, after expected sales, kharcha, bills already due and Rs {pending:,.0f} of orders on the way, "
            f"cash is expected to be at least Rs {low:,.0f}.",
            f"Keeping Rs {safety:,.0f} aside for safety, you can order up to Rs {safe:,.0f}. Each order you save lowers this.",
        ],
        "explanation_ur": [
            f"Cash box mein abhi: Rs {cash_now:,.0f}.",
            f"Naye order ka bill takreeban {due:%d %b} ko dena hoga ({lead} din delivery + {terms} din udhaar).",
            f"Tab tak andaazan sales, kharcha, pehle wale bill aur Rs {pending:,.0f} ke raste wale orders ke baad "
            f"kam az kam Rs {low:,.0f} hon ge.",
            f"Rs {safety:,.0f} hifazat ke liye rakh kar, Rs {safe:,.0f} tak ka order mehfooz hai. Har order is ko kam karta hai.",
        ],
    }


def list_suppliers(db: Session, store_id: int = 1, now: datetime | None = None) -> dict[str, Any]:
    now = now or store_now()
    today = now.weekday()
    payables = {s["supplier_id"]: s for s in calculate_payables(db, store_id, horizon_days=7, now=now)["suppliers"]}
    counts: dict[int, int] = {}
    for p in db.query(Product).filter(Product.store_id == store_id, Product.active.is_(True)):
        if p.supplier_id:
            counts[p.supplier_id] = counts.get(p.supplier_id, 0) + 1
    timeline = _cash_timeline(db, store_id, now)
    usual = _usual_orders(db, store_id, now)
    out = []
    for s in db.query(Supplier).filter(Supplier.store_id == store_id).order_by(Supplier.name):
        route = _visit_days(s)
        ahead = min(((d - today) % 7 for d in route), default=None)
        pay = payables.get(s.supplier_id, {})
        out.append({
            "supplier_id": s.supplier_id,
            "name": s.name,
            "contact": s.contact,
            "payment_terms_days": s.payment_terms_days,
            "visit_days": route,
            "visit_days_label": ", ".join(WEEKDAYS_EN[d] for d in route),
            "visit_days_label_ur": ", ".join(WEEKDAYS_UR[d] for d in route),
            "visits_today": today in route,
            "next_visit_in_days": ahead,
            "products": counts.get(s.supplier_id, 0),
            "total_payable_pkr": pay.get("total_payable_pkr", 0.0),
            "overdue_pkr": pay.get("overdue_pkr", 0.0),
            "due_within_7_days_pkr": pay.get("due_within_horizon_pkr", 0.0),
            "pending_orders_count": pay.get("pending_orders_count", 0),
            "pending_orders_value_pkr": pay.get("pending_orders_value_pkr", 0.0),
            "budget": (b := safe_budget(db, store_id, now, s.supplier_id, timeline)),
            "usual_order_pkr": usual.get(s.supplier_id, 0.0),
            "suggested_budget_pkr": _suggested(b["safe_to_order_pkr"], usual.get(s.supplier_id, 0.0)),
        })
    out.sort(key=lambda x: (not x["visits_today"], x["next_visit_in_days"] if x["next_visit_in_days"] is not None else 9, x["name"]))
    return {"as_of": now, "budget": safe_budget(db, store_id, now, timeline=timeline), "suppliers": out}


def suggest_order(db: Session, supplier_id: int, budget_pkr: float, store_id: int = 1, now: datetime | None = None) -> dict[str, Any]:
    supplier = db.get(Supplier, supplier_id)
    if not supplier or supplier.store_id != store_id:
        raise LookupError("Distributor not found.")
    plan = generate_budget_reorder_plan(db, budget_pkr=budget_pkr, store_id=store_id, now=now, supplier_id=supplier_id)
    return {**plan, "supplier_id": supplier_id, "supplier_name": supplier.name}


def _pack(db: Session, product_id: int) -> tuple[str, int]:
    pack = db.query(ProductPack).filter(ProductPack.product_id == product_id).first()
    return (pack.pack_unit, max(1, pack.units_per_pack)) if pack else ("piece", 1)


def _order_dict(db: Session, p: Purchase) -> dict[str, Any]:
    lines = []
    for l in p.lines:
        unit, per = _pack(db, l.product_id)
        lines.append({
            "product_id": l.product_id,
            "name": l.product.name,
            "unit": l.product.unit,
            "pack_unit": unit,
            "units_per_pack": per,
            "packs": round(l.qty / per, 2),
            "qty": l.qty,
            "received_qty": l.received_qty,
            "unit_cost": l.unit_cost,
            "line_total": round(l.qty * l.unit_cost, 2),
        })
    return {
        "purchase_id": p.purchase_id,
        "supplier_id": p.supplier_id,
        "supplier_name": p.supplier.name,
        "status": p.status,
        "ordered_at": p.date,
        "expected_date": p.expected_date,
        "received_date": p.received_date,
        "bill_number": p.bill_number,
        "total_pkr": round(p.total, 2),
        "lines": lines,
    }


def _order_draft(store: Store | None, supplier: Supplier, lines: list[dict[str, Any]], total: float, when: datetime) -> dict[str, str]:
    shop = store.name if store else ""
    rows = [f"{i}. {l['name']}: {l['packs']:g} {l['pack_unit']}" for i, l in enumerate(lines, 1)]
    return {
        "roman_urdu": "\n".join([f"*{shop}*: order {supplier.name} ke liye", f"{when:%d %b %Y}", "", *rows, "",
                                 f"Andaazan kul: Rs {total:,.0f}", "Bill par rate likh dein. Shukriya!"]),
        "english": "\n".join([f"*{shop}*: order for {supplier.name}", f"{when:%d %b %Y}", "", *rows, "",
                              f"Estimated total: Rs {total:,.0f}", "Please write the rates on the bill. Thank you!"]),
    }


def create_order(db: Session, supplier_id: int, lines: list[dict[str, Any]], store_id: int = 1,
                 now: datetime | None = None) -> dict[str, Any]:
    """Save the order given to the booker. Stock arrives later through receive_order."""
    now = now or store_now()
    order, supplier = _add_order(db, supplier_id, lines, store_id, now)
    db.commit()
    db.refresh(order)
    out = _order_dict(db, order)
    out["draft"] = _order_draft(db.get(Store, store_id), supplier, out["lines"], out["total_pkr"], now)
    return out


def create_orders_from_plan(db: Session, lines: list[dict[str, Any]], budget_pkr: float, store_id: int = 1,
                            now: datetime | None = None) -> dict[str, Any]:
    """Save a whole-shop budget plan as one pending order per distributor, in one go.

    Either every order is saved or none is. The orders together never cost more than the
    budget, the same rule the plan itself follows. Each order then arrives through Maal aaya.
    """
    now = now or store_now()
    lines = [l for l in lines if l["packs"] > 0]
    if not lines:
        raise OrderError("Add at least one item to the order.")
    groups: dict[int, list[dict[str, Any]]] = {}
    for l in lines:
        if not l.get("supplier_id"):
            raise OrderError("Every item needs a distributor before it can be ordered.")
        groups.setdefault(int(l["supplier_id"]), []).append(l)
    try:
        made = [_add_order(db, sid, group, store_id, now) for sid, group in groups.items()]
        total = round(sum(o.total for o, _ in made), 2)
        if total > budget_pkr + 0.5:
            raise OrderError(f"These orders come to Rs {total:,.0f}, more than the budget of Rs {budget_pkr:,.0f}.")
        db.commit()
    except Exception:
        db.rollback()
        raise
    store = db.get(Store, store_id)
    out = []
    for order, supplier in made:
        db.refresh(order)
        o = _order_dict(db, order)
        o["draft"] = _order_draft(store, supplier, o["lines"], o["total_pkr"], now)
        out.append(o)
    return {"orders": out, "total_pkr": total, "budget_pkr": budget_pkr}


def _add_order(db: Session, supplier_id: int, lines: list[dict[str, Any]], store_id: int,
               now: datetime) -> tuple[Purchase, Supplier]:
    """Build one pending order (flushed, not committed)."""
    supplier = db.get(Supplier, supplier_id)
    if not supplier or supplier.store_id != store_id:
        raise LookupError("Distributor not found.")
    lines = [l for l in lines if l["packs"] > 0]
    if not lines:
        raise OrderError("Add at least one item to the order.")
    products = {p.product_id: p for p in db.query(Product).filter(Product.product_id.in_([l["product_id"] for l in lines]))}
    lead = 0
    order = Purchase(store_id=store_id, supplier_id=supplier_id, date=now, status="pending", total=0.0)
    db.add(order)
    db.flush()
    total = 0.0
    for l in lines:
        p = products.get(l["product_id"])
        if not p or p.store_id != store_id:
            raise OrderError("One of the items is not in this shop.")
        _, per = _pack(db, p.product_id)
        sp = db.query(SupplierProduct).filter(SupplierProduct.supplier_id == supplier_id,
                                              SupplierProduct.product_id == p.product_id).first()
        lead = max(lead, sp.lead_time_days if sp else p.lead_time_days or 1)
        qty = float(l["packs"] * per)
        db.add(PurchaseLine(purchase_id=order.purchase_id, product_id=p.product_id, qty=qty, received_qty=0.0,
                            unit_cost=p.cost_price))
        total += qty * p.cost_price
    order.total = round(total, 2)
    order.expected_date = now + timedelta(days=max(1, lead))
    db.flush()
    return order, supplier


def list_orders(db: Session, status: str | None = "pending", supplier_id: int | None = None, store_id: int = 1,
                limit: int = 30) -> list[dict[str, Any]]:
    q = db.query(Purchase).filter(Purchase.store_id == store_id)
    if status:
        q = q.filter(Purchase.status == status)
    if supplier_id:
        q = q.filter(Purchase.supplier_id == supplier_id)
    return [_order_dict(db, p) for p in q.order_by(Purchase.date.desc()).limit(limit)]


def receive_order(db: Session, purchase_id: int, lines: list[dict[str, Any]], bill_number: str | None,
                  pay_now_pkr: float = 0.0, method: str = CASH, store_id: int = 1, now: datetime | None = None) -> dict[str, Any]:
    """Maal aaya: book what really arrived, at the bill price, and create the distributor's bill."""
    now = now or store_now()
    order = db.get(Purchase, purchase_id)
    if not order or order.store_id != store_id:
        raise LookupError("Order not found.")
    if order.status != "pending":
        raise OrderError("This order was already received.")
    if method not in PAYMENT_METHODS:
        raise OrderError("Payment method must be cash, easypaisa, jazzcash or bank.")
    given = {l["product_id"]: l for l in lines}
    supplier = order.supplier

    price_changes, short = [], []
    bill_total = 0.0
    received_any = False
    for pl in order.lines:
        p = pl.product
        g = given.get(pl.product_id, {})
        qty = float(g.get("received_qty", pl.qty))
        cost = float(g.get("unit_cost", pl.unit_cost))
        if qty < 0 or cost < 0:
            raise OrderError("Quantities and prices cannot be negative.")
        pl.received_qty = qty
        if qty < pl.qty - 1e-9:
            short.append({"product_id": p.product_id, "name": p.name, "ordered_qty": pl.qty, "received_qty": qty, "unit": p.unit})
        if qty <= 0:
            continue
        received_any = True
        bill_total += qty * cost
        old = p.cost_price
        if old > 0 and abs(cost - old) / old > PRICE_CHANGE_TOLERANCE:
            old_margin = (p.selling_price - old) / p.selling_price * 100 if p.selling_price else 0.0
            new_margin = (p.selling_price - cost) / p.selling_price * 100 if p.selling_price else 0.0
            keep_price = math.ceil(cost / (1 - old_margin / 100)) if old_margin < 100 else p.selling_price
            price_changes.append({
                "product_id": p.product_id, "name": p.name, "unit": p.unit,
                "old_cost": round(old, 2), "new_cost": round(cost, 2),
                "change_pct": round((cost - old) / old * 100, 1),
                "selling_price": p.selling_price,
                "old_margin_pct": round(old_margin, 1), "new_margin_pct": round(new_margin, 1),
                "price_to_keep_margin": float(keep_price),
            })
            p.cost_price = round(cost, 2)
            db.add(PriceHistory(product_id=p.product_id, effective_date=now, cost_price=p.cost_price,
                                selling_price=p.selling_price, reason=f"Bill {bill_number or order.purchase_id} from {supplier.name}"[:120]))
            sp = db.query(SupplierProduct).filter(SupplierProduct.supplier_id == supplier.supplier_id,
                                                  SupplierProduct.product_id == p.product_id).first()
            if sp:
                sp.unit_cost, sp.updated_at = p.cost_price, now
        pl.unit_cost = round(cost, 2)
        p.stock_qty = round((p.stock_qty or 0.0) + qty, 3)
        db.add(StockMovement(store_id=store_id, product_id=p.product_id, timestamp=now, movement_type="purchase",
                             qty_delta=qty, reference_id=f"PO-{order.purchase_id}", reason=f"Maal aaya from {supplier.name}"))
    if not received_any:
        raise OrderError("Nothing was received. Enter the quantities that arrived, or cancel the order.")

    bill_total = round(bill_total, 2)
    if pay_now_pkr > bill_total + 0.01:
        raise OrderError(f"The bill is only Rs {bill_total:,.0f}.")
    if pay_now_pkr > 0 and method == CASH:
        cash = cash_position(db, store_id, now)["cash_in_hand_pkr"]
        if pay_now_pkr > cash + 0.01:
            raise OrderError(f"Only Rs {cash:,.0f} is in the cash box.")

    order.status = "received"
    order.received_date = now
    order.bill_number = (bill_number or "").strip() or None
    order.total = bill_total
    ref = order.bill_number or f"INV-{order.purchase_id}"
    due = now + timedelta(days=supplier.payment_terms_days or 7)
    db.add(SupplierLedgerEntry(store_id=store_id, supplier_id=supplier.supplier_id, timestamp=now, debit=0.0,
                               credit=bill_total, due_date=due, reference=ref,
                               description=f"Bill for order PO-{order.purchase_id}"))
    if pay_now_pkr > 0:
        db.add(SupplierLedgerEntry(store_id=store_id, supplier_id=supplier.supplier_id, timestamp=now,
                                   debit=round(pay_now_pkr, 2), credit=0.0, reference=f"PAY-{ref}", method=method,
                                   description=f"Paid on delivery ({method})"))
    db.commit()
    db.refresh(order)
    return {
        "order": _order_dict(db, order),
        "bill_total_pkr": bill_total,
        "paid_now_pkr": round(pay_now_pkr, 2),
        "left_to_pay_pkr": round(bill_total - pay_now_pkr, 2),
        "due_date": due,
        "price_changes": price_changes,
        "short_items": short,
    }


def pay_supplier(db: Session, supplier_id: int, amount: float, method: str = CASH, note: str | None = None,
                 store_id: int = 1, now: datetime | None = None) -> dict[str, Any]:
    now = now or store_now()
    supplier = db.get(Supplier, supplier_id)
    if not supplier or supplier.store_id != store_id:
        raise LookupError("Distributor not found.")
    if method not in PAYMENT_METHODS:
        raise OrderError("Payment method must be cash, easypaisa, jazzcash or bank.")
    if amount <= 0:
        raise OrderError("Amount must be more than zero.")
    owed = next((s["total_payable_pkr"] for s in calculate_payables(db, store_id, now=now)["suppliers"]
                 if s["supplier_id"] == supplier_id), 0.0)
    if amount > owed + 0.01:
        raise OrderError(f"You owe {supplier.name} only Rs {owed:,.0f}.")
    if method == CASH:
        cash = cash_position(db, store_id, now)["cash_in_hand_pkr"]
        if amount > cash + 0.01:
            raise OrderError(f"Only Rs {cash:,.0f} is in the cash box.")
    db.add(SupplierLedgerEntry(store_id=store_id, supplier_id=supplier_id, timestamp=now, debit=round(amount, 2),
                               credit=0.0, reference="PAYMENT", method=method,
                               description=(note or f"Payment ({method})")[:200]))
    db.commit()
    return {
        "supplier_id": supplier_id,
        "supplier_name": supplier.name,
        "amount_paid_pkr": round(amount, 2),
        "method": method,
        "previous_payable_pkr": round(owed, 2),
        "remaining_payable_pkr": round(owed - amount, 2),
        "cash_in_drawer_pkr": cash_position(db, store_id, now)["cash_in_hand_pkr"],
    }
