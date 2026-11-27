import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import HisaabAPI from '../services/api';
import confetti from 'canvas-confetti';
import { 
  ShoppingCart, 
  Sparkles, 
  DollarSign, 
  TrendingUp, 
  ShieldCheck, 
  AlertCircle, 
  Send, 
  Copy, 
  Check, 
  Package, 
  Calculator,
  RefreshCw,
  Clock,
  ArrowRight
} from 'lucide-react';

export function HeroReorderBar({ initialBudget = 50000, onSelectProduct }) {
  const { t, language } = useLanguage();
  const [budget, setBudget] = useState(initialBudget);
  const [targetCoverDays, setTargetCoverDays] = useState(14);
  const [loading, setLoading] = useState(false);
  const [planData, setPlanData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const fetchPlan = async (budgetValue, coverDays) => {
    try {
      setLoading(true);
      setError(null);
      const res = await HisaabAPI.generateReorderPlan(budgetValue, coverDays);
      setPlanData(res);
    } catch (err) {
      console.error('Failed to generate reorder plan:', err);
      setError('Could not calculate plan. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan(budget, targetCoverDays);
  }, [budget, targetCoverDays]);

  const presetBudgets = [25000, 50000, 75000, 100000];

  const handlePresetClick = (amount) => {
    setBudget(amount);
  };

  const handleCopyPo = () => {
    if (!planData || !planData.recommendations) return;

    let poText = `*HISAAB AI — PURCHASE ORDER (PO)*\n`;
    poText += `Dukaan: Al-Madina General Store, Sector G-9, Islamabad\n`;
    poText += `Date: ${new Date().toLocaleDateString('en-PK')}\n`;
    poText += `Budget Allocated: PKR ${planData.total_allocated_spend_pkr?.toLocaleString()}\n`;
    poText += `------------------------------------\n`;
    planData.recommendations.forEach((item, idx) => {
      poText += `${idx + 1}. *${item.name}*\n`;
      poText += `   Order: ${item.pack_breakdown?.packs_to_order || item.recommended_units} ${item.pack_breakdown?.pack_unit || 'Units'} (${item.recommended_units} retail units)\n`;
      poText += `   Supplier: ${item.supplier_name || 'Wholesaler'}\n`;
      poText += `   Cost: PKR ${item.allocated_cost_pkr?.toLocaleString()}\n`;
    });
    poText += `------------------------------------\n`;
    poText += `*Total Order Value: PKR ${planData.total_allocated_spend_pkr?.toLocaleString()}*\n`;
    poText += `*Expected Delivery: Today / Tomorrow Morning*\n`;
    poText += `Sent via HisaabAI Retail Decision Support`;

    navigator.clipboard.writeText(poText);
    setCopied(true);
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
    setTimeout(() => setCopied(false), 2500);
  };

  const allocated = planData?.total_allocated_spend_pkr || 0;
  const unspent = planData?.unspent_budget_pkr || Math.max(0, budget - allocated);
  const percentUsed = budget > 0 ? Math.min(100, Math.round((allocated / budget) * 100)) : 0;

  return (
    <div className="w-full space-y-6">
      {/* Hero Header Card */}
      <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/40 border border-emerald-500/30 shadow-2xl overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  CYE 2026 Hero Flow
                </span>
                <span className="flex items-center gap-1 text-xs text-amber-400 font-semibold">
                  <ShieldCheck className="w-4 h-4" /> Knapsack Budget Cap Strictly Enforced
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
                {t('hero_title')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-3xl mt-1 leading-relaxed">
                {t('hero_subtitle')}
              </p>
            </div>

            {/* Target Cover Days Selector */}
            <div className="flex items-center gap-2 bg-slate-950/70 p-1.5 rounded-2xl border border-slate-800 self-start lg:self-center">
              <span className="text-xs font-bold text-slate-400 px-2 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Target Cover:
              </span>
              {[7, 14, 21].map(days => (
                <button
                  key={days}
                  onClick={() => setTargetCoverDays(days)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                    targetCoverDays === days
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {days} Days
                </button>
              ))}
            </div>
          </div>

          {/* Budget Input & Preset Pills */}
          <div className="bg-slate-950/80 rounded-2xl p-4 sm:p-5 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="text-xs sm:text-sm font-bold text-slate-300 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-emerald-400" />
                {t('budget_label')}
              </label>

              {/* Preset buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {presetBudgets.map(amount => (
                  <button
                    key={amount}
                    onClick={() => handlePresetClick(amount)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                      budget === amount
                        ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    PKR {amount.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input Field */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-extrabold text-emerald-400 text-lg">
                PKR
              </span>
              <input
                type="number"
                min="1000"
                step="1000"
                value={budget}
                onChange={(e) => setBudget(parseFloat(e.target.value) || 0)}
                placeholder="Enter reorder budget (e.g. 50000)"
                className="w-full pl-16 pr-32 py-3.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-white font-extrabold text-xl outline-none transition"
              />
              <button
                onClick={() => fetchPlan(budget, targetCoverDays)}
                disabled={loading}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Optimize</span>
              </button>
            </div>

            {/* Animated Progress Bar */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Allocated: PKR {allocated.toLocaleString()} ({percentUsed}%)
                </span>
                <span className="text-amber-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  Cash Reserve Kept: PKR {unspent.toLocaleString()}
                </span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex p-0.5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentUsed}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                ></motion.div>
              </div>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Spend
              </span>
              <span className="text-lg sm:text-xl font-extrabold text-emerald-400 mt-1 block">
                PKR {allocated.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-500 block">Strictly ≤ Budget Cap</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Projected Sales
              </span>
              <span className="text-lg sm:text-xl font-extrabold text-white mt-1 block">
                PKR {(planData?.projected_revenue_pkr || 0).toLocaleString()}
              </span>
              <span className="text-[10px] text-emerald-400 block font-semibold">+14 Days Demand</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Projected Profit
              </span>
              <span className="text-lg sm:text-xl font-extrabold text-emerald-300 mt-1 block">
                +PKR {(planData?.projected_margin_pkr || 0).toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400 block font-semibold">
                Margin: {planData?.projected_revenue_pkr ? Math.round(((planData.projected_margin_pkr || 0) / planData.projected_revenue_pkr) * 100) : 0}%
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Items Protected
              </span>
              <span className="text-lg sm:text-xl font-extrabold text-amber-400 mt-1 block">
                {planData?.recommendations?.length || 0} SKUs
              </span>
              <span className="text-[10px] text-slate-400 block">0 Stockouts Expected</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recommended Order Table */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 overflow-hidden shadow-xl">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-white text-base sm:text-lg flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-400" />
              Optimal Wholesale Order Breakdown
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Wholesale pack sizes (cartons/bori/crates) rounded down to prevent cash overflow.
            </p>
          </div>

          {/* WhatsApp Export Button */}
          <button
            onClick={handleCopyPo}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-950/40 transition active:scale-95 shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>PO Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy WhatsApp PO</span>
              </>
            )}
          </button>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Item & SKU</th>
                <th className="py-3 px-3">Wholesale Pack To Order</th>
                <th className="py-3 px-3">Supplier</th>
                <th className="py-3 px-3">Wholesale Cost</th>
                <th className="py-3 px-3">Total Spend</th>
                <th className="py-3 px-3">Cover Days</th>
                <th className="py-3 px-3 text-right">Projected Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {planData?.recommendations && planData.recommendations.length > 0 ? (
                planData.recommendations.map((rec) => (
                  <tr 
                    key={rec.product_id}
                    className="hover:bg-slate-800/40 transition cursor-pointer"
                    onClick={() => onSelectProduct && onSelectProduct(rec.product_id)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white text-sm hover:text-emerald-400 transition">
                        {rec.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {rec.sku} • {rec.category}
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-extrabold text-xs">
                        <span>
                          {rec.pack_breakdown?.packs_to_order || rec.recommended_units}{' '}
                          {rec.pack_breakdown?.pack_unit || 'Units'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        ({rec.recommended_units} retail {rec.pack_breakdown?.sell_unit || 'units'})
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-slate-300 font-medium">
                      {rec.supplier_name || 'Al-Fateh Wholesalers'}
                    </td>

                    <td className="py-3.5 px-3 text-slate-300">
                      PKR {rec.unit_cost_price?.toLocaleString()}
                    </td>

                    <td className="py-3.5 px-3 font-bold text-white">
                      PKR {rec.allocated_cost_pkr?.toLocaleString()}
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-slate-500">{rec.days_of_cover_before}d</span>
                        <ArrowRight className="w-3 h-3 text-emerald-400" />
                        <span className="font-bold text-emerald-400">{rec.days_of_cover_after}d</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-right font-extrabold text-emerald-400">
                      +PKR {rec.projected_profit_pkr?.toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    {loading ? 'Optimizing wholesale order...' : 'No items allocated for this budget. Try entering a higher amount.'}
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

export default HeroReorderBar;
