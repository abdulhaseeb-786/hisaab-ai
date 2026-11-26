"""7-Day Cash Flow Outlook & Supplier Payables.
Requirement CASH-01, CASH-02.
Calculates opening cash, expected cash sales, wasooli collections,
supplier payables due, and operating expenses.
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Supplier, SupplierLedgerEntry, Sale, LedgerEntry

def calculate_cash_outlook(db: Session, store_id: int = 1, days_ahead: int = 7) -> Dict[str, Any]:
    """Calculate 7-day cash projection with documented inflows and outflows."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    future_date = now + timedelta(days=days_ahead)

    # 1. Opening Cash in Drawer (Demo baseline)
    opening_cash = 25000.0

    # 2. Historical Daily Cash Sales (last 14 days average)
    fourteen_days_ago = now - timedelta(days=14)
    avg_cash_sales = (
        db.query(func.coalesce(func.sum(Sale.total), 0.0) / 14.0)
        .filter(Sale.store_id == store_id, Sale.payment_type == "cash", Sale.timestamp >= fourteen_days_ago)
        .scalar()
    ) or 0.0
    projected_cash_sales_7d = float(avg_cash_sales) * float(days_ahead)

    # 3. Projected Customer Debt Repayment (Wasooli collections: ~15% of overdue credit)
    from app.analytics.credit_aging import calculate_credit_summary
    credit_summary = calculate_credit_summary(db, store_id)
    overdue_total = (
        credit_summary["aging"]["overdue_31_60_days_pkr"] +
        credit_summary["aging"]["overdue_61_plus_days_pkr"]
    )
    expected_collections_7d = overdue_total * 0.15

    # 4. Supplier Payables Due in Next 7 Days
    suppliers = db.query(Supplier).filter(Supplier.store_id == store_id).all()
    supplier_items = []
    total_payables_due = 0.0

    for s in suppliers:
        entries = (
            db.query(SupplierLedgerEntry)
            .filter(SupplierLedgerEntry.supplier_id == s.supplier_id)
            .all()
        )
        total_cred = sum(e.credit for e in entries) # stock received
        total_deb = sum(e.debit for e in entries)   # payments made
        net_payable = max(0.0, total_cred - total_deb)

        # Due in next 7 days
        due_7d = sum(
            e.credit for e in entries
            if e.due_date and e.due_date <= future_date and e.credit > 0
        )
        due_7d_net = min(net_payable, due_7d)
        total_payables_due += due_7d_net

        if net_payable > 0:
            supplier_items.append({
                "supplier_id": s.supplier_id,
                "name": s.name,
                "total_payable_pkr": round(net_payable, 2),
                "due_within_7d_pkr": round(due_7d_net, 2),
                "overdue_pkr": 0.0,
                "payment_terms_days": s.payment_terms_days
            })

    # 5. Fixed Expenses for 7 Days (rent/electricity/staff pro-rated for 7 days)
    # Approx 140,000 / month = ~32,000 / week
    weekly_expenses = 32000.0

    total_inflows = projected_cash_sales_7d + expected_collections_7d
    total_outflows = total_payables_due + weekly_expenses
    projected_closing_cash = opening_cash + total_inflows - total_outflows

    shortfall_warning = projected_closing_cash < 10000.0

    return {
        "store_id": store_id,
        "as_of": now,
        "horizon_days": days_ahead,
        "opening_cash_pkr": round(opening_cash, 2),
        "projected_inflows": {
            "cash_sales_pkr": round(projected_cash_sales_7d, 2),
            "debt_collections_wasooli_pkr": round(expected_collections_7d, 2),
            "total_inflows_pkr": round(total_inflows, 2)
        },
        "projected_outflows": {
            "supplier_payables_due_pkr": round(total_payables_due, 2),
            "operating_expenses_pkr": round(weekly_expenses, 2),
            "total_outflows_pkr": round(total_outflows, 2)
        },
        "projected_closing_cash_pkr": round(projected_closing_cash, 2),
        "shortfall_warning": shortfall_warning,
        "shortfall_risk_pkr": round(abs(min(0.0, projected_closing_cash)), 2),
        "suppliers": supplier_items,
        "data_label": "Demo Data"
    }
