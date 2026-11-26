from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Product(Base):
    __tablename__ = "products"

    product_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=False, index=True)
    sku = Column(String(50), nullable=False, index=True)
    name = Column(String(150), nullable=False, index=True)
    category = Column(String(80), nullable=False, index=True)
    unit = Column(String(30), default="piece")  # piece, kg, litre, packet
    cost_price = Column(Float, nullable=False)
    selling_price = Column(Float, nullable=False)
    stock_qty = Column(Float, default=0.0)
    supplier_id = Column(Integer, ForeignKey("suppliers.supplier_id"), nullable=True)
    lead_time_days = Column(Integer, default=3)
    safety_stock_days = Column(Integer, default=2)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    store = relationship("Store", back_populates="products")
    supplier = relationship("Supplier", back_populates="products")
    pack = relationship("ProductPack", back_populates="product", uselist=False, cascade="all, delete-orphan")
    price_history = relationship("PriceHistory", back_populates="product", cascade="all, delete-orphan", order_by="desc(PriceHistory.effective_date)")
    sale_lines = relationship("SaleLine", back_populates="product")
    purchase_lines = relationship("PurchaseLine", back_populates="product")
    stock_movements = relationship("StockMovement", back_populates="product")
    forecasts = relationship("Forecast", back_populates="product")

class ProductPack(Base):
    __tablename__ = "product_packs"

    pack_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False, unique=True)
    pack_unit = Column(String(40), default="carton")  # carton, bori, crate, box, bundle
    units_per_pack = Column(Integer, nullable=False, default=12)
    sell_unit = Column(String(30), default="piece")   # piece, kg, litre, packet

    product = relationship("Product", back_populates="pack")

class PriceHistory(Base):
    __tablename__ = "price_history"

    history_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False, index=True)
    effective_date = Column(DateTime, nullable=False, index=True)
    cost_price = Column(Float, nullable=False)
    selling_price = Column(Float, nullable=False)
    reason = Column(String(120), default="routine_update")

    product = relationship("Product", back_populates="price_history")
