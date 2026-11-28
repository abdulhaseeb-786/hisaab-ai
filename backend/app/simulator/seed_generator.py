"""Deterministic simulator for one Pakistani general store ("digital twin").

What it simulates, day by day, for the last `DEMO_HISTORY_DAYS` days up to *now*:

* Product demand: a base daily rate per product (demand_profiles.py) multiplied by
  weekday, salary week, summer/winter, Ramadan, Chaand Raat and both Eids. Sales are
  capped by stock on the shelf, so a stockout really loses sales.
* Customers: baskets of 1-4 lines spread over opening hours.
* Khata: 15 regular customers who buy on credit. Each follows a payment habit
  (pays monthly, pays weekly, pays part, pays late, or has stopped paying).
* Distributors: each visits on fixed route days. The shopkeeper orders up to a target
  cover; goods arrive after the supplier's lead time, so some orders are still pending
  today. Every delivery creates a supplier invoice that is paid on its due date, in
  cash, if the drawer has enough money.
* Cash: rent, salary, electricity, transport, small daily costs, the owner's weekly
  household money and bank deposits. The drawer balance is never invented; analytics
  derive it from these records.

A few demo scenarios are curated on top (see `_apply_demo_scenarios`). Each one is
recorded as a normal business event (a stock count, a price change) with a clear reason.

The run is deterministic for a given seed and end date. Everything is written with bulk
inserts, so a full reset takes a few seconds.
"""

from __future__ import annotations

import math
import random
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta

from sqlalchemy import insert
from sqlalchemy.orm import Session

from app.core.calendar_pk import day_context
from app.core.clock import store_now
from app.core.config import settings
from app.models import (
    AppMeta, Customer, Expense, LedgerEntry, PriceHistory, Product, ProductPack, Purchase,
    PurchaseLine, Sale, SaleLine, StockMovement, Store, Supplier, SupplierLedgerEntry,
    SupplierProduct,
)
from app.simulator.catalog_pakistan import CATALOG_ITEMS, SUPPLIERS
from app.simulator.demand_profiles import (
    BASE_DAILY_UNITS, HOUR_WEIGHTS, demand_multiplier, expected_line_quantity,
    line_quantity_options,
)

SCHEMA_VERSION = "6"
STORE_ID = 1
OPENING_CASH = 150_000.0

# Distributor route days (Monday=0). Fresh goods come more often.
SUPPLIER_VISIT_DAYS: dict[int, list[int]] = {
    1: [0, 3],        # Oils: Monday, Thursday
    2: [1, 4],        # Grains mandi: Tuesday, Friday
    3: [2],           # National Foods: Wednesday
    4: [0, 2, 4],     # Dairy: Mon, Wed, Fri
    5: [3],           # Unilever: Thursday
    6: [1],           # Reckitt: Tuesday
    7: [5],           # Tapal: Saturday
    8: [0, 2, 4, 5],  # EBM, bread, drinks: Mon, Wed, Fri, Sat
}
# Some distributors are paid a few days late, as happens in practice.
SUPPLIER_PAYMENT_DELAY_DAYS: dict[int, int] = {3: 4, 6: 2}

SAFETY_DAYS = 2


@dataclass
class CustomerProfile:
    name: str
    phone: str
    credit_limit: float
    habit: str  # monthly, weekly, partial, late, defaulter, gone
    visit_prob: float
    pay_day: int = 3  # day of month (monthly/partial) or weekday (weekly)
    stop_buying_days_ago: int | None = None
    stop_paying_days_ago: int | None = None


# Phone numbers are fictional placeholders (0300-00000xx) so a demo click can never
# message a real person.
CUSTOMERS: list[CustomerProfile] = [
    CustomerProfile("Tariq Mahmood (Tariq Bhai)", "0300-0000101", 20000, "defaulter", 0.55, 4,
                    stop_buying_days_ago=16, stop_paying_days_ago=96),
    CustomerProfile("Chaudhry Akram", "0300-0000102", 35000, "monthly", 0.35, 2),
    CustomerProfile("Haji Abdul Rasheed", "0300-0000103", 30000, "monthly", 0.30, 5),
    CustomerProfile("Imran Butt", "0300-0000104", 15000, "partial", 0.35, 6),
    CustomerProfile("Dr. Salman Qureshi", "0300-0000105", 40000, "monthly", 0.20, 1),
    CustomerProfile("Bibi Zainab (Mohallah)", "0300-0000106", 12000, "weekly", 0.30, 6),
    CustomerProfile("Master Aslam (School Teacher)", "0300-0000107", 15000, "monthly", 0.30, 2),
    CustomerProfile("Rana Tanveer", "0300-0000108", 25000, "gone", 0.30, 7,
                    stop_buying_days_ago=112, stop_paying_days_ago=112),
    CustomerProfile("Malik Waqas", "0300-0000109", 20000, "partial", 0.30, 8),
    CustomerProfile("Sheikh Farhan", "0300-0000110", 30000, "weekly", 0.25, 5),
    CustomerProfile("Baji Shazia", "0300-0000111", 10000, "weekly", 0.30, 0),
    CustomerProfile("Nadeem Electrician", "0300-0000112", 12000, "late", 0.30, 10),
    CustomerProfile("Qari Sahab", "0300-0000113", 15000, "monthly", 0.20, 3),
    CustomerProfile("Zahid Tailor", "0300-0000114", 15000, "partial", 0.25, 9),
    CustomerProfile("Mirza Bilal", "0300-0000115", 20000, "monthly", 0.25, 4),
]


@dataclass
class ProductState:
    product_id: int
    sku: str
    name: str
    category: str
    unit: str
    supplier_id: int
    lead_time: int
    units_per_pack: int
    moq: int
    cost: float
    price: float
    base_rate: float
    stock: float = 0.0
    pending: float = 0.0
    recent_sales: deque = field(default_factory=lambda: deque(maxlen=21))

    def estimated_rate(self) -> float:
        """What the shopkeeper believes daily demand is: the last three weeks' average."""
        if len(self.recent_sales) >= 7:
            return sum(self.recent_sales) / len(self.recent_sales)
        return self.base_rate


@dataclass
class PriceEvent:
    sku: str
    days_ago: int
    new_cost: float
    new_price: float | None  # None: shelf price not changed (a margin squeeze)
    reason: str


# Price changes. Two are not passed on to the shelf price (margin squeezes); the others
# are normal changes that the shopkeeper did pass on, so the detector has to tell them apart.
PRICE_EVENTS = [
    PriceEvent("GRN-001", 130, 1180.0, 1320.0, "Atta rate cut after wheat harvest"),
    PriceEvent("GRN-003", 62, 148.0, 165.0, "Sugar mill rate increase"),
    PriceEvent("SPC-009", 45, 225.0, 270.0, "Distributor price list revision"),
    PriceEvent("TEA-001", 10, 735.0, None, "Tapal trade price increase"),
    PriceEvent("OIL-004", 14, 540.0, None, "Distributor price revision (+Rs 60 per pouch)"),
]

# Sparkle floor cleaner stopped selling when customers switched to a cheaper brand.
DEAD_STOCK_SKU = "CLN-012"
DEAD_STOCK_STOPPED_DAYS_AGO = 80
DEAD_STOCK_SCHEME_DAYS_AGO = 92  # bought two cartons on a trade scheme just before sales stopped


class _Ids:
    def __init__(self) -> None:
        self._next: dict[str, int] = defaultdict(lambda: 1)

    def next(self, table: str) -> int:
        value = self._next[table]
        self._next[table] = value + 1
        return value


def _poisson(rng: random.Random, lam: float) -> int:
    if lam <= 0:
        return 0
    if lam > 30:  # normal approximation is plenty for large rates
        return max(0, int(round(rng.gauss(lam, math.sqrt(lam)))))
    threshold, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= rng.random()
        if p <= threshold:
            return k
        k += 1


def seed_store_digital_twin(db: Session, seed: int = 42, now: datetime | None = None) -> dict:
    """Generate the whole store history into an empty schema. Returns a short summary."""
    rng = random.Random(seed)
    method_rng = random.Random(seed + 1)  # separate stream so payment methods do not shift the rest
    now = now or store_now()
    today = now.date()
    start_day = today - timedelta(days=settings.DEMO_HISTORY_DAYS)
    start_dt = datetime.combine(start_day, time(8, 0))
    ids = _Ids()

    def happened(ts: datetime) -> bool:
        return ts <= now

    rows: dict[type, list[dict]] = defaultdict(list)

    # ---- Store, suppliers, customers -------------------------------------------------
    rows[Store].append({
        "store_id": STORE_ID, "name": settings.STORE_NAME, "location": settings.STORE_LOCATION,
        "owner_name": settings.STORE_OWNER, "timezone": settings.STORE_TIMEZONE,
        "currency": "PKR", "default_credit_term_days": settings.DEFAULT_CREDIT_TERM_DAYS,
        "opening_cash_pkr": OPENING_CASH, "opening_cash_date": start_dt, "created_at": start_dt,
    })
    suppliers = {s["supplier_id"]: s for s in SUPPLIERS}
    for s in SUPPLIERS:
        rows[Supplier].append({
            "supplier_id": s["supplier_id"], "store_id": STORE_ID, "name": s["name"],
            "contact": s["contact"], "payment_terms_days": s["payment_terms_days"],
            "visit_days": ",".join(str(d) for d in SUPPLIER_VISIT_DAYS.get(s["supplier_id"], [])),
        })

    customer_ids: list[int] = []
    for profile in CUSTOMERS:
        cid = ids.next("customer")
        customer_ids.append(cid)
        rows[Customer].append({
            "customer_id": cid, "store_id": STORE_ID, "name": profile.name,
            "phone": profile.phone, "credit_limit": profile.credit_limit, "created_at": start_dt,
        })

    # ---- Products ----------------------------------------------------------------------
    products: dict[str, ProductState] = {}
    for item in CATALOG_ITEMS:
        pid = ids.next("product")
        state = ProductState(
            product_id=pid, sku=item["sku"], name=item["name"], category=item["category"],
            unit=item["unit"], supplier_id=item["supplier_id"], lead_time=item["lead_time"],
            units_per_pack=item["units_per_pack"], moq=item.get("moq", 1),
            cost=item["cost"], price=item["price"], base_rate=BASE_DAILY_UNITS.get(item["sku"], 0.5),
        )
        products[item["sku"]] = state
        rows[ProductPack].append({
            "pack_id": pid, "product_id": pid, "pack_unit": item["pack_unit"],
            "units_per_pack": item["units_per_pack"], "sell_unit": item["unit"],
        })
        rows[SupplierProduct].append({
            "supplier_product_id": pid, "supplier_id": item["supplier_id"], "product_id": pid,
            "unit_cost": item["cost"], "lead_time_days": item["lead_time"],
            "moq": item.get("moq", 1), "pack_size": item["units_per_pack"], "updated_at": start_dt,
        })
        rows[PriceHistory].append({
            "history_id": ids.next("price"), "product_id": pid, "effective_date": start_dt,
            "cost_price": item["cost"], "selling_price": item["price"], "reason": "Opening price list",
        })
        # Opening stock: two to three weeks of cover, at least one pack.
        opening = max(float(item["units_per_pack"]), round(state.base_rate * rng.uniform(14, 21)))
        state.stock = opening
        rows[StockMovement].append({
            "movement_id": ids.next("movement"), "store_id": STORE_ID, "product_id": pid,
            "timestamp": start_dt, "movement_type": "opening_stock", "qty_delta": opening,
            "reference_id": "OPENING", "reason": "Opening stock count",
        })

    price_events_by_day: dict[date, list[PriceEvent]] = defaultdict(list)
    for ev in PRICE_EVENTS:
        price_events_by_day[today - timedelta(days=ev.days_ago)].append(ev)

    # ---- Running state -----------------------------------------------------------------
    pending_deliveries: dict[date, list[int]] = defaultdict(list)  # day -> purchase ids
    purchase_lines_by_purchase: dict[int, list[tuple[ProductState, float]]] = defaultdict(list)
    purchase_rows: dict[int, dict] = {}
    purchase_line_rows: dict[int, list[dict]] = defaultdict(list)
    open_supplier_invoices: dict[int, list[list]] = defaultdict(list)  # [due_date, amount, ref]
    customer_balance: dict[int, float] = {cid: 0.0 for cid in customer_ids}
    drawer = OPENING_CASH

    hours = list(HOUR_WEIGHTS)
    hour_weights = [HOUR_WEIGHTS[h] for h in hours]
    total_hour_weight = sum(hour_weights)

    day = start_day
    while day <= today:
        ctx = day_context(day)
        is_today = day == today
        days_ago = (today - day).days

        # 1. Deliveries arrive at 10:00 and create a supplier invoice.
        for purchase_id in pending_deliveries.pop(day, []):
            arrival = datetime.combine(day, time(10, 0))
            if not happened(arrival):
                continue  # still on the way
            prow = purchase_rows[purchase_id]
            prow["status"], prow["received_date"] = "received", arrival
            for state, qty in purchase_lines_by_purchase[purchase_id]:
                state.stock += qty
                state.pending -= qty
                rows[StockMovement].append({
                    "movement_id": ids.next("movement"), "store_id": STORE_ID,
                    "product_id": state.product_id, "timestamp": arrival,
                    "movement_type": "purchase", "qty_delta": qty,
                    "reference_id": f"PO-{purchase_id}", "reason": "Distributor delivery",
                })
            for line in purchase_line_rows[purchase_id]:
                line["received_qty"] = line["qty"]
            terms = suppliers[prow["supplier_id"]]["payment_terms_days"]
            ref = f"INV-{purchase_id}"
            due = datetime.combine(day + timedelta(days=terms), time(12, 0))
            rows[SupplierLedgerEntry].append({
                "entry_id": ids.next("supplier_ledger"), "store_id": STORE_ID,
                "supplier_id": prow["supplier_id"], "timestamp": arrival, "debit": 0.0,
                "credit": prow["total"], "due_date": due, "reference": ref,
                "description": f"Invoice for delivery PO-{purchase_id}",
                "method": None,
            })
            open_supplier_invoices[prow["supplier_id"]].append([due.date(), prow["total"], ref])

        # 2. Price list changes take effect at opening time.
        for ev in price_events_by_day.get(day, []):
            state = products[ev.sku]
            state.cost = ev.new_cost
            if ev.new_price is not None:
                state.price = ev.new_price
            rows[PriceHistory].append({
                "history_id": ids.next("price"), "product_id": state.product_id,
                "effective_date": datetime.combine(day, time(8, 0)), "cost_price": state.cost,
                "selling_price": state.price, "reason": ev.reason,
            })

        # 3. Demand. On the current day only the hours that have already passed count.
        if is_today:
            open_hours = [h for h in hours if h < now.hour]
            day_fraction = sum(HOUR_WEIGHTS[h] for h in open_hours) / total_hour_weight
        else:
            open_hours, day_fraction = hours, 1.0
        store_noise = max(0.6, rng.gauss(1.0, 0.08))

        lines: list[tuple[ProductState, float]] = []
        for state in products.values():
            rate = state.base_rate
            if state.sku == DEAD_STOCK_SKU and days_ago <= DEAD_STOCK_STOPPED_DAYS_AGO:
                rate = 0.0
            expected_units = rate * demand_multiplier(state.sku, state.category, ctx) * store_noise * day_fraction
            values, weights = line_quantity_options(state.unit, state.sku)
            n_lines = _poisson(rng, expected_units / expected_line_quantity(state.unit, state.sku))
            sold_today = 0.0
            for _ in range(n_lines):
                qty = float(rng.choices(values, weights)[0])
                qty = min(qty, state.stock)
                if qty <= 0:
                    break  # out of stock: the sale is lost
                state.stock -= qty
                sold_today += qty
                lines.append((state, qty))
            if not is_today:
                state.recent_sales.append(sold_today)

        # 4. Group lines into customer baskets.
        rng.shuffle(lines)
        baskets: list[list[tuple[ProductState, float]]] = []
        i = 0
        while i < len(lines):
            size = rng.choices([1, 2, 3, 4], [0.38, 0.32, 0.2, 0.1])[0]
            baskets.append(lines[i:i + size])
            i += size

        # 5. Khata customers take some baskets on credit.
        basket_owner: dict[int, int] = {}
        free = list(range(len(baskets)))
        rng.shuffle(free)
        for cid, profile in zip(customer_ids, CUSTOMERS):
            if profile.stop_buying_days_ago is not None and days_ago <= profile.stop_buying_days_ago:
                continue
            if free and rng.random() < profile.visit_prob * day_fraction:
                basket_owner[free.pop()] = cid

        cash_sales_today = 0.0
        for b_index, basket in enumerate(baskets):
            hour = rng.choices(open_hours, [HOUR_WEIGHTS[h] for h in open_hours])[0]
            ts = datetime.combine(day, time(hour, rng.randint(0, 59), rng.randint(0, 59)))
            if is_today and not happened(ts):
                ts = now - timedelta(minutes=rng.randint(1, 50))
            sale_id = ids.next("sale")
            cid = basket_owner.get(b_index)
            total = 0.0
            for state, qty in basket:
                total += qty * state.price
                rows[SaleLine].append({
                    "sale_line_id": ids.next("sale_line"), "sale_id": sale_id,
                    "product_id": state.product_id, "qty": qty, "unit_price": state.price,
                    "unit_cost_snapshot": state.cost, "discount": 0.0,
                })
                rows[StockMovement].append({
                    "movement_id": ids.next("movement"), "store_id": STORE_ID,
                    "product_id": state.product_id, "timestamp": ts, "movement_type": "sale",
                    "qty_delta": -qty, "reference_id": f"SALE-{sale_id}", "reason": "Customer sale",
                })
            total = round(total, 2)
            rows[Sale].append({
                "sale_id": sale_id, "store_id": STORE_ID, "timestamp": ts, "customer_id": cid,
                "payment_type": "udhaar" if cid else "cash", "status": "completed",
                "total": total, "discount": 0.0,
            })
            if cid:
                customer_balance[cid] += total
                rows[LedgerEntry].append({
                    "entry_id": ids.next("ledger"), "store_id": STORE_ID, "customer_id": cid,
                    "timestamp": ts, "debit": total, "credit": 0.0,
                    "due_date": ts + timedelta(days=settings.DEFAULT_CREDIT_TERM_DAYS),
                    "reference": f"SALE-{sale_id}", "description": "Groceries on khata",
                    "sale_id": sale_id, "method": None,
                })
            else:
                cash_sales_today += total
        drawer += cash_sales_today

        # 6. Khata repayments (wasooli), in the evening.
        for cid, profile in zip(customer_ids, CUSTOMERS):
            balance = customer_balance[cid]
            if balance < 300:
                continue
            pay_ts = datetime.combine(day, time(19, rng.randint(0, 59)))
            if not happened(pay_ts):
                continue
            stopped = profile.stop_paying_days_ago is not None and days_ago <= profile.stop_paying_days_ago
            amount = 0.0
            if profile.habit == "monthly" and day.day == profile.pay_day:
                amount = balance
            elif profile.habit == "weekly" and day.weekday() == profile.pay_day:
                amount = balance
            elif profile.habit == "partial" and day.day == profile.pay_day:
                amount = balance * rng.uniform(0.6, 0.8)
            elif profile.habit == "late" and day.day == profile.pay_day and day.month % 2 == 0:
                amount = balance * rng.uniform(0.7, 0.9)  # pays every second month
            elif profile.habit == "defaulter":
                if not stopped and day.day == profile.pay_day:
                    amount = balance
                elif stopped and days_ago == 52:
                    amount = 3000.0  # a small token payment, then nothing
            elif profile.habit == "gone":
                if not stopped and day.day == profile.pay_day:
                    amount = balance * 0.7
            amount = round(balance, 2) if amount >= balance else math.floor(amount / 10) * 10
            if amount <= 0:
                continue
            customer_balance[cid] -= amount
            # Most pay cash at the counter; some send it by Easypaisa or JazzCash.
            method = method_rng.choices(["cash", "easypaisa", "jazzcash"], [0.75, 0.15, 0.10])[0]
            if method == "cash":
                drawer += amount
            rows[LedgerEntry].append({
                "entry_id": ids.next("ledger"), "store_id": STORE_ID, "customer_id": cid,
                "timestamp": pay_ts, "debit": 0.0, "credit": amount, "due_date": None,
                "reference": "WASOOLI", "sale_id": None, "method": method,
                "description": "Repayment (wasooli)" if method == "cash" else f"Repayment by {method.title()}",
            })

        # 7. Distributor visits: order up to target cover; delivery after the lead time.
        def place_order(supplier_id: int, order: list[tuple[ProductState, float]], order_ts: datetime) -> None:
            lead = max(s.lead_time for s, _ in order)
            purchase_id = ids.next("purchase")
            arrival_day = day + timedelta(days=lead)
            total = round(sum(q * s.cost for s, q in order), 2)
            purchase_rows[purchase_id] = {
                "purchase_id": purchase_id, "store_id": STORE_ID, "supplier_id": supplier_id,
                "date": order_ts, "status": "pending", "total": total,
                "expected_date": datetime.combine(arrival_day, time(10, 0)), "received_date": None,
            }
            for state, qty in order:
                state.pending += qty
                purchase_lines_by_purchase[purchase_id].append((state, qty))
                line_row = {
                    "purchase_line_id": ids.next("purchase_line"), "purchase_id": purchase_id,
                    "product_id": state.product_id, "qty": qty, "received_qty": 0.0,
                    "unit_cost": state.cost,
                }
                rows[PurchaseLine].append(line_row)
                purchase_line_rows[purchase_id].append(line_row)
            pending_deliveries[arrival_day].append(purchase_id)

        if days_ago == DEAD_STOCK_SCHEME_DAYS_AGO:
            # The distributor's trade scheme: two extra cartons of Sparkle at the usual rate.
            sparkle = products[DEAD_STOCK_SKU]
            place_order(sparkle.supplier_id, [(sparkle, float(2 * sparkle.units_per_pack))],
                        datetime.combine(day, time(11, 0)))

        for supplier_id, visit_days in SUPPLIER_VISIT_DAYS.items():
            if day.weekday() not in visit_days:
                continue
            order_ts = datetime.combine(day, time(11, 30))
            if not happened(order_ts):
                continue
            review_days = min(((d - day.weekday()) % 7) or 7 for d in visit_days)
            order: list[tuple[ProductState, float]] = []
            for state in products.values():
                if state.supplier_id != supplier_id:
                    continue
                rate = state.estimated_rate()
                if rate <= 0.02:
                    continue
                position = state.stock + state.pending
                trigger = rate * (review_days + state.lead_time + 1)
                target = rate * (review_days + state.lead_time + SAFETY_DAYS + 3)
                if position >= trigger:
                    continue
                packs = max(state.moq, math.ceil((target - position) / state.units_per_pack))
                order.append((state, float(packs * state.units_per_pack)))
            if order:
                place_order(supplier_id, order, order_ts)

        # 8. Pay supplier invoices that are due (cash permitting).
        pay_ts = datetime.combine(day, time(12, 30))
        if happened(pay_ts):
            for supplier_id, invoices in open_supplier_invoices.items():
                delay = SUPPLIER_PAYMENT_DELAY_DAYS.get(supplier_id, 0)
                still_open = []
                for due_day, amount, ref in invoices:
                    if day >= due_day + timedelta(days=delay) and drawer - amount >= 20_000:
                        drawer -= amount
                        rows[SupplierLedgerEntry].append({
                            "entry_id": ids.next("supplier_ledger"), "store_id": STORE_ID,
                            "supplier_id": supplier_id, "timestamp": pay_ts, "debit": amount,
                            "credit": 0.0, "due_date": None, "reference": f"PAY-{ref}",
                            "description": f"Cash payment for {ref}", "method": "cash",
                        })
                    else:
                        still_open.append([due_day, amount, ref])
                open_supplier_invoices[supplier_id] = still_open

        # 9. Cash expenses.
        def spend(category: str, amount: float, at: time, description: str) -> None:
            nonlocal drawer
            ts = datetime.combine(day, at)
            if not happened(ts):
                return
            drawer -= amount
            rows[Expense].append({
                "expense_id": ids.next("expense"), "store_id": STORE_ID, "date": ts,
                "category": category, "amount": round(amount, 2), "description": description,
            })

        if day.day == 1:
            spend("rent", 35_000, time(10, 30), "Shop rent")
            spend("salaries", 25_000, time(21, 0), "Salary for one shop helper")
        if day.day == 10:
            bill = 26_000 if ctx.is_summer else 12_000 if ctx.is_winter else 17_000
            spend("electricity", bill, time(11, 0), "IESCO electricity bill")
        if day.weekday() == 5:
            spend("transport", 1_500, time(16, 0), "Loader rickshaw for mandi goods")
        spend("general", round(rng.uniform(150, 400), -1), time(21, 30), "Shopping bags, chai, small items")
        if day.weekday() == 6:
            spend("owner_drawings", round(rng.uniform(12_000, 16_000), -2), time(22, 0), "Ghar ka kharcha (owner household money)")
        if day.weekday() == 0 and drawer > 450_000:
            spend("bank_deposit", round(drawer - 300_000, -3), time(13, 0), "Cash deposited to bank")

        day += timedelta(days=1)

    for prow in purchase_rows.values():
        rows[Purchase].append(prow)

    _apply_demo_scenarios(rows, products, ids, now)

    # ---- Products with their final stock and prices -----------------------------------
    for state in products.values():
        rows[Product].append({
            "product_id": state.product_id, "store_id": STORE_ID, "sku": state.sku,
            "name": state.name, "category": state.category, "unit": state.unit,
            "cost_price": state.cost, "selling_price": state.price,
            "stock_qty": round(state.stock, 2), "supplier_id": state.supplier_id,
            "lead_time_days": state.lead_time, "safety_stock_days": SAFETY_DAYS,
            "image_url": None, "active": True, "created_at": start_dt,
        })

    rows[AppMeta].extend([
        {"key": "schema_version", "value": SCHEMA_VERSION},
        {"key": "seed", "value": str(seed)},
        {"key": "seeded_at", "value": now.isoformat()},
        {"key": "data_start", "value": start_day.isoformat()},
        {"key": "data_end", "value": today.isoformat()},
    ])

    # FK order matters for SQLite with foreign keys on.
    for model in (Store, AppMeta, Supplier, Customer, Product, ProductPack, SupplierProduct,
                  PriceHistory, Purchase, PurchaseLine, Sale, SaleLine, StockMovement,
                  LedgerEntry, SupplierLedgerEntry, Expense):
        batch = rows.get(model)
        if batch:
            db.execute(insert(model), batch)
    db.commit()

    from app.simulator.day_history import seed_day_sessions
    seed_day_sessions(db, now, seed)

    return {
        "store_id": STORE_ID,
        "store_name": settings.STORE_NAME,
        "seed": seed,
        "data_start": start_day.isoformat(),
        "data_end": today.isoformat(),
        "products": len(rows[Product]),
        "sales": len(rows[Sale]),
        "sale_lines": len(rows[SaleLine]),
        "customers": len(rows[Customer]),
        "purchases": len(rows[Purchase]),
    }


def _apply_demo_scenarios(rows: dict, products: dict[str, ProductState], ids: _Ids, now: datetime) -> None:
    """Curated demo moments, each recorded as an ordinary business event.

    1. Dalda 1L pouch is nearly out: yesterday's stock count found leaking pouches, and
       no order is on the way, so stock is below lead-time demand.
    The margin squeezes (Sufi canola, Tapal Danedar), the dead stock (Sparkle) and the
    khata defaulter (Tariq Bhai) come from PRICE_EVENTS, DEAD_STOCK_SKU and CUSTOMERS.
    """
    dalda = products["OIL-001"]
    # Remove Dalda from any order that has not arrived yet (the order booker missed it).
    pending_ids = {p["purchase_id"] for p in rows[Purchase] if p["status"] == "pending"}
    kept = []
    for line in rows[PurchaseLine]:
        if line["purchase_id"] in pending_ids and line["product_id"] == dalda.product_id:
            dalda.pending -= line["qty"]
            for p in rows[Purchase]:
                if p["purchase_id"] == line["purchase_id"]:
                    p["total"] = round(p["total"] - line["qty"] * line["unit_cost"], 2)
            continue
        kept.append(line)
    rows[PurchaseLine][:] = kept
    rows[Purchase][:] = [
        p for p in rows[Purchase]
        if p["status"] != "pending" or any(l["purchase_id"] == p["purchase_id"] for l in kept)
    ]

    target_stock = 8.0
    delta = target_stock - dalda.stock
    if abs(delta) > 0.01:
        when = datetime.combine(now.date() - timedelta(days=1), time(21, 40))
        rows[StockMovement].append({
            "movement_id": ids.next("movement"), "store_id": STORE_ID,
            "product_id": dalda.product_id, "timestamp": when, "movement_type": "adjustment",
            "qty_delta": delta, "reference_id": "STOCK-COUNT",
            "reason": "Stock count: leaking pouches written off" if delta < 0 else "Stock count correction",
        })
        dalda.stock = target_stock
