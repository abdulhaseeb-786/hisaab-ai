import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import AisleHotspotPin from './AisleHotspotPin';
import { 
  Store, 
  Sparkles, 
  AlertTriangle, 
  TrendingDown, 
  Users, 
  ArrowRight,
  PackageCheck,
  CheckCircle2,
  Clock,
  Layers,
  ChevronRight
} from 'lucide-react';

export function InteractiveMartMap({
  onSelectAction,
  stats = {},
  onOpenProductDrawer,
  onOpenComboModal,
  onOpenWasooliModal,
  onOpenReorderFlow,
}) {
  const { t } = useLanguage();
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedHotspotId, setSelectedHotspotId] = useState('oil');

  const hotspots = [
    {
      id: 'oil',
      type: 'stockout',
      title: 'Oil & Ghee Shelf',
      subtitle: 'Dalda Cooking Oil 1L — 2.9 Din Baqi',
      sku: 'OIL-001',
      productId: 1,
      position: { x: '24%', y: '42%' },
      coverDays: 2.9,
      leadTime: 4,
      urgency: 'Critical',
      actionText: 'Reorder 3 Cartons (PKR 14,400)',
      actionType: 'reorder',
      details: 'Daily sales avg 5.8 units. Stock on hand is only 17 units. Imminent stockout within 2.9 days before next wholesale delivery.',
    },
    {
      id: 'clean',
      type: 'combo',
      title: 'Cleaning & Detergents',
      subtitle: 'Sparkle Surface Cleaner — 87 Din Se Phasa Maal',
      sku: 'DET-006',
      productId: 42,
      position: { x: '46%', y: '27%' },
      coverDays: 999,
      leadTime: 3,
      urgency: 'Dead Stock',
      actionText: 'Launch Combo Deal (-15% Off)',
      actionType: 'combo',
      details: 'PKR 18,200 tied up in 65 unsold bottles. Pair with fast-moving Surf Excel 1kg to clear inventory and liberate cash.',
    },
    {
      id: 'spice',
      type: 'squeeze',
      title: 'Spices & Chai Rack',
      subtitle: 'National Biryani Masala & Mezan Tea — Margin Drop',
      sku: 'SPI-002',
      productId: 14,
      position: { x: '63%', y: '30%' },
      coverDays: 16.0,
      leadTime: 2,
      urgency: 'Margin Squeeze',
      actionText: 'Adjust Selling Price (+PKR 15)',
      actionType: 'price',
      details: 'Wholesale cost increased from PKR 95 to PKR 112 (+17.8%), but retail price remained PKR 120. Store margin collapsed from 20.8% to 6.6%.',
    },
    {
      id: 'dairy',
      type: 'fastmover',
      title: 'Dairy Cooler & Fridge',
      subtitle: "Olper's Milk & Farm Fresh Eggs — Tez Bikne Wala Maal",
      sku: 'DAI-001',
      productId: 7,
      position: { x: '38%', y: '68%' },
      coverDays: 4.2,
      leadTime: 1,
      urgency: 'Daily Restock',
      actionText: 'View 7-Day Demand Forecast',
      actionType: 'forecast',
      details: 'High turnover fresh stock (28 units sold daily). Projected weekend surge of +35% requires 2 extra crates.',
    },
    {
      id: 'khata',
      type: 'khata',
      title: 'Khata Cash Counter',
      subtitle: 'Tariq Grocers — PKR 38,400 Overdue (45 Din)',
      customerId: 3,
      position: { x: '78%', y: '56%' },
      coverDays: 0,
      leadTime: 0,
      urgency: 'Safe Mark 38/100',
      actionText: 'Send WhatsApp Wasooli Reminder',
      actionType: 'wasooli',
      details: 'Credit limit PKR 25,000 exceeded. Safe Mark credit score dropped to High Risk. 45 days past agreed payment terms.',
    },
  ];

  const filteredHotspots = hotspots.filter(h => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'stockout') return h.type === 'stockout';
    if (activeFilter === 'combo') return h.type === 'combo';
    if (activeFilter === 'squeeze') return h.type === 'squeeze';
    if (activeFilter === 'khata') return h.type === 'khata';
    return true;
  });

  const selectedHotspot = hotspots.find(h => h.id === selectedHotspotId) || hotspots[0];

  const handleHotspotAction = (hotspot) => {
    if (hotspot.actionType === 'reorder') {
      if (onOpenReorderFlow) onOpenReorderFlow();
    } else if (hotspot.actionType === 'combo') {
      if (onOpenComboModal) onOpenComboModal(hotspot);
    } else if (hotspot.actionType === 'wasooli') {
      if (onOpenWasooliModal) onOpenWasooliModal(hotspot);
    } else if (hotspot.actionType === 'price' || hotspot.actionType === 'forecast') {
      if (onOpenProductDrawer) onOpenProductDrawer(hotspot.productId);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Store className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-extrabold text-white tracking-tight">
              {t('mart_title')}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('mart_subtitle')} Click on any pulsating pin or select from the filter below.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {[
            { id: 'all', label: 'All Hotspots (5)' },
            { id: 'stockout', label: 'Stockouts', icon: AlertTriangle, color: 'text-rose-400' },
            { id: 'combo', label: 'Bundles', icon: Sparkles, color: 'text-purple-400' },
            { id: 'squeeze', label: 'Price Squeeze', icon: TrendingDown, color: 'text-amber-400' },
            { id: 'khata', label: 'Khata Counter', icon: Users, color: 'text-emerald-400' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                activeFilter === f.id
                  ? 'bg-slate-100 text-slate-950 shadow-md font-extrabold'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 hover:text-white'
              }`}
            >
              {f.icon && <f.icon className={`w-3.5 h-3.5 ${f.color}`} />}
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2.5D Isometric Diorama Canvas */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-800/80 bg-slate-950 shadow-2xl">
        {/* Ambient Top Glow */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent pointer-events-none z-10"></div>
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/10 text-xs text-slate-300 font-semibold shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Al-Madina Digital Twin (Live Synchronized)</span>
        </div>

        {/* Isometric Store Render Image */}
        <div className="relative w-full aspect-[16/9] min-h-[380px] max-h-[580px] select-none overflow-hidden">
          <img
            src="/src/assets/store-isometric.jpg"
            alt="Al-Madina General Store 3D Floor Plan"
            className="w-full h-full object-cover transform transition-transform duration-700 hover:scale-[1.02]"
          />

          {/* Interactive AR Hotspot Pins */}
          {filteredHotspots.map(hotspot => (
            <AisleHotspotPin
              key={hotspot.id}
              hotspot={hotspot}
              isSelected={selectedHotspotId === hotspot.id}
              onClick={() => setSelectedHotspotId(hotspot.id)}
            />
          ))}
        </div>

        {/* Selected Hotspot Live Drawer / Action Banner */}
        <div className="relative z-20 p-4 sm:p-5 bg-slate-900/90 backdrop-blur-xl border-t border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3 max-w-2xl">
            <div className={`p-3 rounded-2xl shrink-0 ${
              selectedHotspot.type === 'stockout' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
              selectedHotspot.type === 'combo' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
              selectedHotspot.type === 'squeeze' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
              selectedHotspot.type === 'khata' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
              'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
            }`}>
              {selectedHotspot.type === 'stockout' && <AlertTriangle className="w-6 h-6 animate-pulse" />}
              {selectedHotspot.type === 'combo' && <Sparkles className="w-6 h-6 animate-spin" />}
              {selectedHotspot.type === 'squeeze' && <TrendingDown className="w-6 h-6" />}
              {selectedHotspot.type === 'khata' && <Users className="w-6 h-6" />}
              {selectedHotspot.type === 'fastmover' && <PackageCheck className="w-6 h-6" />}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-white text-base sm:text-lg">
                  {selectedHotspot.title}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                  {selectedHotspot.urgency}
                </span>
                {selectedHotspot.sku && (
                  <span className="text-xs text-slate-400 font-mono">
                    SKU: {selectedHotspot.sku}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-300 font-medium mt-0.5">
                {selectedHotspot.subtitle}
              </p>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                {selectedHotspot.details}
              </p>
            </div>
          </div>

          {/* Action Trigger Button */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => handleHotspotAction(selectedHotspot)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-extrabold text-sm text-white shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-600 shadow-emerald-900/30"
            >
              <span>{selectedHotspot.actionText}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InteractiveMartMap;
