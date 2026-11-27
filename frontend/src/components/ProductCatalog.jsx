import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import HisaabAPI from '../services/api';
import { 
  Search, 
  Filter, 
  Layers, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp, 
  Package, 
  ChevronRight,
  Sparkles,
  ArrowUpDown
} from 'lucide-react';

export function ProductCatalog({ onSelectProduct }) {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const categories = [
    { id: '', label: 'All Categories' },
    { id: 'Cooking Oil', label: 'Ghee & Oil' },
    { id: 'Flour', label: 'Atta & Grains' },
    { id: 'Dairy', label: 'Dairy & Eggs' },
    { id: 'Tea', label: 'Chai & Drinks' },
    { id: 'Detergents', label: 'Detergents' },
    { id: 'Spices', label: 'Spices & Masalas' },
  ];

  const statuses = [
    { id: 'all', label: 'All Stock' },
    { id: 'critical', label: 'Critical (< 4d)', color: 'text-rose-400' },
    { id: 'high', label: 'Low Stock (< 7d)', color: 'text-amber-400' },
    { id: 'safe', label: 'Safe Stock', color: 'text-emerald-400' },
  ];

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await HisaabAPI.getProducts({
        search,
        category: selectedCategory,
        status: selectedStatus,
      });
      setProducts(data);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, selectedCategory, selectedStatus]);

  return (
    <div className="w-full space-y-5">
      {/* Search & Filter Header */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              {t('catalog_title')}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live inventory tracking across Al-Madina Store's 120 Pakistani retail SKUs.
            </p>
          </div>

          <div className="text-xs text-slate-400 font-semibold">
            Showing <span className="text-emerald-400 font-extrabold">{products.length}</span> items
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search_placeholder')}
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-white text-sm outline-none transition"
          />
        </div>

        {/* Category & Status Filter Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Status Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {statuses.map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedStatus(st.id)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  selectedStatus === st.id
                    ? 'bg-slate-100 text-slate-950 font-black shadow-md'
                    : 'bg-slate-800/60 text-slate-400 hover:text-white'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Product Grid / Table */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4">{t('col_product')}</th>
                <th className="py-3.5 px-3">{t('col_category')}</th>
                <th className="py-3.5 px-3">{t('col_stock')}</th>
                <th className="py-3.5 px-3">{t('col_cover')}</th>
                <th className="py-3.5 px-3">{t('col_cost')}</th>
                <th className="py-3.5 px-3">{t('col_sale')}</th>
                <th className="py-3.5 px-3">{t('col_margin')}</th>
                <th className="py-3.5 px-4 text-right">{t('col_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    Loading Al-Madina inventory data...
                  </td>
                </tr>
              ) : products.length > 0 ? (
                products.map((p) => {
                  const isCritical = p.stockout_risk === 'critical';
                  const isHigh = p.stockout_risk === 'high';
                  const marginPct = p.selling_price > 0 
                    ? Math.round(((p.selling_price - p.cost_price) / p.selling_price) * 100) 
                    : 0;

                  return (
                    <tr
                      key={p.product_id}
                      onClick={() => onSelectProduct(p.product_id)}
                      className="hover:bg-slate-800/40 transition cursor-pointer group"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-sm group-hover:text-emerald-400 transition">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {p.sku} {p.pack_info ? `• ${p.pack_info.pack_unit} (${p.pack_info.units_per_pack}x)` : ''}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-slate-300 font-medium">
                        {p.category}
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="font-extrabold text-white">
                          {p.stock_qty} {p.unit}
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black ${
                            isCritical
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                              : isHigh
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {isCritical && <AlertTriangle className="w-3 h-3 text-rose-400" />}
                          {p.days_of_cover !== null ? `${p.days_of_cover}d` : 'N/A'}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-slate-400">
                        PKR {p.cost_price?.toLocaleString()}
                      </td>

                      <td className="py-3.5 px-3 font-bold text-white">
                        PKR {p.selling_price?.toLocaleString()}
                      </td>

                      <td className="py-3.5 px-3 font-extrabold">
                        <span className={marginPct < 10 ? 'text-rose-400' : 'text-emerald-400'}>
                          {marginPct}%
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectProduct(p.product_id);
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 group-hover:bg-emerald-600 text-slate-300 group-hover:text-white transition shadow-sm"
                        >
                          Intelligence & Forecast
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    No products matched your search or filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ProductCatalog;
