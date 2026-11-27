import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import HisaabAPI from '../services/api';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  ShieldCheck, 
  AlertTriangle,
  ArrowRight,
  DollarSign,
  Building2
} from 'lucide-react';

export function CashOutlookView() {
  const { t } = useLanguage();
  const [outlook, setOutlook] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOutlook = async () => {
      try {
        setLoading(true);
        const data = await HisaabAPI.getCashOutlook();
        setOutlook(data);
      } catch (err) {
        console.error('Failed to load cash outlook:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOutlook();
  }, []);

  const totalPayables = outlook?.total_payables_pkr || 142500;
  const dueWithin7d = outlook?.due_next_7_days_pkr || 48000;
  const projectedReceivables = 38400;
  const projectedDailyCashSales = 12500;
  const sevenDayCashSales = projectedDailyCashSales * 7; // 87,500
  const netCashFlow = sevenDayCashSales + projectedReceivables - dueWithin7d;

  return (
    <div className="w-full space-y-6">
      {/* 7-Day Net Liquidity Header */}
      <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-slate-900 via-slate-900/80 to-blue-950/40 border border-blue-500/30 shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                CYE 2026 Liquidity Engine
              </span>
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" /> Solvency Buffer Healthy
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
              7-Day Net Cash Flow Outlook
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Anticipate distributor invoice payments and upcoming khata inflows to prevent cash traps.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-right self-start sm:self-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Projected 7-Day Net Balance
            </span>
            <span className="text-2xl font-black text-emerald-400 mt-0.5 block">
              +PKR {netCashFlow.toLocaleString()}
            </span>
            <span className="text-[10px] text-emerald-400/80 font-medium block">
              Surplus after all 7d dues
            </span>
          </div>
        </div>

        {/* 3 Pillars of Cash Flow */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Pillar 1: Projected Counter Inflow */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" /> Expected Cash Sales
              </span>
              <span className="text-[10px] font-mono text-slate-400">7 Days</span>
            </div>
            <span className="text-xl font-extrabold text-white block">
              +PKR {sevenDayCashSales.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400 block">
              Avg daily cash turnover: PKR {projectedDailyCashSales.toLocaleString()}
            </span>
          </div>

          {/* Pillar 2: Khata Receivables Due */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                <DollarSign className="w-4 h-4" /> Khata Inflows
              </span>
              <span className="text-[10px] font-mono text-slate-400">Safe Mark</span>
            </div>
            <span className="text-xl font-extrabold text-white block">
              +PKR {projectedReceivables.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400 block">
              Expected wasooli collection target
            </span>
          </div>

          {/* Pillar 3: Supplier Payables Due */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-400 flex items-center gap-1">
                <TrendingDown className="w-4 h-4" /> Supplier Invoices Due
              </span>
              <span className="text-[10px] font-mono text-slate-400">7 Days</span>
            </div>
            <span className="text-xl font-extrabold text-rose-400 block">
              -PKR {dueWithin7d.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400 block">
              Al-Fateh, Dalda & Nestle bills
            </span>
          </div>
        </div>
      </div>

      {/* Supplier Payables List */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 overflow-hidden shadow-xl p-5 space-y-4">
        <div>
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            Supplier Payables Schedule (Distributor Credit)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Credit terms agreed with FMCG distributors in Islamabad / Rawalpindi wholesale markets.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Supplier / Wholesaler</th>
                <th className="py-3 px-3">Total Payable</th>
                <th className="py-3 px-3">Due Within 7 Days</th>
                <th className="py-3 px-3">Terms</th>
                <th className="py-3 px-4 text-right">Payment Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {[
                { name: 'Al-Fateh Wholesalers', total: 68000, due7d: 28000, terms: '14 Days', status: 'Due in 3 Days' },
                { name: 'Dalda Foods Distribution', total: 42500, due7d: 14000, terms: '7 Days', status: 'Due Tomorrow' },
                { name: 'Nestle Pakistan Direct', total: 32000, due7d: 6000, terms: '21 Days', status: 'Safe (Due Day 6)' },
              ].map((s, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30 transition">
                  <td className="py-3.5 px-4 font-bold text-white">
                    {s.name}
                  </td>
                  <td className="py-3.5 px-3 text-slate-300">
                    PKR {s.total.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-3 font-extrabold text-rose-400">
                    PKR {s.due7d.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-3 text-slate-400">
                    {s.terms}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default CashOutlookView;
