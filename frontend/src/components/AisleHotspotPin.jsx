import React from 'react';
import { motion } from 'framer-motion';
import { 
  AlertTriangle, 
  Sparkles, 
  TrendingDown, 
  Users, 
  PackageCheck,
  ChevronRight 
} from 'lucide-react';

const PIN_CONFIGS = {
  stockout: {
    badge: 'Critical Stockout',
    bg: 'bg-rose-500',
    ring: 'border-rose-400',
    glow: 'rgba(244, 63, 94, 0.4)',
    icon: AlertTriangle,
    accent: 'text-rose-400',
  },
  combo: {
    badge: 'Dead Stock Bundle',
    bg: 'bg-purple-600',
    ring: 'border-purple-400',
    glow: 'rgba(168, 85, 247, 0.4)',
    icon: Sparkles,
    accent: 'text-purple-300',
  },
  squeeze: {
    badge: 'Margin Squeeze',
    bg: 'bg-amber-500',
    ring: 'border-amber-300',
    glow: 'rgba(245, 158, 11, 0.4)',
    icon: TrendingDown,
    accent: 'text-amber-300',
  },
  khata: {
    badge: 'Khata Wasooli',
    bg: 'bg-emerald-500',
    ring: 'border-emerald-300',
    glow: 'rgba(16, 185, 129, 0.4)',
    icon: Users,
    accent: 'text-emerald-300',
  },
  fastmover: {
    badge: 'Fast Mover Demand',
    bg: 'bg-cyan-500',
    ring: 'border-cyan-300',
    glow: 'rgba(6, 182, 212, 0.4)',
    icon: PackageCheck,
    accent: 'text-cyan-300',
  },
};

export function AisleHotspotPin({
  hotspot,
  isSelected,
  onClick,
}) {
  const config = PIN_CONFIGS[hotspot.type] || PIN_CONFIGS.stockout;
  const Icon = config.icon;

  return (
    <div
      style={{
        left: hotspot.position.x,
        top: hotspot.position.y,
        transform: 'translate(-50%, -50%)',
      }}
      className="absolute z-20 cursor-pointer group"
      onClick={onClick}
    >
      {/* Outer pulsating radar wave */}
      <span
        className="absolute inset-0 rounded-full animate-ping opacity-60"
        style={{ backgroundColor: config.glow }}
      ></span>

      {/* Interactive Pin Marker */}
      <motion.div
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.95 }}
        className={`relative flex items-center justify-center w-11 h-11 rounded-full ${config.bg} text-white shadow-xl border-2 ${config.ring} transition-all duration-300 ${
          isSelected ? 'ring-4 ring-white shadow-2xl scale-110' : 'group-hover:shadow-2xl'
        }`}
        style={{
          boxShadow: `0 0 25px ${config.glow}`,
        }}
      >
        <Icon className="w-5 h-5 text-white animate-pulse" />

        {/* Counter Badge */}
        {hotspot.count && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-slate-950 text-white border border-white/20">
            {hotspot.count}
          </span>
        )}
      </motion.div>

      {/* Floating Micro Label */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-90 group-hover:opacity-100 transition duration-200">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950/90 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white shadow-lg">
          <span className={`w-1.5 h-1.5 rounded-full ${config.bg}`}></span>
          <span>{hotspot.title}</span>
          <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition" />
        </div>
      </div>
    </div>
  );
}

export default AisleHotspotPin;
