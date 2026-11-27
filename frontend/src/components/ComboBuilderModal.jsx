import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import confetti from 'canvas-confetti';
import { 
  X, 
  Sparkles, 
  Percent, 
  Tag, 
  Check, 
  Share2, 
  ArrowRight,
  TrendingUp,
  DollarSign
} from 'lucide-react';

export function ComboBuilderModal({ hotspot, onClose }) {
  const { t } = useLanguage();
  const [discountPct, setDiscountPct] = useState(15);
  const [copied, setCopied] = useState(false);
  const [launched, setLaunched] = useState(false);

  // Dead stock item
  const deadStock = {
    name: 'Sparkle Surface Cleaner 1L',
    sku: 'DET-006',
    regularPrice: 350,
    costPrice: 280,
    unitsStuck: 65,
    capitalTied: 18200,
  };

  // Fast moving partner item
  const fastMover = {
    name: 'Surf Excel Quick Wash 1kg',
    sku: 'DET-001',
    regularPrice: 520,
    costPrice: 450,
  };

  const combinedRegularPrice = deadStock.regularPrice + fastMover.regularPrice; // 870
  const combinedCost = deadStock.costPrice + fastMover.costPrice; // 730
  const discountAmount = Math.round((combinedRegularPrice * discountPct) / 100);
  const comboPrice = combinedRegularPrice - discountAmount;
  const merchantProfit = comboPrice - combinedCost;

  const handleLaunchCombo = () => {
    confetti({ particleCount: 80, spread: 80, origin: { y: 0.5 } });
    setLaunched(true);
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-xl bg-slate-900 border border-purple-500/30 rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Visual Header Image Banner */}
          <div className="relative w-full h-44 overflow-hidden bg-slate-950">
            <img
              src="/src/assets/combo-bundle.jpg"
              alt="Bachat Combo Deal"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-950/80 text-slate-300 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="absolute bottom-4 left-5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
                Dead Stock Liquidation Engine
              </span>
              <h3 className="text-xl font-extrabold text-white mt-1">
                Bachat Combo Creator (بچت بنڈل)
              </h3>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-5">
            <p className="text-xs text-slate-300 leading-relaxed">
              Pair your 87-day dead stock item with high-velocity grocery essentials to recover <strong>PKR 18,200</strong> in tied capital while offering real customer savings.
            </p>

            {/* Pair Breakdown */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-purple-500/20 space-y-1">
                <span className="text-[10px] font-bold text-purple-400 uppercase">
                  Dead Stock (Slow Item)
                </span>
                <span className="font-extrabold text-white text-xs block truncate">
                  {deadStock.name}
                </span>
                <span className="text-xs text-slate-400 block">
                  Reg: PKR {deadStock.regularPrice} (Cost: PKR {deadStock.costPrice})
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/20 space-y-1">
                <span className="text-[10px] font-bold text-emerald-400 uppercase">
                  Fast Mover (Anchor)
                </span>
                <span className="font-extrabold text-white text-xs block truncate">
                  {fastMover.name}
                </span>
                <span className="text-xs text-slate-400 block">
                  Reg: PKR {fastMover.regularPrice} (Cost: PKR {fastMover.costPrice})
                </span>
              </div>
            </div>

            {/* Discount Slider */}
            <div className="space-y-2 p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-300">Set Combo Bundle Discount:</span>
                <span className="text-purple-400 font-extrabold text-sm">{discountPct}% Off</span>
              </div>
              <input
                type="range"
                min="5"
                max="30"
                step="5"
                value={discountPct}
                onChange={(e) => setDiscountPct(parseInt(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>5% (Light)</span>
                <span>15% (Recommended)</span>
                <span>30% (Aggressive Clearance)</span>
              </div>
            </div>

            {/* Economic Math Breakdown */}
            <div className="grid grid-cols-3 gap-3 text-center p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/30 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Original Total</span>
                <span className="text-sm font-bold text-slate-400 line-through mt-0.5 block">
                  PKR {combinedRegularPrice}
                </span>
              </div>
              <div>
                <span className="text-purple-300 block text-[10px] uppercase font-bold">Combo Price</span>
                <span className="text-base font-black text-purple-300 mt-0.5 block">
                  PKR {comboPrice}
                </span>
              </div>
              <div>
                <span className="text-emerald-400 block text-[10px] uppercase font-bold">Store Profit</span>
                <span className="text-sm font-black text-emerald-400 mt-0.5 block">
                  +PKR {merchantProfit}
                </span>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="p-5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-400">
              Frees <strong className="text-white">PKR 18,200</strong> in working capital
            </span>

            <button
              onClick={handleLaunchCombo}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-extrabold text-xs text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-900/40 transition active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-purple-200" />
              <span>{launched ? 'Combo Active!' : 'Activate Bachat Deal'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default ComboBuilderModal;
