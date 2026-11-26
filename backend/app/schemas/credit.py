from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class AgingBucket(BaseModel):
    current_0_30_days_pkr: float
    overdue_31_60_days_pkr: float
    overdue_61_plus_days_pkr: float
    total_outstanding_pkr: float

class CustomerKhataItem(BaseModel):
    customer_id: int
    name: str
    phone: Optional[str]
    total_balance_pkr: float
    overdue_amount_pkr: float
    days_overdue: int
    credit_limit_pkr: float
    safe_mark_score: float  # 0 to 100 Safe Mark rating
    risk_level: str         # low, medium, high (safe mark flag)
    last_payment_date: Optional[datetime]

class CreditSummaryResponse(BaseModel):
    store_id: int
    as_of: datetime
    aging: AgingBucket
    total_customers_with_balance: int
    total_overdue_customers: int
    top_defaulters: List[CustomerKhataItem]
    customers: List[CustomerKhataItem]
    data_label: str = "Demo Data"

class SupplierPayableItem(BaseModel):
    supplier_id: int
    name: str
    total_payable_pkr: float
    due_within_7d_pkr: float
    overdue_pkr: float
    payment_terms_days: int

class PayablesSummaryResponse(BaseModel):
    store_id: int
    as_of: datetime
    total_payables_pkr: float
    due_next_7_days_pkr: float
    suppliers: List[SupplierPayableItem]
    data_label: str = "Demo Data"
