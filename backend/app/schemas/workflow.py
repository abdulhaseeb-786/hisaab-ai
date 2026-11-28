from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.common import DataLabelled
from app.schemas.credit import MessageDraft, PaymentMethod
from app.schemas.reorder import ReorderPlanResponse


# ---- Orders ----------------------------------------------------------------

class SafeBudget(BaseModel):
    safe_to_order_pkr: float
    cash_in_hand_pkr: float
    bill_due_date: date = Field(description="When a new order's bill would be due: delivery + credit days.")
    lowest_cash_pkr: float = Field(description="Lowest expected cash in the week after the bill is due.")
    lowest_cash_date: date
    safety_cash_pkr: float
    orders_on_the_way_pkr: float
    explanation: list[str]
    explanation_ur: list[str]


class SupplierOverview(BaseModel):
    supplier_id: int
    name: str
    contact: Optional[str]
    payment_terms_days: int
    visit_days: list[int] = Field(description="0 = Monday ... 6 = Sunday")
    visit_days_label: str
    visit_days_label_ur: str
    visits_today: bool
    next_visit_in_days: Optional[int]
    products: int
    total_payable_pkr: float
    overdue_pkr: float
    due_within_7_days_pkr: float
    pending_orders_count: int
    pending_orders_value_pkr: float
    budget: SafeBudget = Field(description="The most the galla can bear for an order from this distributor.")
    usual_order_pkr: float = Field(description="Average bill per order from them in the last 90 days.")
    suggested_budget_pkr: float = Field(description="The galla limit, capped at 1.5x the usual order.")


class SuppliersResponse(DataLabelled):
    as_of: datetime
    budget: SafeBudget
    suppliers: list[SupplierOverview]


class OrderSuggestRequest(BaseModel):
    supplier_id: int
    budget_pkr: float = Field(gt=0, le=10_000_000)


class OrderSuggestResponse(ReorderPlanResponse):
    supplier_id: int
    supplier_name: str


class OrderLineIn(BaseModel):
    product_id: int
    packs: float = Field(ge=0, le=10_000)


class OrderCreateRequest(BaseModel):
    supplier_id: int
    lines: list[OrderLineIn] = Field(min_length=1, max_length=100)


class OrderLine(BaseModel):
    product_id: int
    name: str
    unit: str
    pack_unit: str
    units_per_pack: int
    packs: float
    qty: float
    received_qty: float
    unit_cost: float
    line_total: float


class Order(BaseModel):
    purchase_id: int
    supplier_id: int
    supplier_name: str
    status: Literal["pending", "received", "cancelled"]
    ordered_at: datetime
    expected_date: Optional[datetime]
    received_date: Optional[datetime]
    bill_number: Optional[str]
    total_pkr: float
    lines: list[OrderLine]


class OrderCreated(Order):
    draft: MessageDraft


class ReceiveLineIn(BaseModel):
    product_id: int
    received_qty: float = Field(ge=0, le=100_000)
    unit_cost: float = Field(ge=0, le=1_000_000, description="Price per unit on the distributor's bill.")


class ReceiveRequest(BaseModel):
    lines: list[ReceiveLineIn] = Field(default_factory=list, max_length=100)
    bill_number: Optional[str] = Field(default=None, max_length=40)
    pay_now_pkr: float = Field(default=0, ge=0, le=10_000_000)
    method: PaymentMethod = "cash"


class PriceChange(BaseModel):
    product_id: int
    name: str
    unit: str
    old_cost: float
    new_cost: float
    change_pct: float
    selling_price: float
    old_margin_pct: float
    new_margin_pct: float
    price_to_keep_margin: float


class ShortItem(BaseModel):
    product_id: int
    name: str
    ordered_qty: float
    received_qty: float
    unit: str


class ReceiveResponse(BaseModel):
    order: Order
    bill_total_pkr: float
    paid_now_pkr: float
    left_to_pay_pkr: float
    due_date: datetime
    price_changes: list[PriceChange]
    short_items: list[ShortItem]


class SupplierPaymentRequest(BaseModel):
    supplier_id: int
    amount: float = Field(gt=0, le=10_000_000)
    method: PaymentMethod = "cash"
    note: Optional[str] = Field(default=None, max_length=120)


class SupplierPaymentResponse(BaseModel):
    supplier_id: int
    supplier_name: str
    amount_paid_pkr: float
    method: PaymentMethod
    previous_payable_pkr: float
    remaining_payable_pkr: float
    cash_in_drawer_pkr: float


# ---- Ginti (stock count) -----------------------------------------------------

class CategoryCount(BaseModel):
    category: str
    items: int


class CountSheetItem(BaseModel):
    product_id: int
    name: str
    category: str
    unit: str
    image_url: str
    expected_qty: float
    cost_price: float
    selling_price: float
    last_counted_at: Optional[datetime]
    last_counted_qty: Optional[float]


class CountSheetResponse(BaseModel):
    categories: list[CategoryCount]
    category: Optional[str]
    items: list[CountSheetItem]


class CountLineIn(BaseModel):
    product_id: int
    counted_qty: float = Field(ge=0, le=1_000_000)


class CountRequest(BaseModel):
    lines: list[CountLineIn] = Field(min_length=1, max_length=500)
    treat_short_as: Literal["loss", "sales"] = Field(
        default="loss", description="'sales' books a shortfall as cash sales not written down.")
    note: Optional[str] = Field(default=None, max_length=200)


class CountResultLine(BaseModel):
    product_id: int
    name: str
    unit: str
    expected_qty: float
    counted_qty: float
    difference_qty: float
    difference_value_pkr: float
    last_counted_at: Optional[datetime]
    recorded_sales_since_last_count: Optional[float]
    sold_since_last_count: Optional[float] = Field(description="From the counts: last count + received - this count.")


class CountResponse(BaseModel):
    count_id: int
    timestamp: datetime
    treat_short_as: Literal["loss", "sales"]
    items_counted: int
    items_matched: int
    items_short: int
    items_extra: int
    short_value_at_cost_pkr: float
    short_value_at_price_pkr: float
    extra_value_at_cost_pkr: float
    inferred_sale_id: Optional[int]
    inferred_sales_pkr: float
    lines: list[CountResultLine]


class CountHistoryItem(BaseModel):
    count_id: int
    timestamp: datetime
    note: Optional[str]
    items_counted: int
    items_matched: int
    short_value_at_cost_pkr: float
    extra_value_at_cost_pkr: float


# ---- Business report ---------------------------------------------------------

class ReportStore(BaseModel):
    name: str
    location: Optional[str]
    owner_name: Optional[str]
    records_since: Optional[date]
    days_of_records: int


class ReportMonth(BaseModel):
    month: str
    start: date
    is_partial: bool
    days_trading: int
    revenue_pkr: float
    gross_profit_pkr: float
    gross_margin_pct: float
    operating_expenses_pkr: float
    net_profit_pkr: float
    cash_sales_pct: float
    average_daily_sales_pkr: float
    bills: int


class ReportSummary(BaseModel):
    average_monthly_sales_pkr: float
    average_monthly_net_profit_pkr: float
    average_gross_margin_pct: float
    sales_trend_3m_pct: Optional[float]
    profitable_months: int
    full_months: int


class ReportPosition(BaseModel):
    cash_in_hand_pkr: float
    stock_value_at_cost_pkr: float
    customer_credit_outstanding_pkr: float
    supplier_bills_outstanding_pkr: float
    working_capital_pkr: float


class ReportCredit(BaseModel):
    outstanding_pkr: float
    overdue_pkr: float
    overdue_pct: float
    customers_with_balance: int
    given_90d_pkr: float
    collected_90d_pkr: float
    collection_ratio_pct: Optional[float]


class ReportSuppliers(BaseModel):
    outstanding_pkr: float
    overdue_pkr: float
    billed_90d_pkr: float
    paid_90d_pkr: float
    average_monthly_purchases_pkr: float


class ReportRecords(BaseModel):
    days_closed_last_30: int
    days_galla_matched: int
    galla_difference_30d_pkr: float


class BusinessReportResponse(DataLabelled):
    generated_at: datetime
    store: ReportStore
    months: list[ReportMonth]
    summary: ReportSummary
    position: ReportPosition
    credit: ReportCredit
    suppliers: ReportSuppliers
    record_keeping: ReportRecords
    strengths: list[str]
    cautions: list[str]
    method_notes: list[str]
