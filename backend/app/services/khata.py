"""Khata at the counter: who took what on credit, when, and the "udhaar dun?" check.

Every udhaar entry is itemised: it creates a sale with its lines (product, quantity,
price), takes the items out of stock, and adds one khata line that points to that sale.
So the khata can always show exactly what was bought, at what price, and when it is due.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.analytics.cash_book import cash_position
from app.analytics.credit_aging import calculate_credit_summary
from app.core.clock import store_now
from app.models import Customer, LedgerEntry, Product, Sale, SaleLine, StockMovement, Store

PAYMENT_METHODS = {"cash", "easypaisa", "jazzcash", "bank"}
METHOD_LABEL = {"cash": "Cash", "easypaisa": "Easypaisa", "jazzcash": "JazzCash", "bank": "Bank transfer"}


class KhataError(ValueError):
    pass


def _balance(db: Session, customer_id: int) -> float:
    d, c = db.query(func.coalesce(func.sum(LedgerEntry.debit), 0.0), func.coalesce(func.sum(LedgerEntry.credit), 0.0)).filter(
        LedgerEntry.customer_id == customer_id).one()
    return round(float(d) - float(c), 2)


def list_customers(db: Session, store_id: int = 1, search: str | None = None, now: datetime | None = None) -> list[dict[str, Any]]:
    now = now or store_now()
    summary = {c["customer_id"]: c for c in calculate_credit_summary(db, store_id, now)["customers"]}
    last_seen = dict(
        db.query(LedgerEntry.customer_id, func.max(LedgerEntry.timestamp))
        .filter(LedgerEntry.store_id == store_id).group_by(LedgerEntry.customer_id)
    )
    out = []
    for c in db.query(Customer).filter(Customer.store_id == store_id).order_by(Customer.name):
        if search and search.lower() not in c.name.lower() and search not in (c.phone or ""):
            continue
        s = summary.get(c.customer_id)
        out.append({
            "customer_id": c.customer_id,
            "name": c.name,
            "phone": c.phone,
            "credit_limit_pkr": c.credit_limit,
            "balance_pkr": s["total_balance_pkr"] if s else 0.0,
            "overdue_pkr": s["overdue_amount_pkr"] if s else 0.0,
            "safe_mark_score": s["safe_mark_score"] if s else 100.0,
            "risk_level": s["risk_level"] if s else "low",
            "last_activity": last_seen.get(c.customer_id),
        })
    # Most recently active first: the customer at the counter is usually a regular.
    out.sort(key=lambda x: x["last_activity"] or datetime.min, reverse=True)
    return out


def create_customer(db: Session, name: str, phone: str | None, credit_limit: float, store_id: int = 1) -> dict[str, Any]:
    name = name.strip()
    if len(name) < 2:
        raise KhataError("Write the customer's name.")
    if db.query(Customer).filter(Customer.store_id == store_id, func.lower(Customer.name) == name.lower()).first():
        raise KhataError(f"A customer called {name} already exists.")
    c = Customer(store_id=store_id, name=name, phone=(phone or "").strip() or None, credit_limit=credit_limit, created_at=store_now())
    db.add(c)
    db.commit()
    return {"customer_id": c.customer_id, "name": c.name, "phone": c.phone, "credit_limit_pkr": c.credit_limit,
            "balance_pkr": 0.0, "overdue_pkr": 0.0, "safe_mark_score": 100.0, "risk_level": "low", "last_activity": None}


def credit_check(db: Session, customer_id: int, amount: float, store_id: int = 1, now: datetime | None = None) -> dict[str, Any]:
    """'Udhaar dun?' A clear yes / careful / no, with the reasons, before giving credit."""
    now = now or store_now()
    cust = db.get(Customer, customer_id)
    if not cust or cust.store_id != store_id:
        raise LookupError("Customer not found.")
    s = next((c for c in calculate_credit_summary(db, store_id, now)["customers"] if c["customer_id"] == customer_id), None)
    balance = s["total_balance_pkr"] if s else 0.0
    overdue = s["overdue_amount_pkr"] if s else 0.0
    days = s["days_overdue"] if s else 0
    score = s["safe_mark_score"] if s else 100.0
    limit = cust.credit_limit or 0.0
    after = balance + amount

    reasons: list[dict[str, str]] = []
    decision = "yes"
    if score < 30 or days > 60:
        decision = "no"
        reasons.append({"en": f"Oldest unpaid bill is {days} days late (Safe Mark {score:.0f}/100).",
                        "ur": f"Purana bill {days} din late hai (Safe Mark {score:.0f}/100)."})
    if limit and after > limit * 1.25:
        decision = "no"
        reasons.append({"en": f"Khata would be Rs {after:,.0f}, well above the Rs {limit:,.0f} limit.",
                        "ur": f"Khata Rs {after:,.0f} ho jaye ga, had Rs {limit:,.0f} se kaafi zyada."})
    if decision != "no":
        if limit and after > limit:
            decision = "careful"
            reasons.append({"en": f"This takes the khata to Rs {after:,.0f}, above the Rs {limit:,.0f} limit.",
                            "ur": f"Is se khata Rs {after:,.0f} ho jaye ga, had Rs {limit:,.0f} se zyada."})
        if overdue > 0:
            decision = "careful"
            reasons.append({"en": f"Rs {overdue:,.0f} is already late ({days} days).",
                            "ur": f"Rs {overdue:,.0f} pehle se late hai ({days} din)."})
        if score < 60:
            decision = "careful"
            reasons.append({"en": f"Safe Mark is {score:.0f}/100.", "ur": f"Safe Mark {score:.0f}/100 hai."})
    if not reasons:
        reasons.append({"en": f"Pays on time. Khata after this: Rs {after:,.0f} of the Rs {limit:,.0f} limit.",
                        "ur": f"Waqt par deta hai. Is ke baad khata: Rs {after:,.0f}, had Rs {limit:,.0f}."})
    room = max(0.0, limit - balance) if days <= 30 else 0.0
    return {
        "customer_id": customer_id,
        "name": cust.name,
        "amount_pkr": round(amount, 2),
        "decision": decision,
        "balance_pkr": balance,
        "balance_after_pkr": round(after, 2),
        "overdue_pkr": overdue,
        "days_overdue": days,
        "credit_limit_pkr": limit,
        "safe_mark_score": score,
        "safe_amount_pkr": round(room, 0),
        "reasons": reasons,
    }


def _receipt(store: Store | None, customer: Customer, items: list[dict[str, Any]], extra: float, note: str | None,
             total: float, balance: float, due: datetime, when: datetime, cash: bool = False) -> dict[str, str]:
    shop = store.name if store else ""
    lines = [f"- {i['name']}: {i['qty']:g} x Rs {i['unit_price']:,.0f} = Rs {i['line_total']:,.0f}" for i in items]
    if extra:
        label = f"Naqad (cash){': ' + note if note else ''}" if cash else (note or "Udhaar")
        lines.append(f"- {label}: Rs {extra:,.0f}")
    ur = "\n".join([
        f"*{shop}*", f"{customer.name}, {when:%d %b %Y, %I:%M %p}", "", "Udhaar par:", *lines,
        f"*Kul: Rs {total:,.0f}*", f"Aap ka kul khata: Rs {balance:,.0f}", f"Wapsi ki tareekh: {due:%d %b %Y}", "Shukriya!",
    ])
    en = "\n".join([
        f"*{shop}*", f"{customer.name}, {when:%d %b %Y, %I:%M %p}", "", "On credit:", *lines,
        f"*Total: Rs {total:,.0f}*", f"Your khata balance: Rs {balance:,.0f}", f"Due by: {due:%d %b %Y}", "Thank you!",
    ])
    return {"roman_urdu": ur, "english": en}


def record_udhaar(db: Session, customer_id: int, items: list[dict[str, Any]], extra_amount: float = 0.0,
                  note: str | None = None, store_id: int = 1, now: datetime | None = None,
                  cash_from_galla: bool = False, due_date: datetime | None = None) -> dict[str, Any]:
    """Write one udhaar line.

    `cash_from_galla`: the extra amount is cash handed over from the drawer (naqad udhaar),
    so the cash book takes it out of the galla. Otherwise it is goods or a sum on credit
    and the galla does not change. `due_date` overrides the shop's usual credit term.
    """
    now = now or store_now()
    cust = db.get(Customer, customer_id)
    if not cust or cust.store_id != store_id:
        raise LookupError("Customer not found.")
    if not items and extra_amount <= 0:
        raise KhataError("Add at least one item, or an amount.")
    if extra_amount < 0:
        raise KhataError("Amount cannot be negative.")
    if cash_from_galla and extra_amount <= 0:
        raise KhataError("Write how much cash was given.")
    if cash_from_galla:
        cash = cash_position(db, store_id, now)["cash_in_hand_pkr"]
        if extra_amount > cash + 0.01:
            raise KhataError(f"Only Rs {cash:,.0f} is in the cash box.")
    if due_date is not None and due_date.date() < now.date():
        raise KhataError("The return date cannot be in the past.")

    products = {p.product_id: p for p in db.query(Product).filter(Product.product_id.in_([i["product_id"] for i in items]))}
    lines: list[dict[str, Any]] = []
    for i in items:
        p = products.get(i["product_id"])
        qty = float(i["qty"])
        if not p or p.store_id != store_id:
            raise KhataError("One of the items is not in this shop.")
        if qty <= 0:
            raise KhataError(f"Quantity for {p.name} must be more than zero.")
        if qty > p.stock_qty + 1e-9:
            raise KhataError(f"Only {p.stock_qty:g} {p.unit} of {p.name} in stock.")
        lines.append({"product": p, "product_id": p.product_id, "name": p.name, "unit": p.unit, "qty": qty,
                      "unit_price": p.selling_price, "line_total": round(qty * p.selling_price, 2)})

    store = db.get(Store, store_id)
    term = store.default_credit_term_days if store else 30
    items_total = round(sum(l["line_total"] for l in lines), 2)
    total = round(items_total + extra_amount, 2)
    due = due_date or now + timedelta(days=term)

    sale_id = None
    if lines:
        sale = Sale(store_id=store_id, timestamp=now, customer_id=customer_id, payment_type="udhaar",
                    status="completed", total=items_total, discount=0.0)
        db.add(sale)
        db.flush()
        sale_id = sale.sale_id
        for l in lines:
            p = l["product"]
            db.add(SaleLine(sale_id=sale.sale_id, product_id=p.product_id, qty=l["qty"], unit_price=p.selling_price,
                            unit_cost_snapshot=p.cost_price, discount=0.0))
            p.stock_qty = round(p.stock_qty - l["qty"], 3)
            db.add(StockMovement(store_id=store_id, product_id=p.product_id, timestamp=now, movement_type="sale",
                                 qty_delta=-l["qty"], reference_id=f"SALE-{sale.sale_id}", reason=f"Udhaar to {cust.name}"))

    summary = ", ".join(f"{l['name']} x{l['qty']:g}" for l in lines)
    if extra_amount:
        label = note or ("Naqad (cash)" if cash_from_galla else "Amount")
        summary = ", ".join(x for x in [summary, f"{label} Rs {extra_amount:,.0f}"] if x)
    entry = LedgerEntry(store_id=store_id, customer_id=customer_id, timestamp=now, debit=total, credit=0.0,
                        due_date=due, reference=f"SALE-{sale_id}" if sale_id else "UDHAAR",
                        description=(summary or note or "Udhaar")[:200], sale_id=sale_id,
                        kind="cash_loan" if cash_from_galla else None)
    db.add(entry)
    db.commit()
    balance = _balance(db, customer_id)
    clean = [{k: v for k, v in l.items() if k != "product"} for l in lines]
    return {
        "entry_id": entry.entry_id,
        "customer_id": customer_id,
        "name": cust.name,
        "timestamp": now,
        "items": clean,
        "extra_amount_pkr": round(extra_amount, 2),
        "note": note,
        "total_pkr": total,
        "due_date": due,
        "balance_pkr": balance,
        "cash_from_galla": cash_from_galla,
        "receipt": _receipt(store, cust, clean, extra_amount, note, total, balance, due, now, cash_from_galla),
    }


def record_payment(db: Session, customer_id: int, amount: float, method: str = "cash", notes: str | None = None,
                   store_id: int = 1, now: datetime | None = None) -> dict[str, Any]:
    now = now or store_now()
    cust = db.get(Customer, customer_id)
    if not cust or cust.store_id != store_id:
        raise LookupError("Customer not found.")
    if method not in PAYMENT_METHODS:
        raise KhataError("Payment method must be cash, easypaisa, jazzcash or bank.")
    if amount <= 0:
        raise KhataError("Amount must be more than zero.")
    balance = _balance(db, customer_id)
    if amount > balance + 0.01:
        raise KhataError(f"{cust.name} only owes Rs {balance:,.0f}.")
    entry = LedgerEntry(store_id=store_id, customer_id=customer_id, timestamp=now, debit=0.0, credit=round(amount, 2),
                        reference="WASOOLI", method=method,
                        description=(notes or f"Repayment ({METHOD_LABEL[method]})")[:200])
    db.add(entry)
    db.commit()
    new_balance = round(balance - amount, 2)
    store = db.get(Store, store_id)
    shop = store.name if store else ""
    return {
        "entry_id": entry.entry_id,
        "customer_id": cust.customer_id,
        "name": cust.name,
        "amount_received": amount,
        "method": method,
        "previous_balance": balance,
        "new_balance": new_balance,
        "message": f"Rs {amount:,.0f} received from {cust.name} by {METHOD_LABEL[method]}. Balance now Rs {new_balance:,.0f}.",
        "receipt": {
            "roman_urdu": f"*{shop}*\n{cust.name}, {now:%d %b %Y, %I:%M %p}\nWasool hua: Rs {amount:,.0f} ({METHOD_LABEL[method]})\nBaqi khata: Rs {new_balance:,.0f}\nShukriya!",
            "english": f"*{shop}*\n{cust.name}, {now:%d %b %Y, %I:%M %p}\nReceived: Rs {amount:,.0f} ({METHOD_LABEL[method]})\nRemaining khata: Rs {new_balance:,.0f}\nThank you!",
        },
    }


def entry_items(db: Session, sale_ids: list[int]) -> dict[int, list[dict[str, Any]]]:
    """Items bought on each udhaar sale, for the khata history."""
    out: dict[int, list[dict[str, Any]]] = {}
    if not sale_ids:
        return out
    for line, product in (
        db.query(SaleLine, Product).join(Product, Product.product_id == SaleLine.product_id)
        .filter(SaleLine.sale_id.in_(sale_ids))
    ):
        out.setdefault(line.sale_id, []).append({
            "product_id": product.product_id, "name": product.name, "unit": product.unit,
            "qty": line.qty, "unit_price": line.unit_price, "line_total": round(line.qty * line.unit_price, 2),
        })
    return out
