from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base

class Store(Base):
    __tablename__ = "stores"

    store_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(120), nullable=False)
    timezone = Column(String(50), default="Asia/Karachi")
    currency = Column(String(10), default="PKR")
    default_credit_term_days = Column(Integer, default=30)
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
