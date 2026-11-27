/**
 * Every server read and write the app makes, as React Query hooks.
 *
 * Reads are cached and shared between screens. Every write invalidates exactly the
 * data it changes, so all screens refresh themselves with the new numbers.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from './client';
import type { ChatLanguage, ImportType, KpiPeriod } from './types';

export const queryKeys = {
  store: ['store'] as const,
  actions: ['actions'] as const,
  dashboard: (period: KpiPeriod) => ['dashboard', period] as const,
  products: (filters: ProductFilters) => ['products', filters] as const,
  product: (id: number) => ['product', id] as const,
  forecast: (target: ForecastTarget) => ['forecast', target] as const,
  reorder: (budget: number, cover: number) => ['reorder', budget, cover] as const,
  insights: ['insights'] as const,
  credit: ['credit'] as const,
  customer: (id: number) => ['customer', id] as const,
  payables: ['payables'] as const,
  cashOutlook: ['cash-outlook'] as const,
};

/** Data that depends on stock, prices, sales, khata or cash. */
const STORE_DATA_KEYS = [
  ['actions'], ['dashboard'], ['products'], ['product'], ['forecast'], ['reorder'],
  ['insights'], ['credit'], ['customer'], ['payables'], ['cash-outlook'],
] as const;

function useInvalidateStoreData() {
  const qc = useQueryClient();
  return () => Promise.all(STORE_DATA_KEYS.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

// ---- reads ---------------------------------------------------------------------------

export function useStore() {
  return useQuery({
    queryKey: queryKeys.store,
    queryFn: () => unwrap(api.GET('/api/store')),
    staleTime: 5 * 60_000,
  });
}

export function useTodayActions() {
  return useQuery({ queryKey: queryKeys.actions, queryFn: () => unwrap(api.GET('/api/actions/today')) });
}

export function useDashboard(period: KpiPeriod = '30d') {
  return useQuery({
    queryKey: queryKeys.dashboard(period),
    queryFn: () => unwrap(api.GET('/api/dashboard', { params: { query: { period } } })),
    placeholderData: keepPreviousData,
  });
}

export interface ProductFilters {
  search?: string;
  category?: string;
  status?: 'all' | 'critical' | 'high' | 'medium' | 'ok' | 'unknown' | 'at_risk' | 'dead_stock' | 'out_of_stock';
  sort?: 'risk' | 'name' | 'cover' | 'value';
}

export function useProducts(filters: ProductFilters = {}) {
  return useQuery({
    queryKey: queryKeys.products(filters),
    queryFn: () =>
      unwrap(
        api.GET('/api/products', {
          params: {
            query: {
              search: filters.search || undefined,
              category: filters.category || undefined,
              status: filters.status ?? 'all',
              sort: filters.sort ?? 'risk',
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useProduct(id: number | null) {
  return useQuery({
    queryKey: queryKeys.product(id ?? 0),
    queryFn: () => unwrap(api.GET('/api/products/{product_id}', { params: { path: { product_id: id! } } })),
    enabled: id !== null,
  });
}

export type ForecastTarget = { productId: number } | { category: string } | { store: true };

export function useForecast(target: ForecastTarget | null, horizonDays = 7) {
  return useQuery({
    queryKey: queryKeys.forecast(target ?? { store: true }),
    queryFn: () =>
      unwrap(
        api.POST('/api/forecast', {
          body: {
            horizon_days: horizonDays,
            product_id: target && 'productId' in target ? target.productId : null,
            category: target && 'category' in target ? target.category : null,
          },
        }),
      ),
    enabled: target !== null,
    staleTime: 5 * 60_000,
  });
}

/** The hero flow. Previews are not saved on the server, so this is safe to call as the budget changes. */
export function useReorderPlan(budget: number, targetCoverDays = 14) {
  return useQuery({
    queryKey: queryKeys.reorder(budget, targetCoverDays),
    queryFn: () =>
      unwrap(api.POST('/api/reorder-plan', { body: { budget_pkr: budget, target_cover_days: targetCoverDays } })),
    enabled: budget > 0,
    placeholderData: keepPreviousData,
  });
}

export function useInsights() {
  return useQuery({ queryKey: queryKeys.insights, queryFn: () => unwrap(api.GET('/api/insights')) });
}

export function useCreditSummary() {
  return useQuery({ queryKey: queryKeys.credit, queryFn: () => unwrap(api.GET('/api/credit/summary')) });
}

export function useCustomerLedger(id: number | null) {
  return useQuery({
    queryKey: queryKeys.customer(id ?? 0),
    queryFn: () =>
      unwrap(api.GET('/api/credit/customers/{customer_id}', { params: { path: { customer_id: id! } } })),
    enabled: id !== null,
  });
}

export function usePayables() {
  return useQuery({ queryKey: queryKeys.payables, queryFn: () => unwrap(api.GET('/api/payables/summary')) });
}

export function useCashOutlook() {
  return useQuery({ queryKey: queryKeys.cashOutlook, queryFn: () => unwrap(api.GET('/api/payables/cash-outlook')) });
}

// ---- writes --------------------------------------------------------------------------

export function useUpdatePrice() {
  const invalidate = useInvalidateStoreData();
  return useMutation({
    mutationFn: (v: { productId: number; price: number; reason?: string }) =>
      unwrap(
        api.PATCH('/api/products/{product_id}/price', {
          params: { path: { product_id: v.productId } },
          body: { new_selling_price: v.price, reason: v.reason ?? 'Shelf price updated' },
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useAdjustStock() {
  const invalidate = useInvalidateStoreData();
  return useMutation({
    mutationFn: (v: { productId: number; change: number; reason?: string }) =>
      unwrap(
        api.POST('/api/products/{product_id}/stock-adjustment', {
          params: { path: { product_id: v.productId } },
          body: { quantity_change: v.change, reason: v.reason ?? 'Stock received' },
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useRecordPayment() {
  const invalidate = useInvalidateStoreData();
  return useMutation({
    mutationFn: (v: { customerId: number; amount: number; notes?: string }) =>
      unwrap(
        api.POST('/api/credit/payment', {
          body: { customer_id: v.customerId, amount: v.amount, notes: v.notes ?? 'Counter wasooli' },
        }),
      ),
    onSuccess: invalidate,
  });
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export function useCopilotChat() {
  return useMutation({
    mutationFn: (v: { message: string; language: ChatLanguage; history: ChatTurn[] }) =>
      unwrap(
        api.POST('/api/copilot/chat', {
          body: { message: v.message, language: v.language, history: v.history.slice(-8), store_id: 1 },
        }),
      ),
  });
}

export function usePreviewCsv() {
  return useMutation({
    mutationFn: (v: { file: File; importType: ImportType }) =>
      unwrap(
        api.POST('/api/import/csv', {
          body: { file: v.file as unknown as string, import_type: v.importType, store_id: 1 },
          bodySerializer: (body) => {
            const form = new FormData();
            form.append('file', v.file);
            form.append('import_type', body.import_type ?? 'products');
            form.append('store_id', String(body.store_id ?? 1));
            return form;
          },
        }),
      ),
  });
}

export function useCommitCsv() {
  const invalidate = useInvalidateStoreData();
  return useMutation({
    mutationFn: (batchToken: string) =>
      unwrap(api.POST('/api/import/commit', { body: { batch_token: batchToken, store_id: 1 } })),
    onSuccess: invalidate,
  });
}

export function useResetDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/api/demo/reset', {
          params: { header: { 'x-demo-key': import.meta.env.VITE_DEMO_RESET_KEY ?? 'cye2026' } },
        }),
      ),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function csvTemplateUrl(type: ImportType): string {
  return `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/import/template/${type}`;
}
