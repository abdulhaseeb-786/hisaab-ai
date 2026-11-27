from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Supplier(Base):
    __tablename__ = "suppliers"

    supplier_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=False, index=True)
    name = Column(String(120), nullable=False, index=True)
    contact = Column(String(60), nullable=True)
    payment_terms_days = Column(Integer, default=7)  # standard Pakistani weekly distributor cycle

    store = relationship("Store", back_populates="suppliers")
    products = relationship("Product", back_populates="supplier")
    purchases = relationship("Purchase", back_populates="supplier")
    supplier_products = relationship("SupplierProduct", back_populates="supplier", cascade="all, delete-orphan")
    ledger_entries = relationship("SupplierLedgerEntry", back_populates="supplier", cascade="all, delete-orphan")

class SupplierProduct(Base):
    __tablename__ = "supplier_products"

    supplier_product_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.supplier_id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False, index=True)
    unit_cost = Column(Float, nullable=False)
    lead_time_days = Column(Integer, default=3)
    moq = Column(Integer, default=1)  # minimum order quantity in packs
    pack_size = Column(Integer, default=12)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    supplier = relationship("Supplier", back_populates="supplier_products")

class Purchase(Base):
    __tablename__ = "purchases"

    purchase_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=False, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.supplier_id"), nullable=False, index=True)
    date = Column(DateTime, nullable=False, index=True)
    status = Column(String(30), default="received")  # pending, received, cancelled
    expected_date = Column(DateTime, nullable=True)  # when a pending order should arrive
    received_date = Column(DateTime, nullable=True)
    total = Column(Float, nullable=False, default=0.0)

    store = relationship("Store", back_populates="purchases")
    supplier = relationship("Supplier", back_populates="purchases")
    lines = relationship("PurchaseLine", back_populates="purchase", cascade="all, delete-orphan")

class PurchaseLine(Base):
    __tablename__ = "purchase_lines"

    purchase_line_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    purchase_id = Column(Integer, ForeignKey("purchases.purchase_id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False, index=True)
    qty = Column(Float, nullable=False)           # ordered quantity
    received_qty = Column(Float, nullable=False)  # pending = qty - received_qty
    unit_cost = Column(Float, nullable=False)

    purchase = relationship("Purchase", back_populates="lines")
    product = relationship("Product", back_populates="purchase_lines")
