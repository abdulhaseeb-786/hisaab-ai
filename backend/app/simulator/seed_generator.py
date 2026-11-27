"""Deterministic Pakistani General Store Digital Twin Simulator.
Seeds 120 SKUs, 8 categories, 9 months of sales/purchases, Ramadan/Eid surges,
customer khata, supplier payables, operating expenses, and 5 curated demo scenarios.
Fixed seed 42 for 100% reproducibility and high-speed in-memory bulk insertions.
"""

import random
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models import (
    Store, Product, ProductPack, PriceHistory,
    Sale, SaleLine, StockMovement,
    Supplier, SupplierProduct, Purchase, PurchaseLine,
    Customer, LedgerEntry, SupplierLedgerEntry,
    Expense
)
from app.simulator.catalog_pakistan import CATALOG_ITEMS, SUPPLIERS

CUSTOMERS_DATA = [
    {"name": "Tariq Mahmood (Tariq Bhai)", "phone": "0300-9876541", "credit_limit": 20000.0, "safe_mark": 42.0}, # Overdue demo scenario
    {"name": "Chaudhry Akram", "phone": "0321-7654321", "credit_limit": 35000.0, "safe_mark": 92.0},
    {"name": "Haji Abdul Rasheed", "phone": "0333-1122334", "credit_limit": 30000.0, "safe_mark": 88.0},
    {"name": "Imran Butt", "phone": "0345-5566778", "credit_limit": 15000.0, "safe_mark": 65.0},
    {"name": "Dr. Salman Qureshi", "phone": "0312-3344556", "credit_limit": 40000.0, "safe_mark": 95.0},
    {"name": "Bibi Zainab (Mohallah)", "phone": "0302-9988776", "credit_limit": 12000.0, "safe_mark": 78.0},
    {"name": "Master Aslam (School Teacher)", "phone": "0322-4455667", "credit_limit": 15000.0, "safe_mark": 82.0},
    {"name": "Rana Tanveer", "phone": "0301-6677889", "credit_limit": 25000.0, "safe_mark": 55.0},
    {"name": "Malik Waqas", "phone": "0334-8899001", "credit_limit": 20000.0, "safe_mark": 70.0},
    {"name": "Sheikh Farhan", "phone": "0307-2233445", "credit_limit": 30000.0, "safe_mark": 90.0},
    {"name": "Baji Shazia", "phone": "0346-7788992", "credit_limit": 10000.0, "safe_mark": 74.0},
    {"name": "Nadeem Electrician", "phone": "0313-1144778", "credit_limit": 12000.0, "safe_mark": 60.0},
    {"name": "Qari Sahab", "phone": "0323-5588991", "credit_limit": 15000.0, "safe_mark": 96.0},
    {"name": "Zahid Tailor", "phone": "0305-6699223", "credit_limit": 15000.0, "safe_mark": 80.0},
    {"name": "Mirza Bilal", "phone": "0335-3366990", "credit_limit": 20000.0, "safe_mark": 72.0},
]

def seed_store_digital_twin(db: Session, seed: int = 42) -> Store:
    """Generate the complete deterministic retail digital twin in seconds."""
    random.seed(seed)
    
    # 1. Create Store
    store = Store(
        store_id=1,
        name=settings.STORE_NAME,
        timezone="Asia/Karachi",
        currency="PKR",
        default_credit_term_days=settings.DEFAULT_CREDIT_TERM_DAYS,
        created_at=datetime(2026, 3, 1, 8, 0, tzinfo=timezone.utc)
    )
    db.add(store)
    db.flush()

    # 2. Add Suppliers
    supplier_map = {}
    for sup_data in SUPPLIERS:
        sup = Supplier(
            supplier_id=sup_data["supplier_id"],
            store_id=store.store_id,
            name=sup_data["name"],
            contact=sup_data["contact"],
            payment_terms_days=sup_data["payment_terms_days"]
        )
        db.add(sup)
        supplier_map[sup_data["supplier_id"]] = sup
    db.flush()

    # 3. Add Customers (Khata holders)
    customer_objs = []
    for cust in CUSTOMERS_DATA:
        c = Customer(
            store_id=store.store_id,
            name=cust["name"],
            phone=cust["phone"],
            credit_limit=cust["credit_limit"],
            safe_mark_score=cust["safe_mark"],
            created_at=datetime(2026, 3, 1, 9, 0, tzinfo=timezone.utc)
        )
        db.add(c)
        customer_objs.append(c)
    db.flush()

    # 4. Add Products, ProductPacks, and PriceHistory
    product_objs = {}
    start_date = datetime(2026, 3, 1, 0, 0, tzinfo=timezone.utc)
    end_date = datetime(2026, 11, 26, 0, 0, tzinfo=timezone.utc)

    for item in CATALOG_ITEMS:
        prod = Product(
            store_id=store.store_id,
            sku=item["sku"],
            name=item["name"],
            category=item["category"],
            unit=item["unit"],
            cost_price=item["cost"],
            selling_price=item["price"],
            stock_qty=0.0,
            supplier_id=item["supplier_id"],
            lead_time_days=item["lead_time"],
            safety_stock_days=2,
            image_url=item.get("image_url"),
            active=True,
            created_at=start_date
        )
        db.add(prod)
        product_objs[item["sku"]] = prod

    db.flush()

    for item in CATALOG_ITEMS:
        prod = product_objs[item["sku"]]
        pack = ProductPack(
            product_id=prod.product_id,
            pack_unit=item["pack_unit"],
            units_per_pack=item["units_per_pack"],
            sell_unit=item["unit"]
        )
        db.add(pack)

        sp = SupplierProduct(
            supplier_id=item["supplier_id"],
            product_id=prod.product_id,
            unit_cost=item["cost"],
            lead_time_days=item["lead_time"],
            moq=item["moq"],
            pack_size=item["units_per_pack"],
            updated_at=start_date
        )
        db.add(sp)

        ph = PriceHistory(
            product_id=prod.product_id,
            effective_date=start_date,
            cost_price=item["cost"],
            selling_price=item["price"],
            reason="initial_catalog_setup"
        )
        db.add(ph)

    db.flush()

    # 5. Opening Inventory
    initial_purchase = Purchase(
        store_id=store.store_id,
        supplier_id=1,
        date=start_date,
        status="received",
        total=0.0
    )
    db.add(initial_purchase)
    db.flush()

    total_init_cost = 0.0
    for sku, prod in product_objs.items():
        init_qty = float(random.randint(30, 80))
        prod.stock_qty = init_qty
        
        pline = PurchaseLine(
            purchase_id=initial_purchase.purchase_id,
            product_id=prod.product_id,
            qty=init_qty,
            received_qty=init_qty,
            unit_cost=prod.cost_price
        )
        db.add(pline)
        total_init_cost += init_qty * prod.cost_price

        sm = StockMovement(
            store_id=store.store_id,
            product_id=prod.product_id,
            timestamp=start_date,
            movement_type="purchase",
            qty_delta=init_qty,
            reference_id=f"INIT-{initial_purchase.purchase_id}",
            reason="Opening stock intake"
        )
        db.add(sm)

    initial_purchase.total = total_init_cost
    db.flush()

    # 6. Simulate 9 Months of Daily Transactions
    current_date = start_date + timedelta(days=1)
    ramadan_start = datetime(2026, 3, 15, tzinfo=timezone.utc)
    ramadan_end = datetime(2026, 4, 14, tzinfo=timezone.utc)
    eid_window = (datetime(2026, 4, 15, tzinfo=timezone.utc), datetime(2026, 4, 18, tzinfo=timezone.utc))

    daily_sales_skus = list(product_objs.values())
    customer_balances = {c.customer_id: 0.0 for c in customer_objs}
    
    # Fast moving items that appear frequently in Pakistani grocery baskets
    fast_moving_skus = {"OIL-001", "GRN-001", "GRN-003", "TEA-001", "DRY-001", "DRY-014", "CLN-001", "BSK-001"}
    dead_stock_sku = "CLN-012"
    
    # Exclude dead stock from general sampling pool
    general_pool = [p for p in daily_sales_skus if p.sku != dead_stock_sku]
    fast_pool = [p for p in daily_sales_skus if p.sku in fast_moving_skus]

    day_idx = 0
    while current_date < end_date:
        is_friday = (current_date.weekday() == 4)
        is_sunday = (current_date.weekday() == 6)
        is_ramadan = (ramadan_start <= current_date <= ramadan_end)
        is_eid = (eid_window[0] <= current_date <= eid_window[1])

        # Realistic transactions per day: 15 to 25
        daily_tx_count = random.randint(15, 25)
        if is_ramadan:
            daily_tx_count = int(daily_tx_count * 1.35)
        elif is_eid:
            daily_tx_count = int(daily_tx_count * 1.5)
        elif is_friday or is_sunday:
            daily_tx_count = int(daily_tx_count * 1.2)

        for _ in range(daily_tx_count):
            tx_hour = random.choice([9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21])
            tx_minute = random.randint(0, 59)
            tx_time = current_date.replace(hour=tx_hour, minute=tx_minute)

            is_credit = (random.random() < 0.20)
            assigned_customer = random.choice(customer_objs) if is_credit else None

            num_lines = random.choices([1, 2, 3], weights=[0.45, 0.40, 0.15])[0]
            
            # High probability of including a fast-moving item in each transaction
            sampled_prods = []
            if random.random() < 0.65:
                sampled_prods.append(random.choice(fast_pool))
            
            remaining_slots = num_lines - len(sampled_prods)
            if remaining_slots > 0:
                sampled_prods.extend(random.sample(general_pool, remaining_slots))
            
            # Ensure unique in line items
            sampled_prods = list({p.product_id: p for p in sampled_prods}.values())

            sale = Sale(
                store_id=store.store_id,
                timestamp=tx_time,
                customer_id=assigned_customer.customer_id if assigned_customer else None,
                payment_type="udhaar" if is_credit else "cash",
                status="completed",
                total=0.0,
                discount=0.0
            )
            db.add(sale)

            sale_total = 0.0
            for sprod in sampled_prods:
                if sprod.category in ("Grains & Pulses", "Cooking Oil & Ghee"):
                    qty = float(random.choices([1, 2], weights=[0.75, 0.25])[0])
                else:
                    qty = float(random.choices([1, 2, 3], weights=[0.8, 0.15, 0.05])[0])

                if is_ramadan and any(k in sprod.name for k in ("Rooh Afza", "Besan", "Tang", "Oil")):
                    qty *= 1.5

                sprod.stock_qty = max(0.0, sprod.stock_qty - qty)
                line_total = qty * sprod.selling_price
                sale_total += line_total

                sline = SaleLine(
                    sale=sale,
                    product_id=sprod.product_id,
                    qty=qty,
                    unit_price=sprod.selling_price,
                    unit_cost_snapshot=sprod.cost_price,
                    discount=0.0
                )
                db.add(sline)

                sm = StockMovement(
                    store_id=store.store_id,
                    product_id=sprod.product_id,
                    timestamp=tx_time,
                    movement_type="sale",
                    qty_delta=-qty,
                    reference_id="SALE",
                    reason="Customer sale"
                )
                db.add(sm)

            sale.total = sale_total

            if is_credit and assigned_customer:
                due_dt = tx_time + timedelta(days=settings.DEFAULT_CREDIT_TERM_DAYS)
                le = LedgerEntry(
                    store_id=store.store_id,
                    customer_id=assigned_customer.customer_id,
                    timestamp=tx_time,
                    debit=sale_total,
                    credit=0.0,
                    due_date=due_dt,
                    reference=f"SALE-TX",
                    description=f"Grocery credit purchase"
                )
                db.add(le)
                customer_balances[assigned_customer.customer_id] += sale_total

        # Wasooli / partial repayments
        if day_idx % 4 == 0:
            repaying_cust = random.choice(customer_objs)
            curr_bal = customer_balances[repaying_cust.customer_id]
            if curr_bal > 1500.0:
                payment_amt = round(random.uniform(500.0, min(curr_bal, 6000.0)), -1)
                le_pay = LedgerEntry(
                    store_id=store.store_id,
                    customer_id=repaying_cust.customer_id,
                    timestamp=current_date.replace(hour=17, minute=30),
                    debit=0.0,
                    credit=payment_amt,
                    due_date=None,
                    reference=f"PAY-{day_idx}",
                    description="Cash repayment (wasooli)"
                )
                db.add(le_pay)
                customer_balances[repaying_cust.customer_id] -= payment_amt

        # Restocks on Mondays
        if current_date.weekday() == 0:
            low_stock_items = [p for p in daily_sales_skus if p.stock_qty < 20.0]
            if low_stock_items:
                sup_items = {}
                for p in low_stock_items:
                    sup_items.setdefault(p.supplier_id, []).append(p)

                for sup_id, prods in sup_items.items():
                    restock_purchase = Purchase(
                        store_id=store.store_id,
                        supplier_id=sup_id,
                        date=current_date.replace(hour=11, minute=0),
                        status="received",
                        total=0.0
                    )
                    db.add(restock_purchase)

                    purchase_sum = 0.0
                    for p in prods:
                        reorder_packs = random.randint(2, 4)
                        pack_units = 12
                        if p.pack:
                            pack_units = p.pack.units_per_pack
                        added_units = float(reorder_packs * pack_units)
                        p.stock_qty += added_units
                        cost = added_units * p.cost_price
                        purchase_sum += cost

                        pline = PurchaseLine(
                            purchase=restock_purchase,
                            product_id=p.product_id,
                            qty=added_units,
                            received_qty=added_units,
                            unit_cost=p.cost_price
                        )
                        db.add(pline)

                        sm_p = StockMovement(
                            store_id=store.store_id,
                            product_id=p.product_id,
                            timestamp=current_date.replace(hour=11, minute=0),
                            movement_type="purchase",
                            qty_delta=added_units,
                            reference_id="RESTOCK",
                            reason="Supplier stock restock"
                        )
                        db.add(sm_p)

                    restock_purchase.total = purchase_sum

                    sup_entry = SupplierLedgerEntry(
                        store_id=store.store_id,
                        supplier_id=sup_id,
                        timestamp=current_date.replace(hour=11, minute=0),
                        debit=0.0,
                        credit=purchase_sum,
                        due_date=current_date + timedelta(days=supplier_map[sup_id].payment_terms_days),
                        reference="PO-RESTOCK",
                        description=f"Supplier stock invoice"
                    )
                    db.add(sup_entry)

                    # Store clears 80% of older payables
                    if day_idx > 14 and random.random() < 0.80:
                        sup_pay = SupplierLedgerEntry(
                            store_id=store.store_id,
                            supplier_id=sup_id,
                            timestamp=current_date + timedelta(days=supplier_map[sup_id].payment_terms_days),
                            debit=purchase_sum,
                            credit=0.0,
                            due_date=None,
                            reference=f"PAY-SUP-{sup_id}",
                            description="Payment cleared to distributor"
                        )
                        db.add(sup_pay)

        # Monthly Expenses (1st of each month)
        if current_date.day == 1:
            month_date = current_date.replace(hour=10, minute=0)
            db.add(Expense(store_id=store.store_id, date=month_date, category="rent", amount=45000.0, description="Shop monthly rent"))
            db.add(Expense(store_id=store.store_id, date=month_date, category="salaries", amount=50000.0, description="2 sales boys salaries"))
            db.add(Expense(store_id=store.store_id, date=month_date, category="transport", amount=8500.0, description="Mandi goods carriage"))
            elec_bill = 48000.0 if current_date.month in (6, 7, 8, 9) else 24000.0
            db.add(Expense(store_id=store.store_id, date=month_date, category="electricity", amount=elec_bill, description="WAPDA / IESCO electricity bill"))
            db.add(Expense(store_id=store.store_id, date=month_date, category="generator", amount=14000.0, description="Load-shedding generator petrol"))

        # Commit every 14 days to keep memory small and transaction batches fast
        if day_idx % 14 == 0:
            db.flush()

        current_date += timedelta(days=1)
        day_idx += 1

    db.flush()

    # -------------------------------------------------------------
    # 7. INJECT CURATED HACKATHON DEMO SCENARIOS
    # -------------------------------------------------------------
    
    # Scenario 1 (Impending Stockout): Dalda Cooking Oil 1L Pouch (OIL-001)
    oil_prod = product_objs["OIL-001"]
    oil_stock_delta = 8.0 - oil_prod.stock_qty
    oil_prod.stock_qty = 8.0
    db.add(StockMovement(
        store_id=store.store_id,
        product_id=oil_prod.product_id,
        timestamp=end_date - timedelta(hours=2),
        movement_type="adjustment",
        qty_delta=oil_stock_delta,
        reference_id="SCENARIO-1-STOCKOUT",
        reason="Demo Calibration: Cooking oil impending stockout scenario"
    ))

    # Scenario 2 (Margin Squeeze): Sufi Canola Cooking Oil 1L Pouch (OIL-004)
    sufi_oil = product_objs["OIL-004"]
    cost_hike_date = end_date - timedelta(days=14)
    sufi_oil.cost_price = 540.0
    sufi_oil.selling_price = 560.0
    db.add(PriceHistory(
        product_id=sufi_oil.product_id,
        effective_date=cost_hike_date,
        cost_price=540.0,
        selling_price=560.0,
        reason="Distributor price revision (wholesale price hike PKR +60)"
    ))

    # Scenario 3 (Dead Stock): Sparkle Lemon Floor Cleaner 1L (CLN-012)
    dead_stock_prod = product_objs["CLN-012"]
    dead_delta = 18.0 - dead_stock_prod.stock_qty
    dead_stock_prod.stock_qty = 18.0
    db.add(StockMovement(
        store_id=store.store_id,
        product_id=dead_stock_prod.product_id,
        timestamp=end_date - timedelta(days=45),
        movement_type="adjustment",
        qty_delta=dead_delta,
        reference_id="SCENARIO-3-DEADSTOCK",
        reason="Demo Calibration: Dead stock product intake"
    ))

    # Scenario 4 (Overdue Khata Customer): Tariq Bhai (Customer 1)
    tariq = customer_objs[0]
    tariq_sale_date = datetime(2026, 10, 8, 18, 0, tzinfo=timezone.utc)
    tariq_due_date = tariq_sale_date + timedelta(days=30)
    db.add(LedgerEntry(
        store_id=store.store_id,
        customer_id=tariq.customer_id,
        timestamp=tariq_sale_date,
        debit=14200.0,
        credit=0.0,
        due_date=tariq_due_date,
        reference="SCENARIO-4-UDHAAR",
        description="Monthly household grocery bill on credit"
    ))
    tariq.safe_mark_score = 42.0

    # Scenario 5 (Supplier Payable Upcoming): Metro / Dalda Wholesale
    db.add(SupplierLedgerEntry(
        store_id=store.store_id,
        supplier_id=1,
        timestamp=end_date - timedelta(days=4),
        debit=0.0,
        credit=45000.0,
        due_date=end_date + timedelta(days=3),
        reference="SCENARIO-5-PAYABLE",
        description="Bulk Ghee & Cooking Oil carton shipment due payment"
    ))

    db.commit()
    return store
