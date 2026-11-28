from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.workflow import (
    BusinessReportResponse, CountHistoryItem, CountRequest, CountResponse, CountSheetResponse, Order, OrderCreated,
    OrderCreateRequest, OrderSuggestRequest, OrderSuggestResponse, ReceiveRequest, ReceiveResponse,
    SupplierPaymentRequest, SupplierPaymentResponse, SuppliersResponse,
)
from app.services import orders, report, stock_count

router = APIRouter()


def _run(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except (orders.OrderError, stock_count.CountError, ValueError) as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


# ---- Order booker ------------------------------------------------------------

@router.get("/orders/suppliers", response_model=SuppliersResponse, tags=["Orders"])
def get_suppliers(store_id: int = 1, db: Session = Depends(get_db)):
    """Distributors with their route days, what is owed, and how much the shop can safely order."""
    return orders.list_suppliers(db, store_id=store_id)


@router.post("/orders/suggest", response_model=OrderSuggestResponse, tags=["Orders"])
def suggest(payload: OrderSuggestRequest, store_id: int = 1, db: Session = Depends(get_db)):
    """What to order from this distributor within the budget, in whole packs, with reasons."""
    return _run(orders.suggest_order, db, payload.supplier_id, payload.budget_pkr, store_id=store_id)


@router.post("/orders", response_model=OrderCreated, status_code=201, tags=["Orders"])
def create(payload: OrderCreateRequest, store_id: int = 1, db: Session = Depends(get_db)):
    """Save the order given to the booker. Returns the order text to show on screen; nothing is sent."""
    return _run(orders.create_order, db, payload.supplier_id, [l.model_dump() for l in payload.lines], store_id=store_id)


@router.get("/orders", response_model=list[Order], tags=["Orders"])
def list_orders(status: Optional[Literal["pending", "received", "cancelled"]] = "pending",
                supplier_id: Optional[int] = None, limit: int = Query(default=30, ge=1, le=100),
                store_id: int = 1, db: Session = Depends(get_db)):
    return orders.list_orders(db, status=status, supplier_id=supplier_id, store_id=store_id, limit=limit)


@router.post("/orders/{purchase_id}/receive", response_model=ReceiveResponse, tags=["Orders"])
def receive(purchase_id: int, payload: ReceiveRequest, store_id: int = 1, db: Session = Depends(get_db)):
    """Maal aaya: stock in at the bill price, a supplier bill created, price changes flagged."""
    return _run(orders.receive_order, db, purchase_id, [l.model_dump() for l in payload.lines], payload.bill_number,
                payload.pay_now_pkr, payload.method, store_id=store_id)


@router.post("/payables/pay", response_model=SupplierPaymentResponse, tags=["Supplier Payables & Cash"])
def pay(payload: SupplierPaymentRequest, store_id: int = 1, db: Session = Depends(get_db)):
    """Pay a distributor. Clears the oldest bills first. Cash payments come out of the galla."""
    return _run(orders.pay_supplier, db, payload.supplier_id, payload.amount, payload.method, payload.note, store_id=store_id)


# ---- Ginti ---------------------------------------------------------------------

@router.get("/stock-count/sheet", response_model=CountSheetResponse, tags=["Stock count"])
def sheet(category: Optional[str] = Query(default=None, max_length=80), store_id: int = 1, db: Session = Depends(get_db)):
    """The counting sheet for one shelf (category): what the records expect on it."""
    return stock_count.count_sheet(db, category=category, store_id=store_id)


@router.post("/stock-count", response_model=CountResponse, status_code=201, tags=["Stock count"])
def submit(payload: CountRequest, store_id: int = 1, db: Session = Depends(get_db)):
    """Save a count. Stock is set to what was counted; a shortfall is booked as loss or as unrecorded sales."""
    return _run(stock_count.submit_count, db, [l.model_dump() for l in payload.lines], payload.treat_short_as,
                payload.note, store_id=store_id)


@router.get("/stock-count/history", response_model=list[CountHistoryItem], tags=["Stock count"])
def history(limit: int = Query(default=10, ge=1, le=50), store_id: int = 1, db: Session = Depends(get_db)):
    return stock_count.count_history(db, store_id=store_id, limit=limit)


# ---- Report ----------------------------------------------------------------------

@router.get("/reports/business", response_model=BusinessReportResponse, tags=["Reports"])
def business(store_id: int = 1, db: Session = Depends(get_db)):
    """Six months of sales, profit after costs, credit, supplier bills and record keeping, for a lender."""
    return report.business_report(db, store_id=store_id)
