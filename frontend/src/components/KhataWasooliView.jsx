import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import HisaabAPI from '../services/api';
import { 
  Users, 
  Send, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  TrendingUp, 
  Clock, 
  MessageSquare,
  Search,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';

export function KhataWasooliView({ onOpenWasooliModal }) {
  const { t } = useLanguage();
  const [creditData, setCreditData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [payingCustomerId, setPayingCustomerId] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const fetchCreditSummary = async () => {
    try {
      setLoading(true);
      const data = await HisaabAPI.getCreditSummary();
      setCreditData(data);
    } catch (err) {
      console.error('Failed to load credit summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCreditSummary();
  }, []);

  const handleQuickPayment = async (customer) => {
    if (!payAmount || parseFloat(payAmount) <= 0) return;
    try {
      setSubmittingPayment(true);
      await HisaabAPI.recordPayment(customer.customer_id, payAmount, 'Counter cash wasooli');
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      setPayingCustomerId(null);
      setPayAmount('');
      await fetchCreditSummary();
    } catch (err) {
      console.error('Failed to record payment:', err);
    } finally {
      setSubmittingPayment(false);
    }
  };

  const aging = creditData?.aging || {
    current_0_30_days_pkr: 0,
    overdue_31_60_days_pkr: 0,
    overdue_61_plus_days_pkr: 0,
    total_outstanding_pkr: 0,
  };

  const customers = (creditData?.customers || []).filter(c => 
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone && c.phone.includes(search))
  );

  return (
    <div className="w-full space-y-6">
      {/* Aging Buckets Header Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            {t('total_receivable')}
          </span>
          <span className="text-xl sm:text-2xl font-black text-white mt-1 block">
            PKR {aging.total_outstanding_pkr?.toLocaleString()}
          </span>
          <span className="text-[11px] text-slate-400 font-medium mt-1 block">
            Across {creditData?.total_customers_with_balance || 0} customers
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 backdrop-blur-md">
          <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider block">
            0-30 Days (Normal)
          </span>
          <span className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 block">
            PKR {aging.current_0_30_days_pkr?.toLocaleString()}
          </span>
          <span className="text-[11px] text-emerald-400/80 font-medium mt-1 block">
            Safe Credit Terms
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30 backdrop-blur-md">
          <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider block">
            31-60 Days (Attention)
          </span>
          <span className="text-xl sm:text-2xl font-black text-amber-400 mt-1 block">
            PKR {aging.overdue_31_60_days_pkr?.toLocaleString()}
          </span>
          <span className="text-[11px] text-amber-400/80 font-medium mt-1 block">
            Gentle Reminder Due
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-500/30 backdrop-blur-md">
          <span className="text-[11px] font-bold text-rose-300 uppercase tracking-wider block">
            {t('overdue_30d')}
          </span>
          <span className="text-xl sm:text-2xl font-black text-rose-400 mt-1 block">
            PKR {aging.overdue_61_plus_days_pkr?.toLocaleString()}
          </span>
          <span className="text-[11px] text-rose-400/80 font-medium mt-1 block">
            High Risk Default
          </span>
        </div>
      </div>

      {/* Customer Ledger Table */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 overflow-hidden shadow-xl space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              Customer Khata Ledger & Safe Mark Scores
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated credit scoring and 1-click WhatsApp wasooli collection.
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer name or phone..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-3">Safe Mark Rating</th>
                <th className="py-3 px-3">Total Udhaar</th>
                <th className="py-3 px-3">Overdue Amount</th>
                <th className="py-3 px-3">Days Past Due</th>
                <th className="py-3 px-4 text-right">Wasooli Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-10 text-center text-slate-400">
                    Loading customer khata accounts...
                  </td>
                </tr>
              ) : customers.length > 0 ? (
                customers.map((c) => {
                  const score = c.safe_mark_score || 70;
                  const isHighRisk = score < 50 || c.days_overdue > 30;
                  const isModerate = score >= 50 && score < 75;

                  return (
                    <tr key={c.customer_id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-sm">
                          {c.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {c.phone || '+92 300 0000000'}
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black">
                          <span className={`w-2 h-2 rounded-full ${
                            isHighRisk ? 'bg-rose-500' : isModerate ? 'bg-amber-400' : 'bg-emerald-400'
                          }`}></span>
                          <span className={isHighRisk ? 'text-rose-400' : isModerate ? 'text-amber-400' : 'text-emerald-400'}>
                            Safe Mark: {score}/100
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 font-extrabold text-white">
                        PKR {c.total_balance_pkr?.toLocaleString()}
                      </td>

                      <td className="py-3.5 px-3 font-bold">
                        <span className={c.overdue_amount_pkr > 0 ? 'text-rose-400' : 'text-slate-400'}>
                          PKR {c.overdue_amount_pkr?.toLocaleString()}
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className={`text-xs font-semibold ${c.days_overdue > 30 ? 'text-rose-400 font-black' : 'text-slate-400'}`}>
                          {c.days_overdue} Days
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Record Payment Trigger */}
                          {payingCustomerId === c.customer_id ? (
                            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-700">
                              <input
                                type="number"
                                value={payAmount}
                                onChange={(e) => setPayAmount(e.target.value)}
                                placeholder="Amount..."
                                className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white outline-none"
                              />
                              <button
                                onClick={() => handleQuickPayment(c)}
                                disabled={submittingPayment}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold"
                              >
                                {submittingPayment ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={() => setPayingCustomerId(null)}
                                className="px-1.5 text-slate-400 hover:text-white text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setPayingCustomerId(c.customer_id);
                                setPayAmount(c.total_balance_pkr);
                              }}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition"
                            >
                              Record Payment
                            </button>
                          )}

                          {/* WhatsApp Reminder Button */}
                          <button
                            onClick={() => onOpenWasooliModal(c)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 transition"
                          >
                            <Send className="w-3 h-3" />
                            <span>WhatsApp</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="py-10 text-center text-slate-400">
                    No customers found with current search filter.
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

export default KhataWasooliView;
