import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { 
  AlertTriangle, 
  Sparkles, 
  TrendingDown, 
  Users, 
  PackageCheck, 
  Truck,
  ArrowRight
} from 'lucide-react';

export function AisleCarousel({ 
  onSelectAisle,
  onOpenProductDrawer,
  onOpenComboModal,
  onOpenWasooliModal,
  onOpenReorderFlow 
}) {
  const { t } = useLanguage();

  const aisles = [
    {
      id: 'oil',
      title: 'Oil & Ghee Section',
      image: '/src/assets/shelf-stockout.jpg',
      badge: '2 Critical Stockouts',
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      description: 'Dalda & Sufi Cooking Oil facing stock depletion within 48-72 hours. Reorder recommended.',
      actionText: 'Optimize Reorder',
      onClick: () => onOpenReorderFlow && onOpenReorderFlow(),
    },
    {
      id: 'combos',
      title: 'Bachat Bundles Station',
      image: '/src/assets/combo-bundle.jpg',
      badge: 'PKR 42,000 Tied Stock',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      description: 'Pair slow-moving surface cleaners and shampoos with Surf Excel and Dalda Oil.',
      actionText: 'Build Combo',
      onClick: () => onOpenComboModal && onOpenComboModal(),
    },
    {
      id: 'dairy',
      title: 'Chiller & Fresh Dairy',
      image: '/src/assets/dairy-cooler.jpg',
      badge: 'High Daily Velocity',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      description: 'Olpers Milk and Desi Eggs require strict daily reorder schedule to prevent missed breakfast sales.',
      actionText: 'Forecast Demand',
      onClick: () => onOpenProductDrawer && onOpenProductDrawer(7),
    },
    {
      id: 'spices',
      title: 'Spices & Beverage Rack',
      image: '/src/assets/spices-rack.jpg',
      badge: 'Margin Squeeze Alert',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      description: 'National Spices and Mezan Tea wholesale prices increased +12%. Update retail prices now.',
      actionText: 'Adjust Prices',
      onClick: () => onOpenProductDrawer && onOpenProductDrawer(14),
    },
    {
      id: 'khata',
      title: 'Cash Counter & Khata',
      image: '/src/assets/khata-counter.jpg',
      badge: 'Safe Mark Overdue',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      description: 'PKR 63,600 total customer receivables. 4 customers exceeded credit limit and need wasooli.',
      actionText: 'Open Khata',
      onClick: () => onOpenWasooliModal && onOpenWasooliModal(),
    },
    {
      id: 'van',
      title: 'Supplier Deliveries',
      image: '/src/assets/delivery-van.jpg',
      badge: 'Next Van: 2:00 PM',
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      description: 'Al-Fateh Traders delivery truck arriving at 2:00 PM. Confirm purchase orders before noon.',
      actionText: 'Review Invoices',
      onClick: () => onOpenReorderFlow && onOpenReorderFlow(),
    },
  ];

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-extrabold text-white tracking-tight">
            Aisle Explorer — Virtual Mart Walkthrough
          </h3>
          <p className="text-xs text-slate-400">
            Browse through store sections, review inventory status, and take instant actions.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {aisles.map(aisle => (
          <motion.div
            key={aisle.id}
            whileHover={{ y: -4 }}
            className="group relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/70 hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-950/20 transition-all flex flex-col justify-between"
          >
            {/* Visual Thumbnail */}
            <div className="relative w-full h-44 overflow-hidden bg-slate-950">
              <img
                src={aisle.image}
                alt={aisle.title}
                className="w-full h-full object-cover transform transition-transform duration-500 group-hover:scale-105"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/src/assets/store-isometric.jpg';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
              
              {/* Badge */}
              <div className="absolute top-3 left-3">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border backdrop-blur-md shadow-md ${aisle.badgeColor}`}>
                  {aisle.badge}
                </span>
              </div>
            </div>

            {/* Content & Action */}
            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
              <div>
                <h4 className="font-bold text-white text-base group-hover:text-emerald-400 transition">
                  {aisle.title}
                </h4>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {aisle.description}
                </p>
              </div>

              <button
                onClick={aisle.onClick}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white transition shadow-sm"
              >
                <span>{aisle.actionText}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default AisleCarousel;
