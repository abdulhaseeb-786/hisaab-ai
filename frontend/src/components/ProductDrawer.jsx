import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import HisaabAPI from '../services/api';
import confetti from 'canvas-confetti';
import { 
  X, 
  TrendingUp, 
  AlertTriangle, 
  DollarSign, 
  Package, 
  Check, 
  Clock, 
  Truck, 
  Calendar, 
  Activity,
  Layers,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export function ProductDrawer({ productId, onClose, onDataUpdated }) {
  const [product, setProduct] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Price adjust form state
  const [newPrice, setNewPrice] = useState('');
  const [updatingPrice, setUpdatingPrice] = useState(false);
  const [priceSuccess, setPriceSuccess] = useState(false);

  // Stock adjustment form state
  const [stockAdd, setStockAdd] = useState('');
  const [adjustingStock, setAdjustingStock] = useState(false);
  const [stockSuccess, setStockSuccess] = useState(false);

  const loadProductData = async () => {
    if (!productId) return;
    try {
      setLoading(true);
      const [prodRes, foreRes] = await Promise.all([
        HisaabAPI.getProductDetail(productId),
        HisaabAPI.getForecast(productId, 7),
      ]);
      setProduct(prodRes);
      setForecast(foreRes);
      setNewPrice(prodRes.selling_price);
    } catch (err) {
      console.error('Failed to load product detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProductData();
  }, [productId]);

  const handlePriceUpdate = async (e) => {
    e.preventDefault();
    if (!newPrice || parseFloat(newPrice) <= 0) return;
    try {
      setUpdatingPrice(true);
      await HisaabAPI.updateProductPrice(productId, newPrice, 'Merchant price margin adjustment');
      setPriceSuccess(true);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.5 } });
      await loadProductData();
      if (onDataUpdated) onDataUpdated();
      setTimeout(() => setPriceSuccess(false), 2000);
    } catch (err) {
      console.error('Price update failed:', err);
    } finally {
      setUpdatingPrice(false);
    }
  };

  const handleStockAdjustment = async (e) => {
    e.preventDefault();
    if (!stockAdd || parseFloat(stockAdd) <= 0) return;
    try {
      setAdjustingStock(true);
      await HisaabAPI.adjustStock(productId, stockAdd, 'Received stock shipment at counter');
      setStockSuccess(true);
      setStockAdd('');
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.5 } });
      await loadProductData();
      if (onDataUpdated) onDataUpdated();
      setTimeout(() => setStockSuccess(false), 2000);
    } catch (err) {
      console.error('Stock adjustment failed:', err);
    } finally {
      setAdjustingStock(false);
    }
  };

  if (!productId) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex justify-end">
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 220 }}
          className="w-full max-w-xl h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between overflow-y-auto"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/90 backdrop-blur-md z-10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-white text-lg">
                  {product ? product.name : 'Loading SKU Intelligence...'}
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  {product?.sku} • {product?.category}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 space-y-6 flex-1">
            {loading ? (
              <div className="py-20 text-center text-slate-400">
                Loading SKU telemetry, demand forecast, and price history...
              </div>
            ) : product ? (
              <>
                {/* Real-time KPI Tiles */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Stock On Hand
                    </span>
                    <span className="text-lg font-black text-white mt-0.5 block">
                      {product.stock_qty} {product.unit}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-semibold block">
                      Reorder Pt: {product.reorder_point}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Stock Cover Days
                    </span>
                    <span className={`text-lg font-black mt-0.5 block ${
                      product.stockout_risk === 'critical' ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      {product.days_of_cover} Days
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Lead Time: {product.lead_time_days}d
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Gross Margin
                    </span>
                    <span className="text-lg font-black text-white mt-0.5 block">
                      {Math.round(((product.selling_price - product.cost_price) / product.selling_price) * 100)}%
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Cost: PKR {product.cost_price}
                    </span>
                  </div>
                </div>

                {/* 7-Day ML Demand Forecast Chart */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-white text-sm flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        7-Day Demand Forecast (ML Horizon)
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Historical trend & moving average demand projection.
                      </p>
                    </div>

                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                      Model: {forecast?.model_used || 'Moving Avg 7D'}
                    </span>
                  </div>

                  {/* Visual SVG Micro Bar Chart for 7 Days */}
                  <div className="pt-2">
                    <div className="h-28 flex items-end justify-between gap-2 px-2 border-b border-slate-800 pb-2">
                      {forecast?.forecast_days ? (
                        forecast.forecast_days.map((day, idx) => {
                          const heightPct = Math.min(100, Math.max(20, (day.projected_qty / 10) * 100));
                          return (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                              <span className="text-[10px] font-bold text-emerald-400">
                                {day.projected_qty}
                              </span>
                              <div
                                style={{ height: `${heightPct}%` }}
                                className="w-full bg-gradient-to-t from-emerald-600 to-teal-400 rounded-t-lg transition-all"
                              ></div>
                              <span className="text-[9px] font-mono text-slate-500">
                                {day.day_label || `D+${idx + 1}`}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-xs text-slate-500 w-full text-center py-6">
                          Daily forecast projection ready.
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2">
                      <span>Total 7-Day Demand: <strong className="text-white">{forecast?.total_horizon_demand || 38} {product.unit}</strong></span>
                      <span className="text-emerald-400 font-semibold">Stockout Risk: {product.stockout_risk.toUpperCase()}</span>
                    </div>
                  </div>
                </div>

                {/* Price History & Margin Squeeze Detection */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <h4 className="font-extrabold text-white text-sm flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    Supplier Price History & Margin Tracking
                  </h4>

                  <div className="space-y-2">
                    {product.recent_price_changes && product.recent_price_changes.length > 0 ? (
                      product.recent_price_changes.map((ph, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                        >
                          <div>
                            <span className="font-bold text-white block">
                              Cost: PKR {ph.cost_price} → Retail: PKR {ph.selling_price}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {ph.reason}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">
                            {new Date(ph.effective_date).toLocaleDateString()}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-500 py-2">
                        No recent wholesale price hikes recorded.
                      </div>
                    )}
                  </div>
                </div>

                {/* Live Action 1: Dynamic Price Update */}
                <form
                  onSubmit={handlePriceUpdate}
                  className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-white flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                      Adjust Retail Selling Price
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Current: PKR {product.selling_price}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        PKR
                      </span>
                      <input
                        type="number"
                        step="1"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        className="w-full pl-12 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-sm outline-none focus:border-emerald-500"
                        placeholder="New price"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={updatingPrice}
                      className="px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1 shrink-0"
                    >
                      {priceSuccess ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-white" />
                          <span>Updated!</span>
                        </>
                      ) : (
                        <span>Save Price</span>
                      )}
                    </button>
                  </div>
                </form>

                {/* Live Action 2: Record Stock Received */}
                <form
                  onSubmit={handleStockAdjustment}
                  className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-white flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5 text-cyan-400" />
                      Record Stock Delivery / Receipt
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Wholesale Pack: {product.pack_info ? `${product.pack_info.pack_unit} (${product.pack_info.units_per_pack}x)` : 'Units'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="1"
                      value={stockAdd}
                      onChange={(e) => setStockAdd(e.target.value)}
                      placeholder={`Add quantity (${product.unit})...`}
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-sm outline-none focus:border-cyan-500"
                    />
                    <button
                      type="submit"
                      disabled={adjustingStock}
                      className="px-4 py-2 rounded-xl text-xs font-extrabold bg-cyan-600 hover:bg-cyan-500 text-white transition flex items-center gap-1 shrink-0"
                    >
                      {stockSuccess ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-white" />
                          <span>Restocked!</span>
                        </>
                      ) : (
                        <span>Add Stock</span>
                      )}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-center text-rose-400 py-10">
                Product details could not be loaded.
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default ProductDrawer;
