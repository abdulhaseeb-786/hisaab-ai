from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class Expense(Base):
    __tablename__ = "expenses"

    expense_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=False, index=True)
    date = Column(DateTime, nullable=False, index=True)
    category = Column(String(60), nullable=False)  # rent, electricity, salaries, transport, general
    amount = Column(Float, nullable=False)
    description = Column(String(250), nullable=True)

    store = relationship("Store", back_populates="expenses")

class Insight(Base):
    __tablename__ = "insights"

    insight_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=False, index=True)
    type = Column(String(40), nullable=False, index=True)  # margin_squeeze, stockout_risk, dead_stock, credit_risk
    severity = Column(String(20), default="medium")        # high, medium, low
    title = Column(String(200), nullable=False)
    evidence_json = Column(Text, nullable=False)           # JSON string with metrics
    recommendation = Column(Text, nullable=False)          # Actionable next step
    status = Column(String(20), default="active")          # active, dismissed, actioned
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    store = relationship("Store", back_populates="insights")

class Forecast(Base):
    __tablename__ = "forecasts"

    forecast_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False, index=True)
    generated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    horizon_date = Column(DateTime, nullable=False, index=True)
    forecast_qty = Column(Float, nullable=False)
    model_name = Column(String(50), default="baseline_moving_avg")
    quality_metrics_json = Column(Text, nullable=True)  # WAPE, MAE, sample points

    product = relationship("Product", back_populates="forecasts")

class PurchasePlan(Base):
    __tablename__ = "purchase_plans"

    plan_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    budget = Column(Float, nullable=False)
    status = Column(String(30), default="draft")  # draft, approved, archived
    total_estimated_cost = Column(Float, nullable=False, default=0.0)

    store = relationship("Store", back_populates="purchase_plans")
    lines = relationship("PurchasePlanLine", back_populates="plan", cascade="all, delete-orphan")

class PurchasePlanLine(Base):
    __tablename__ = "purchase_plan_lines"

    plan_line_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    plan_id = Column(Integer, ForeignKey("purchase_plans.plan_id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.supplier_id"), nullable=True)
    pack_unit = Column(String(40), default="carton")
    recommended_packs = Column(Integer, nullable=False)
    units_per_pack = Column(Integer, nullable=False)
    total_units = Column(Float, nullable=False)
    estimated_unit_cost = Column(Float, nullable=False)
    total_cost = Column(Float, nullable=False)
    urgency_score = Column(Float, default=0.0)
    rationale = Column(String(300), nullable=True)

    plan = relationship("PurchasePlan", back_populates="lines")
