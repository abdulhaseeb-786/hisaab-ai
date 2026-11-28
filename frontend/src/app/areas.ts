/**
 * Each part of the app has one colour, and it means the same thing everywhere:
 *   sabz  = the day and the shop (Aaj)
 *   lal   = credit and what is late (Khata)
 *   neela = goods and records (Order, Stock)
 *   haldi = money and the cash box (Hisaab)
 * Class names are written out in full so Tailwind keeps them.
 */
export type Hue = 'sabz' | 'lal' | 'neela' | 'haldi';

export interface HueStyle {
  /** Page title band. */
  band: string;
  /** Round icon chip on the band. */
  chip: string;
  /** Active tab in the bottom bar. */
  tab: string;
  tabText: string;
  /** A small icon chip on a light card (quick actions). */
  soft: string;
}

export const HUES: Record<Hue, HueStyle> = {
  sabz: {
    band: 'bg-sabz-50 border-sabz-100',
    chip: 'bg-sabz-600 text-white',
    tab: 'bg-sabz-100',
    tabText: 'text-sabz-700',
    soft: 'bg-sabz-100 text-sabz-700',
  },
  lal: {
    band: 'bg-lal-50 border-lal-100',
    chip: 'bg-lal-500 text-white',
    tab: 'bg-lal-100',
    tabText: 'text-lal-700',
    soft: 'bg-lal-100 text-lal-700',
  },
  neela: {
    band: 'bg-neela-50 border-neela-100',
    chip: 'bg-neela-600 text-white',
    tab: 'bg-neela-100',
    tabText: 'text-neela-700',
    soft: 'bg-neela-100 text-neela-700',
  },
  haldi: {
    band: 'bg-haldi-50 border-haldi-100',
    chip: 'bg-haldi-400 text-haldi-950',
    tab: 'bg-haldi-100',
    tabText: 'text-haldi-800',
    soft: 'bg-haldi-100 text-haldi-800',
  },
};

/** Which colour a page belongs to, from its path. */
export function hueForPath(path: string): Hue {
  if (path.startsWith('/app/khata')) return 'lal';
  if (path.startsWith('/app/order') || path.startsWith('/app/stock') || path.startsWith('/app/store-map')) return 'neela';
  if (path.startsWith('/app/hisaab') || path.startsWith('/app/cash') || path.startsWith('/app/report')) return 'haldi';
  return 'sabz';
}
