import { Banknote, BookOpenText, Boxes, LayoutDashboard, Map, ShoppingCart, Sun } from 'lucide-react';

export const LANDING_NAV = { to: '/', end: true, icon: LayoutDashboard, en: 'Dashboard', ur: 'Dashboard' } as const;

/** The five daily jobs, in the order a shopkeeper's day goes. */
export const PRIMARY_NAV = [
  { to: '/app', end: true, icon: Sun, en: 'Today', ur: 'Aaj', tour: 'nav-today' },
  { to: '/app/buy', icon: ShoppingCart, en: 'Buy', ur: 'Khareedari', tour: 'nav-buy' },
  { to: '/app/stock', icon: Boxes, en: 'Stock', ur: 'Stock', tour: 'nav-stock' },
  { to: '/app/khata', icon: BookOpenText, en: 'Khata', ur: 'Khata', tour: 'nav-khata' },
  { to: '/app/cash', icon: Banknote, en: 'Cash', ur: 'Cash', tour: 'nav-cash' },
] as const;

export const SECONDARY_NAV = [{ to: '/app/store-map', icon: Map, en: 'Store map', ur: 'Dukaan ka naqsha' }] as const;
