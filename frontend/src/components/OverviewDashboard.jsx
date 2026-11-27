import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { 
  TrendingUp, 
  AlertTriangle, 
  Sparkles, 
  Users, 
  ArrowRight, 
  DollarSign, 
  Clock, 
  ShoppingCart, 
  ShieldCheck, 
  CheckCircle2,
  ChevronRight
} from 'lucide-react';

export function OverviewDashboard({
  dashboardData = {},
  todayActions = [],
  onOpenReorderFlow,
  onOpenComboModal,
  onOpenWasooliModal,
  onOpenProductDrawer,
  onOpenMartWalk,
  onOpenCopilot,
}) {
  const { t } = useLanguage();

  const handleActionClick = (action) => {
    if (action.action_type === 'reorder') {
      onOpenReorderFlow();
    } else if (action.action_type === 'combo') {
      onOpenComboModal(action);
    } else if (action.action_type === 'wasooli') {
      onOpenWasooliModal(action);
    } else if (action.product_id) {
      onOpenProductDrawer(action.product_id);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Pakistani Shopkeeper Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/60 p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 relative z-10">
          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Al-Madina Store Digital Twin
              </span>
              <span className="text-xs text-slate-400">• Sector G-9, Islamabad</span>
            </div>
            
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Dukaan Ka Munafa Barhein,{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                Nuqsan Bachayein
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              HisaabAI gives you instant clarity on daily retail stock, margin squeezes, and customer khata wasooli.
              Explore the store in interactive 2.5D or optimize your inventory with one click.
            </p>

            <div className="flex items-center gap-3 pt-1 flex-wrap">
              <button
                onClick={onOpenMartWalk}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-extrabold text-xs sm:text-sm text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 transition shadow-lg shadow-emerald-500/20 transform hover:scale-[1.02]"
              >
                <span>Visit 2.5D Mart Walkthrough</span>
                <ArrowRight className="w-4 h-4 text-slate-950" />
              </button>

              <button
                onClick={onOpenReorderFlow}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs sm:text-sm text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition"
              >
                <ShoppingCart className="w-4 h-4 text-emerald-400" />
                <span>Reorder Hero (PKR 50k)</span>
              </button>
            </div>
          </div>

          {/* Shopkeeper 3D Visual Card */}
          <div className="relative w-full max-w-sm aspect-[4/3] rounded-2xl overflow-hidden border border-emerald-500/30 shadow-2xl">
            <img
              src="/src/assets/shopkeeper-hero.jpg"
              alt="Shopkeeper Al-Madina Store"
              className="w-full h-full object-cover transform hover:scale-105 transition duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
            <div className="absolute bottom-3 left-3 right-3 p-2.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-white/10 flex items-center justify-between text-xs">
              <div>
                <span className="font-extrabold text-white block">Tariq Mehmood</span>
                <span className="text-[10px] text-emerald-400 font-medium">Verified Merchant • Safe Mark 92</span>
              </div>
              <button
                onClick={onOpenCopilot}
                className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-amber-500 text-slate-950 hover:bg-amber-400 transition"
              >
                Ask Copilot
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Today's 3 Urgent Actions (The Core Decision Engine) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
              {t('today_actions_title')}
            </h2>
            <p className="text-xs text-slate-400">
              Deterministic priority actions computed by the Al-Madina retail analytics engine.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {todayActions && todayActions.length > 0 ? (
            todayActions.map((action, idx) => {
              const isStockout = action.action_type === 'reorder';
              const isCombo = action.action_type === 'combo';
              const isWasooli = action.action_type === 'wasooli';

              return (
                <motion.div
                  key={idx}
                  whileHover={{ y: -3 }}
                  className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
                    isStockout
                      ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50'
                      : isCombo
                      ? 'bg-purple-950/20 border-purple-500/30 hover:border-purple-500/50'
                      : 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                        isStockout
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : isCombo
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        Action #{idx + 1} • {action.urgency || 'High Priority'}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        {action.metric_highlight}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-extrabold text-white text-base">
                        {action.title}
                      </h3>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                        {action.description}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleActionClick(action)}
                    className={`mt-4 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-extrabold transition shadow-md ${
                      isStockout
                        ? 'bg-rose-600 hover:bg-rose-500 text-white'
                        : isCombo
                        ? 'bg-purple-600 hover:bg-purple-500 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    <span>{action.cta_label || 'Take Action'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              );
            })
          ) : (
            <div className="col-span-3 p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400">
              Loading today's actions from Al-Madina database...
            </div>
          )}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            30-Day Sales Revenue
          </span>
          <span className="text-xl sm:text-2xl font-black text-white mt-1 block">
            PKR {(dashboardData.revenue_pkr || 284500).toLocaleString()}
          </span>
          <span className="text-[11px] text-emerald-400 font-semibold mt-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> +14.2% vs last month
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Gross Profit Margin
          </span>
          <span className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 block">
            {dashboardData.gross_margin_pct || 18.6}%
          </span>
          <span className="text-[11px] text-slate-400 font-medium mt-1 block">
            Net: PKR {(dashboardData.gross_margin_pkr || 52900).toLocaleString()}
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Overdue Khata (Safe Mark)
          </span>
          <span className="text-xl sm:text-2xl font-black text-rose-400 mt-1 block">
            PKR {(dashboardData.total_overdue_khata_pkr || 38400).toLocaleString()}
          </span>
          <span className="text-[11px] text-rose-400 font-semibold mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> 4 Overdue Customers
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Dead Stock Value
          </span>
          <span className="text-xl sm:text-2xl font-black text-purple-400 mt-1 block">
            PKR {(dashboardData.dead_stock_value_pkr || 18200).toLocaleString()}
          </span>
          <span className="text-[11px] text-purple-300 font-medium mt-1 block">
            Tied in 65 inactive units
          </span>
        </div>
      </div>
    </div>
  );
}

export default OverviewDashboard;
