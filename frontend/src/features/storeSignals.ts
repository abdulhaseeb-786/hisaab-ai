/**
 * "What matters in each part of the shop", built only from live API data.
 * Used by the store map pins and the aisle cards.
 */
import { useCreditSummary, useInsights, usePayables, useProducts } from '@/api/queries';
import type { DeadStockItem, KhataCustomer, MarginSqueeze, Product } from '@/api/types';

export type ZoneId = 'oil' | 'cleaning' | 'spices' | 'dairy';
export type SignalType = 'stockout' | 'squeeze' | 'dead' | 'ok';

export interface ZoneSignal {
  zone: ZoneId;
  type: SignalType;
  atRiskCount: number;
  product?: Product;
  squeeze?: MarginSqueeze;
  dead?: DeadStockItem;
}

export const ZONES: Record<ZoneId, { categories: string[]; title: [string, string]; position: { x: string; y: string } }> = {
  oil: { categories: ['Cooking Oil & Ghee'], title: ['Oil & ghee shelf', 'Oil aur ghee'], position: { x: '24%', y: '42%' } },
  cleaning: {
    categories: ['Cleaning & Laundry', 'Personal Care'],
    title: ['Cleaning & personal care', 'Safai aur personal care'],
    position: { x: '46%', y: '27%' },
  },
  spices: {
    categories: ['Spices & Mixes', 'Tea & Beverages'],
    title: ['Spices, tea & drinks', 'Masalay, chai aur drinks'],
    position: { x: '63%', y: '30%' },
  },
  dairy: {
    categories: ['Dairy & Breakfast', 'Snacks & Biscuits', 'Grains & Pulses'],
    title: ['Dairy, grains & snacks', 'Doodh, anaaj aur snacks'],
    position: { x: '38%', y: '68%' },
  },
};

export const KHATA_POSITION = { x: '78%', y: '56%' };

function zoneSignal(zone: ZoneId, products: Product[], squeezes: MarginSqueeze[], dead: DeadStockItem[]): ZoneSignal {
  const cats = ZONES[zone].categories;
  const inZone = products.filter((p) => cats.includes(p.category));
  const atRisk = inZone
    .filter((p) => p.stockout_risk === 'critical' || p.stockout_risk === 'high')
    .sort((a, b) => (a.effective_cover_days ?? 0) - a.lead_time_days - ((b.effective_cover_days ?? 0) - b.lead_time_days));
  const squeeze = squeezes.find((s) => cats.includes(s.category));
  const deadItem = dead.find((d) => cats.includes(d.category));

  if (atRisk[0]) return { zone, type: 'stockout', atRiskCount: atRisk.length, product: atRisk[0] };
  if (squeeze) return { zone, type: 'squeeze', atRiskCount: 0, squeeze };
  if (deadItem) return { zone, type: 'dead', atRiskCount: 0, dead: deadItem };
  const fastest = [...inZone].sort((a, b) => (b.average_daily_demand ?? 0) - (a.average_daily_demand ?? 0))[0];
  return { zone, type: 'ok', atRiskCount: 0, product: fastest };
}

export interface StoreSignals {
  zones: ZoneSignal[];
  topDefaulter?: KhataCustomer;
  overdueTotal: number;
  overdueCustomers: number;
  deadStock: DeadStockItem[];
  deadStockTotal: number;
  squeezes: MarginSqueeze[];
  nextDelivery?: { supplier: string; date: string; pendingValue: number };
  pendingOrdersValue: number;
  products: Product[];
}

export function useStoreSignals() {
  const products = useProducts({});
  const insights = useInsights();
  const credit = useCreditSummary();
  const payables = usePayables();

  const queries = [products, insights, credit, payables];
  const isLoading = queries.some((q) => q.isLoading);
  const error = queries.find((q) => q.isError)?.error;
  const refetch = () => queries.forEach((q) => q.isError && q.refetch());

  let data: StoreSignals | undefined;
  if (products.data && insights.data && credit.data && payables.data) {
    const list = products.data.products;
    const { margin_squeezes, dead_stock } = insights.data;
    const deliveries = payables.data.suppliers
      .filter((s) => s.next_delivery_date)
      .sort((a, b) => (a.next_delivery_date! < b.next_delivery_date! ? -1 : 1));
    const next = deliveries[0];
    data = {
      zones: (Object.keys(ZONES) as ZoneId[]).map((z) => zoneSignal(z, list, margin_squeezes, dead_stock)),
      topDefaulter: credit.data.top_defaulters[0],
      overdueTotal: credit.data.aging.total_overdue_pkr,
      overdueCustomers: credit.data.total_overdue_customers,
      deadStock: dead_stock,
      deadStockTotal: insights.data.dead_stock_total_pkr,
      squeezes: margin_squeezes,
      nextDelivery: next
        ? { supplier: next.name, date: next.next_delivery_date!, pendingValue: next.pending_orders_value_pkr }
        : undefined,
      pendingOrdersValue: payables.data.pending_orders_value_pkr,
      products: list,
    };
  }
  return { data, isLoading, error, refetch };
}
