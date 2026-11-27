import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { 
  Store, 
  RotateCcw, 
  Globe, 
  Bot, 
  Sparkles, 
  TrendingUp, 
  Layers, 
  AlertTriangle,
  ShoppingCart,
  Users,
  FileSpreadsheet,
  Wallet
} from 'lucide-react';
import confetti from 'canvas-confetti';

export function Navbar({ 
  activeTab, 
  setActiveTab, 
  onResetDemo, 
  onOpenCopilot,
  stats = {}
}) {
  const { language, toggleLanguage, t } = useLanguage();
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    try {
      setResetting(true);
      await onResetDemo();
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.1 }
      });
    } finally {
      setTimeout(() => setResetting(false), 800);
    }
  };

  const navItems = [
    { id: 'overview', label: t('tab_overview'), icon: TrendingUp },
    { id: 'mart_walk', label: t('tab_mart_walk'), icon: Store, badge: 'Interactive 3D' },
    { id: 'reorder', label: t('tab_reorder'), icon: ShoppingCart, badge: 'Hero Flow' },
    { id: 'products', label: t('tab_products'), icon: Layers },
    { id: 'khata', label: t('tab_khata'), icon: Users, alert: stats.overdueCustomers > 0 },
    { id: 'cashflow', label: t('tab_cashflow'), icon: Wallet },
    { id: 'csv', label: t('tab_csv'), icon: FileSpreadsheet },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      {/* Top micro bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-2 border-b border-slate-800/40 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-slate-200">{t('store_title')}</span>
            <span className="text-slate-500 hidden sm:inline">• {t('store_location')}</span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            {t('demo_badge')}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick stats pills */}
          {stats.criticalStockouts > 0 && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 font-medium">
              <AlertTriangle className="w-3 h-3 animate-pulse" />
              <span>{stats.criticalStockouts} Stockouts Imminent</span>
            </div>
          )}

          {/* Reset Demo Data Button */}
          <button
            onClick={handleReset}
            disabled={resetting}
            title="Reset store database to Seed 42 baseline"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin text-emerald-400' : ''}`} />
            <span className="hidden sm:inline">Reset Demo</span>
          </button>

          {/* Language Toggle */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{language === 'roman_urdu' ? 'اردو Roman' : 'English'}</span>
          </button>
        </div>
      </div>

      {/* Main navigation & Brand Bar */}
      <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-4 overflow-x-auto">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 shrink-0 cursor-pointer" onClick={() => setActiveTab('overview')}>
          <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-emerald-500/30 shadow-lg shadow-emerald-500/20 bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center">
            <img 
              src="/src/assets/logo-3d.jpg" 
              alt="HisaabAI" 
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/src/assets/logo-mark.svg';
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl tracking-tight text-white">Hisaab</span>
              <span className="font-black text-xl tracking-tight bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">AI</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">CYE 2026</span>
            </div>
            <p className="text-[10px] font-medium text-slate-400 -mt-0.5 hidden sm:block">
              {t('brand_tagline')}
            </p>
          </div>
        </div>

        {/* Tab Links */}
        <nav className="flex items-center gap-1.5 shrink-0 overflow-x-auto py-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                  isActive 
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30 font-bold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                    isActive ? 'bg-black/30 text-emerald-200' : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {item.badge}
                  </span>
                )}
                {item.alert && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Copilot Trigger Pill */}
        <button
          onClick={onOpenCopilot}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-lg shadow-amber-500/25 transition transform hover:scale-[1.02] active:scale-[0.98] shrink-0"
        >
          <Bot className="w-4 h-4 text-slate-950" />
          <span className="hidden sm:inline">Ask Copilot</span>
          <span className="sm:hidden">Copilot</span>
          <Sparkles className="w-3.5 h-3.5 text-slate-950 animate-bounce" />
        </button>
      </div>
    </header>
  );
}

export default Navbar;
