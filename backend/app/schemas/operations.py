from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class DayFigures(BaseModel):
    bills: int = Field(description="Number of sales (cash and udhaar).")
    sales_pkr: float
    cash_sales_pkr: float
    udhaar_given_pkr: float
    wasooli_cash_pkr: float
    wasooli_digital_pkr: float = Field(description="Easypaisa, JazzCash and bank. Not in the galla.")
    supplier_payments_pkr: float = Field(description="Paid to distributors in cash from the galla.")
    expenses_pkr: float = Field(description="Running costs: rent, bijli, salaries, transport, general.")
    withdrawals_pkr: float = Field(description="Money taken home or deposited in the bank. Not a cost.")
    gross_profit_pkr: float = Field(description="Sales minus the cost of the items sold.")


class DaySessionOut(BaseModel):
    session_id: int
    business_date: date
    opened_at: datetime
    opening_expected_pkr: float
    opening_counted_pkr: float
    closed_at: Optional[datetime]
    closing_expected_pkr: Optional[float]
    closing_counted_pkr: Optional[float]
    closing_difference_pkr: Optional[float]
    note: Optional[str]


class DayStatusResponse(BaseModel):
    state: Literal["not_opened", "open", "closed"]
    business_date: date
    now: datetime
    session: Optional[DaySessionOut]
    cash_in_drawer_expected_pkr: float
    today: DayFigures
    since_open_start: datetime
    yesterday: Optional[DaySessionOut]


class DayOpenResponse(DayStatusResponse):
    difference_pkr: float


class CashCountRequest(BaseModel):
    counted_cash: float = Field(ge=0, le=100_000_000)
    note: Optional[str] = Field(default=None, max_length=200)


class SupplierAmount(BaseModel):
    supplier_id: int
    supplier_name: str
    amount_pkr: float


class SupplierRef(BaseModel):
    supplier_id: int
    supplier_name: str


class CustomerReminder(BaseModel):
    customer_id: int
    name: str
    overdue_pkr: float
    days_overdue: int


class TomorrowPlan(BaseModel):
    date: date
    weekday: str
    bills_due: list[SupplierAmount]
    bills_due_total_pkr: float
    distributor_visits: list[SupplierRef]
    customers_to_remind: list[CustomerReminder]
    items_running_low: int


class DayCloseResponse(BaseModel):
    session: DaySessionOut
    difference_pkr: float
    figures: DayFigures
    tomorrow: TomorrowPlan


class DayHistoryItem(DaySessionOut):
    figures: DayFigures


ExpenseCategory = Literal["rent", "electricity", "salaries", "transport", "general", "owner_drawings", "bank_deposit"]


class ExpenseRequest(BaseModel):
    category: ExpenseCategory
    amount: float = Field(gt=0, le=10_000_000)
    note: Optional[str] = Field(default=None, max_length=120)


class ExpenseResponse(BaseModel):
    expense_id: int
    category: ExpenseCategory
    amount_pkr: float
    note: Optional[str]
    cash_in_drawer_pkr: float
    method: Literal["cash"]
