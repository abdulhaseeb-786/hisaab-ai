from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Float, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class Store(Base):
    __tablename__ = "stores"

    store_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(120), nullable=False)
    location = Column(String(160), nullable=True)
    owner_name = Column(String(120), nullable=True)
    timezone = Column(String(50), default="Asia/Karachi")
    currency = Column(String(10), default="PKR")
    default_credit_term_days = Column(Integer, default=30)
    # Cash in the drawer on `opening_cash_date`. Today's cash position is derived from
    # this plus every recorded cash movement since (see analytics/cash_book.py).
    opening_cash_pkr = Column(Float, nullable=False, default=0.0)
    opening_cash_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    products = relationship("Product", back_populates="store", cascade="all, delete-orphan")
    sales = relationship("Sale", back_populates="store", cascade="all, delete-orphan")
    purchases = relationship("Purchase", back_populates="store", cascade="all, delete-orphan")
    customers = relationship("Customer", back_populates="store", cascade="all, delete-orphan")
    suppliers = relationship("Supplier", back_populates="store", cascade="all, delete-orphan")
    expenses = relationship("Expense", back_populates="store", cascade="all, delete-orphan")
    insights = relationship("Insight", back_populates="store", cascade="all, delete-orphan")
    purchase_plans = relationship("PurchasePlan", back_populates="store", cascade="all, delete-orphan")


class AppMeta(Base):
    """Key/value facts about the database itself (schema version, when it was seeded)."""

    __tablename__ = "app_meta"

    key = Column(String(60), primary_key=True)
    value = Column(Text, nullable=False)
