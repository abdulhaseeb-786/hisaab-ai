from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Customer(Base):
    __tablename__ = "customers"

    customer_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=False, index=True)
    name = Column(String(120), nullable=False, index=True)
    phone = Column(String(30), nullable=True)
    credit_limit = Column(Float, default=15000.0)  # how much udhaar the shop allows
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    store = relationship("Store", back_populates="customers")
    sales = relationship("Sale", back_populates="customer")
    ledger_entries = relationship("LedgerEntry", back_populates="customer", cascade="all, delete-orphan")

class LedgerEntry(Base):
    """Customer Khata ledger for credit/udhaar sales and repayments."""
    __tablename__ = "customer_ledger_entries"

    entry_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    debit = Column(Float, default=0.0)   # Amount owed (purchase on credit)
    credit = Column(Float, default=0.0)  # Amount paid back (wasooli)
    due_date = Column(DateTime, nullable=True, index=True)
    reference = Column(String(80), nullable=True)
    description = Column(String(200), nullable=True)

    customer = relationship("Customer", back_populates="ledger_entries")

class SupplierLedgerEntry(Base):
    """Supplier / Distributor ledger for stock on credit and payables."""
    __tablename__ = "supplier_ledger_entries"

    entry_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=False, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.supplier_id"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    debit = Column(Float, default=0.0)   # Payment made to supplier
    credit = Column(Float, default=0.0)  # Stock received on credit
    due_date = Column(DateTime, nullable=True, index=True)
    reference = Column(String(80), nullable=True)
    description = Column(String(200), nullable=True)

    supplier = relationship("Supplier", back_populates="ledger_entries")
