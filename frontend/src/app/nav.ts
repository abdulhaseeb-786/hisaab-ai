import { BookOpenText, Boxes, Calculator, ClipboardList, Map, Sun } from 'lucide-react';

/** The five daily jobs, in the order a shopkeeper's day goes. */
export const PRIMARY_NAV = [
  { to: '/app', end: true, icon: Sun, en: 'Today', ur: 'Aaj', tour: 'nav-today' },
  { to: '/app/khata', icon: BookOpenText, en: 'Khata', ur: 'Khata', tour: 'nav-khata' },
  { to: '/app/order', icon: ClipboardList, en: 'Order', ur: 'Order', tour: 'nav-order' },
  { to: '/app/stock', icon: Boxes, en: 'Stock', ur: 'Stock', tour: 'nav-stock' },
  { to: '/app/hisaab', icon: Calculator, en: 'Hisaab', ur: 'Hisaab', tour: 'nav-hisaab' },
] as const;

export const SECONDARY_NAV = [
  { to: '/app/store-map', icon: Map, en: 'Store map', ur: 'Dukaan ka naqsha' },
] as const;
