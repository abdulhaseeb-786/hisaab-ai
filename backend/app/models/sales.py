from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Sale(Base):
    __tablename__ = "sales"

    sale_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id"), nullable=True, index=True)
    payment_type = Column(String(20), default="cash")  # cash, udhaar
    status = Column(String(20), default="completed")   # completed, returned, cancelled
    total = Column(Float, nullable=False, default=0.0)
    discount = Column(Float, default=0.0)

    store = relationship("Store", back_populates="sales")
    customer = relationship("Customer", back_populates="sales")
    lines = relationship("SaleLine", back_populates="sale", cascade="all, delete-orphan")

class SaleLine(Base):
    __tablename__ = "sale_lines"

    sale_line_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sale_id = Column(Integer, ForeignKey("sales.sale_id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False, index=True)
    qty = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=False)
    unit_cost_snapshot = Column(Float, nullable=False)  # exact cost at time of sale
    discount = Column(Float, default=0.0)

    sale = relationship("Sale", back_populates="lines")
    product = relationship("Product", back_populates="sale_lines")

class StockMovement(Base):
    __tablename__ = "stock_movements"

    movement_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    movement_type = Column(String(30), nullable=False)  # sale, purchase, adjustment, waste
    qty_delta = Column(Float, nullable=False)  # negative for sales, positive for purchases
    reference_id = Column(String(60), nullable=True)
    reason = Column(String(150), nullable=True)

    product = relationship("Product", back_populates="stock_movements")
