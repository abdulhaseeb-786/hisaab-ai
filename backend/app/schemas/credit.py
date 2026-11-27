from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.common import DataLabelled


class AgingBuckets(BaseModel):
    not_due_pkr: float
    overdue_1_30_days_pkr: float
    overdue_31_60_days_pkr: float
    overdue_61_plus_days_pkr: float
    total_outstanding_pkr: float
    total_overdue_pkr: float


class CustomerAging(BaseModel):
    not_due: float
    overdue_1_30: float
    overdue_31_60: float
    overdue_61_plus: float


class ScoreFactor(BaseModel):
    reason: str
    points: float


class CustomerKhataItem(BaseModel):
    customer_id: int
    name: str
    phone: Optional[str]
    total_balance_pkr: float
    overdue_amount_pkr: float
    days_overdue: int
    credit_limit_pkr: float
    over_limit: bool
    safe_mark_score: float = Field(description="0-100. Starts at 100; each lost point has a listed reason.")
    score_factors: list[ScoreFactor]
    risk_level: Literal["low", "medium", "high"]
    last_payment_date: Optional[datetime]
    days_since_last_payment: Optional[int]
    last_purchase_date: Optional[datetime]
    aging: CustomerAging


class CreditSummaryResponse(DataLabelled):
    store_id: int
    as_of: datetime
    default_credit_term_days: int
    aging: AgingBuckets
    total_customers_with_balance: int
    total_overdue_customers: int
    top_defaulters: list[CustomerKhataItem]
    customers: list[CustomerKhataItem]


class LedgerLine(BaseModel):
    entry_id: int
    timestamp: datetime
    kind: Literal["purchase", "payment"]
    amount_pkr: float
    due_date: Optional[datetime]
    description: Optional[str]
    running_balance_pkr: float


class CustomerLedgerResponse(DataLabelled):
    customer_id: int
    name: str
    phone: Optional[str]
    credit_limit_pkr: float
    summary: Optional[CustomerKhataItem]
    entries: list[LedgerLine]
    total_entries: int


class PaymentRecordRequest(BaseModel):
    customer_id: int
    amount: float = Field(gt=0, le=10_000_000)
    notes: str = Field(default="Counter wasooli", max_length=200)


class PaymentRecordResponse(BaseModel):
    customer_id: int
    name: str
    amount_received: float
    previous_balance: float
    new_balance: float
    message: str


class OpenInvoice(BaseModel):
    reference: Optional[str]
    invoice_date: datetime
    due_date: datetime
    invoice_amount_pkr: float
    open_amount_pkr: float
    is_overdue: bool
    days_overdue: int


class SupplierPayableItem(BaseModel):
    supplier_id: int
    name: str
    contact: Optional[str]
    payment_terms_days: int
    total_payable_pkr: float
    overdue_pkr: float
    due_within_horizon_pkr: float
    next_due_date: Optional[datetime]
    open_invoices: list[OpenInvoice]
    pending_orders_count: int
    pending_orders_value_pkr: float
    next_delivery_date: Optional[datetime]


class PayablesSummaryResponse(DataLabelled):
    store_id: int
    as_of: datetime
    horizon_days: int
    total_payables_pkr: float
    overdue_pkr: float
    due_within_horizon_pkr: float
    pending_orders_value_pkr: float
    suppliers: list[SupplierPayableItem]


class CashPosition(BaseModel):
    as_of: datetime
    opening_cash_pkr: float
    opening_cash_date: datetime
    cash_sales_pkr: float
    wasooli_pkr: float
    supplier_payments_pkr: float
    expenses_pkr: float
    cash_in_hand_pkr: float


class CashInflows(BaseModel):
    cash_sales_pkr: float
    debt_collections_wasooli_pkr: float
    total_inflows_pkr: float


class CashOutflows(BaseModel):
    supplier_payables_due_pkr: float
    operating_expenses_pkr: float
    total_outflows_pkr: float


class PlannedSupplierPayment(BaseModel):
    supplier_id: int
    supplier_name: str
    reference: Optional[str]
    amount_pkr: float
    was_overdue: bool


class PlannedExpense(BaseModel):
    category: str
    label: str
    amount_pkr: float


class CashDay(BaseModel):
    date: date
    opening_cash_pkr: float
    cash_sales_in_pkr: float
    wasooli_in_pkr: float
    supplier_payments_out_pkr: float
    expenses_out_pkr: float
    closing_cash_pkr: float
    supplier_payments: list[PlannedSupplierPayment]
    expenses: list[PlannedExpense]


class ExpenseRule(BaseModel):
    category: str
    rule: Literal["daily", "weekly", "monthly"]
    amount: float
    weekday: Optional[int] = None
    day_of_month: Optional[int] = None


class CashOutlookResponse(DataLabelled):
    store_id: int
    as_of: datetime
    horizon_days: int
    opening_cash_pkr: float
    cash_position: CashPosition
    projected_inflows: CashInflows
    projected_outflows: CashOutflows
    projected_closing_cash_pkr: float
    lowest_cash_pkr: float
    lowest_cash_date: date
    safety_cash_pkr: float
    shortfall_warning: bool
    shortfall_date: Optional[date]
    shortfall_risk_pkr: float
    days: list[CashDay]
    expense_schedule: list[ExpenseRule]
    assumptions: list[str]
