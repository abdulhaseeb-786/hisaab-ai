import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import confetti from 'canvas-confetti';
import { 
  X, 
  Send, 
  Copy, 
  Check, 
  ShieldCheck, 
  AlertTriangle, 
  Users,
  MessageCircle,
  ExternalLink
} from 'lucide-react';

export function WasooliModal({ customer, onClose, onPaymentRecorded }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  if (!customer) return null;

  const defaultUrduMessage = `Assalam-o-Alaikum ${customer.name || 'Bhai'}! Al-Madina General Store (Sector G-9, Islamabad) se hisaab ka reminder hai.\n\nAap ka kul baqaya PKR ${(customer.total_balance_pkr || customer.overdue_amount_pkr || 38400)?.toLocaleString()} hai jo ke ${customer.days_overdue || 45} din se overdue hai.\n\nBaraye meherbani dukaan par tashreef la kar ya Easypaisa/JazzCash ke zariye baqaya raqam ada farmayein taakey hisaab behtar rahay.\n\nShukriya!\nTariq Mehmood — Al-Madina Store\nPhone: +92 300 1234567`;

  const [message, setMessage] = useState(defaultUrduMessage);

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppSend = () => {
    const cleanPhone = (customer.phone || '923001234567').replace(/[^0-9]/g, '');
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-white text-base sm:text-lg">
                  WhatsApp Wasooli Reminder
                </h3>
                <span className="text-xs text-slate-400">
                  {customer.name} • Safe Mark Rating: {customer.safe_mark_score || 38}/100
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

          {/* Modal Body */}
          <div className="p-5 space-y-4">
            {/* Customer Snapshot */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block">Total Overdue:</span>
                <span className="text-base font-black text-rose-400 block mt-0.5">
                  PKR {(customer.total_balance_pkr || 38400)?.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Aging:</span>
                <span className="text-base font-black text-amber-400 block mt-0.5">
                  {customer.days_overdue || 45} Days Overdue
                </span>
              </div>
            </div>

            {/* Editable Message Textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">
                Urdu Wasooli Message (Ready for WhatsApp):
              </label>
              <textarea
                rows="6"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-slate-200 outline-none focus:border-emerald-500 leading-relaxed font-sans"
              ></textarea>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="p-5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied!' : 'Copy Text'}</span>
            </button>

            <button
              onClick={handleWhatsAppSend}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition active:scale-95"
            >
              <Send className="w-4 h-4 text-slate-950" />
              <span>Send via WhatsApp</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default WasooliModal;
