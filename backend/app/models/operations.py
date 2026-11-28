"""The shop's daily operations: opening and closing the day, galla differences, stock counts."""

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class DaySession(Base):
    """One business day: when the shop opened and closed, and the galla counted each time.

    `*_expected` is what the records say should be in the drawer; `*_counted` is what the
    shopkeeper actually counted. Any difference is booked as a CashAdjustment so the cash
    book always matches the real drawer.
    """

    __tablename__ = "day_sessions"

    session_id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=False, index=True)
    business_date = Column(Date, nullable=False, index=True)
    opened_at = Column(DateTime, nullable=False)
    opening_expected = Column(Float, nullable=False)
    opening_counted = Column(Float, nullable=False)
    closed_at = Column(DateTime, nullable=True)
    closing_expected = Column(Float, nullable=True)
    closing_counted = Column(Float, nullable=True)
    note = Column(String(200), nullable=True)


class CashAdjustment(Base):
    """Cash found extra (+) or short (−) when the galla was counted."""

    __tablename__ = "cash_adjustments"

    adjustment_id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    amount = Column(Float, nullable=False)
    reason = Column(String(200), nullable=True)
    session_id = Column(Integer, ForeignKey("day_sessions.session_id"), nullable=True)


class StockCount(Base):
    """A shelf count (ginti): the shopkeeper counts what is really on the shelf."""

    __tablename__ = "stock_counts"

    count_id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    note = Column(String(200), nullable=True)
    lines = relationship("StockCountLine", back_populates="count", cascade="all, delete-orphan")


class StockCountLine(Base):
    __tablename__ = "stock_count_lines"

    line_id = Column(Integer, primary_key=True, autoincrement=True)
    count_id = Column(Integer, ForeignKey("stock_counts.count_id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False, index=True)
    expected_qty = Column(Float, nullable=False)
    counted_qty = Column(Float, nullable=False)
    unit_cost = Column(Float, nullable=False)
    count = relationship("StockCount", back_populates="lines")
