/**
 * Every server read and write the app makes, as React Query hooks.
 *
 * Reads are cached and shared between screens. Every write invalidates exactly the
 * data it changes, so all screens refresh themselves with the new numbers.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from './client';
import type { ChatLanguage, ExpenseCategory, ImportType, KpiPeriod, PaymentMethod } from './types';

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
  day: ['day'] as const,
  dayHistory: ['day-history'] as const,
  customers: (search: string) => ['customers', search] as const,
  creditCheck: (id: number, amount: number) => ['credit-check', id, amount] as const,
  suppliers: ['suppliers'] as const,
  orderSuggest: (supplierId: number, budget: number) => ['order-suggest', supplierId, budget] as const,
  orders: (status: string) => ['orders', status] as const,
  countSheet: (category: string) => ['count-sheet', category] as const,
  countHistory: ['count-history'] as const,
  report: ['report'] as const,
};

/** Data that depends on stock, prices, sales, khata or cash. */
const STORE_DATA_KEYS = [
  ['actions'], ['dashboard'], ['products'], ['product'], ['forecast'], ['reorder'],
  ['insights'], ['credit'], ['customer'], ['payables'], ['cash-outlook'],
  ['day'], ['day-history'], ['customers'], ['credit-check'], ['suppliers'], ['order-suggest'], ['orders'],
  ['count-sheet'], ['count-history'], ['report'],
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
    mutationFn: (v: { customerId: number; amount: number; method: PaymentMethod; notes?: string }) =>
      unwrap(
        api.POST('/api/credit/payment', {
          body: { customer_id: v.customerId, amount: v.amount, method: v.method, notes: v.notes ?? null },
        }),
      ),
    onSuccess: invalidate,
  });
}

// ---- daily workflows -------------------------------------------------------------------

export function useDayToday() {
  return useQuery({ queryKey: queryKeys.day, queryFn: () => unwrap(api.GET('/api/day/today')), refetchInterval: 60_000 });
}

export function useDayHistory(days = 14) {
  return useQuery({
    queryKey: queryKeys.dayHistory,
    queryFn: () => unwrap(api.GET('/api/day/history', { params: { query: { days } } })),
  });
}

export function useOpenDay() {
  const invalidate = useInvalidateStoreData();
  return useMutation({
    mutationFn: (v: { counted: number; note?: string }) =>
      unwrap(api.POST('/api/day/open', { body: { counted_cash: v.counted, note: v.note ?? null } })),
    onSuccess: invalidate,
  });
}

export function useCloseDay() {
  const invalidate = useInvalidateStoreData();
  return useMutation({
    mutationFn: (v: { counted: number; note?: string }) =>
      unwrap(api.POST('/api/day/close', { body: { counted_cash: v.counted, note: v.note ?? null } })),
    onSuccess: invalidate,
  });
}

export function useAddExpense() {
  const invalidate = useInvalidateStoreData();
  return useMutation({
    mutationFn: (v: { category: ExpenseCategory; amount: number; note?: string }) =>
      unwrap(api.POST('/api/expenses', { body: { category: v.category, amount: v.amount, note: v.note || null } })),
    onSuccess: invalidate,
  });
}

export function useCustomers(search = '') {
  return useQuery({
    queryKey: queryKeys.customers(search),
    queryFn: () => unwrap(api.GET('/api/credit/customers', { params: { query: { search: search || undefined } } })),
    placeholderData: keepPreviousData,
  });
}

export function useCreateCustomer() {
  const invalidate = useInvalidateStoreData();
  return useMutation({
    mutationFn: (v: { name: string; phone?: string; creditLimit: number }) =>
      unwrap(api.POST('/api/credit/customers', { body: { name: v.name, phone: v.phone || null, credit_limit: v.creditLimit } })),
    onSuccess: invalidate,
  });
}

/** "Udhaar dun?" Read-only, so it is safe to re-run as the amount changes. */
export function useCreditCheck(customerId: number | null, amount: number) {
  return useQuery({
    queryKey: queryKeys.creditCheck(customerId ?? 0, amount),
    queryFn: () => unwrap(api.POST('/api/credit/check', { body: { customer_id: customerId!, amount } })),
    enabled: customerId !== null,
    placeholderData: keepPreviousData,
  });
}

export function useGiveUdhaar() {
  const invalidate = useInvalidateStoreData();
  return useMutation({
    mutationFn: (v: { customerId: number; items: { product_id: number; qty: number }[]; extra: number; note?: string }) =>
      unwrap(
        api.POST('/api/credit/udhaar', {
          body: { customer_id: v.customerId, items: v.items, extra_amount: v.extra, note: v.note || null },
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useSuppliers() {
  return useQuery({ queryKey: queryKeys.suppliers, queryFn: () => unwrap(api.GET('/api/orders/suppliers')) });
}

export function useOrderSuggestion(supplierId: number | null, budget: number) {
  return useQuery({
    queryKey: queryKeys.orderSuggest(supplierId ?? 0, budget),
    queryFn: () => unwrap(api.POST('/api/orders/suggest', { body: { supplier_id: supplierId!, budget_pkr: budget } })),
    enabled: supplierId !== null && budget > 0,
    placeholderData: keepPreviousData,
  });
}

export function useCreateOrder() {
  const invalidate = useInvalidateStoreData();
  return useMutation({
    mutationFn: (v: { supplierId: number; lines: { product_id: number; packs: number }[] }) =>
      unwrap(api.POST('/api/orders', { body: { supplier_id: v.supplierId, lines: v.lines } })),
    onSuccess: invalidate,
  });
}

export function useOrders(status: 'pending' | 'received' = 'pending') {
  return useQuery({
    queryKey: queryKeys.orders(status),
    queryFn: () => unwrap(api.GET('/api/orders', { params: { query: { status } } })),
  });
}

export function useReceiveOrder() {
  const invalidate = useInvalidateStoreData();
  return useMutation({
    mutationFn: (v: {
      purchaseId: number;
      lines: { product_id: number; received_qty: number; unit_cost: number }[];
      billNumber?: string;
      payNow: number;
      method: PaymentMethod;
    }) =>
      unwrap(
        api.POST('/api/orders/{purchase_id}/receive', {
          params: { path: { purchase_id: v.purchaseId } },
          body: { lines: v.lines, bill_number: v.billNumber || null, pay_now_pkr: v.payNow, method: v.method },
        }),
      ),
    onSuccess: invalidate,
  });
}

export function usePaySupplier() {
  const invalidate = useInvalidateStoreData();
  return useMutation({
    mutationFn: (v: { supplierId: number; amount: number; method: PaymentMethod }) =>
      unwrap(api.POST('/api/payables/pay', { body: { supplier_id: v.supplierId, amount: v.amount, method: v.method } })),
    onSuccess: invalidate,
  });
}

export function useCountSheet(category: string) {
  return useQuery({
    queryKey: queryKeys.countSheet(category),
    queryFn: () => unwrap(api.GET('/api/stock-count/sheet', { params: { query: { category: category || undefined } } })),
    placeholderData: keepPreviousData,
  });
}

export function useCountHistory() {
  return useQuery({ queryKey: queryKeys.countHistory, queryFn: () => unwrap(api.GET('/api/stock-count/history')) });
}

export function useSubmitCount() {
  const invalidate = useInvalidateStoreData();
  return useMutation({
    mutationFn: (v: { lines: { product_id: number; counted_qty: number }[]; treatShortAs: 'loss' | 'sales'; note?: string }) =>
      unwrap(api.POST('/api/stock-count', { body: { lines: v.lines, treat_short_as: v.treatShortAs, note: v.note || null } })),
    onSuccess: invalidate,
  });
}

export function useBusinessReport() {
  return useQuery({ queryKey: queryKeys.report, queryFn: () => unwrap(api.GET('/api/reports/business')) });
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
