import { ChevronRight, ClipboardCheck, PackageSearch, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useProducts, type ProductFilters } from '@/api/queries';
import type { Product } from '@/api/types';
import { useUi } from '@/app/UiContext';
import { ProductImage } from '@/components/ui/ProductImage';
import { EmptyState, ErrorBox, Skeleton } from '@/components/ui/QueryState';
import { PageTitle } from '@/components/ui/Section';
import { StockStatus } from '@/components/ui/Status';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn, formatNumber, formatPKR } from '@/lib/format';
import { useDebounced } from '@/lib/useDebounced';

type Status = NonNullable<ProductFilters['status']>;

// Most worrying first, so the eye lands on what needs action.
const FILTERS: { id: Status; en: string; ur: string }[] = [
  { id: 'all', en: 'All', ur: 'Sab' },
  { id: 'at_risk', en: 'Running low', ur: 'Kam hai' },
  { id: 'out_of_stock', en: 'Finished', ur: 'Khatam' },
  { id: 'medium', en: 'Order soon', ur: 'Jald mangwayein' },
  { id: 'dead_stock', en: 'Not selling', ur: 'Nahi bik raha' },
];

function lasts(p: Product, pick: (en: string, ur: string) => string): string {
  if (p.is_out_of_stock) return pick('Finished', 'Khatam ho gaya');
  if (p.days_of_cover === null) return pick('Not enough sales to tell', 'Sale kam, andaza nahi');
  return pick(`Lasts ${formatNumber(p.days_of_cover, 1)} days`, `${formatNumber(p.days_of_cover, 1)} din chalega`);
}

export default function StockPage() {
  const { pick } = useLanguage();
  const ui = useUi();
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as Status | null) ?? 'all';
  const category = params.get('category') ?? '';
  const q = params.get('q') ?? '';
  const search = useDebounced(q, 250);
  const query = useProducts({ search, category, status, sort: 'risk' });
  const data = query.data;

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value && value !== 'all') next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-5">
      <PageTitle
        title={pick('Stock', 'Stock')}
        subtitle={pick('Items that will run out soonest are at the top.', 'Jo maal jaldi khatam hoga woh sab se upar hai.')}
      />

      <Link to="/app/stock/count" data-tour="ginti" className="group flex items-center gap-4 p-4 rounded-2xl bg-neela-50 border-2 border-neela-200 hover:border-neela-400 transition-colors">
        <span className="w-12 h-12 rounded-full bg-neela-600 text-white flex items-center justify-center shrink-0">
          <ClipboardCheck className="w-6 h-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-extrabold text-neela-950">{pick('Ginti: count a shelf', 'Ginti: shelf ginein')}</span>
          <span className="block text-sm text-ink-soft">{pick('Fix the stock to what is really there, and see what went missing.', 'Stock ko asal ke mutabiq karein, aur dekhein kya kam hua.')}</span>
        </span>
        <ChevronRight className="w-6 h-6 text-neela-600 group-hover:text-neela-900" />
      </Link>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => set('q', e.target.value)}
          placeholder={pick('Search, e.g. Dalda, Surf, atta', 'Talash karein, e.g. Dalda, Surf, atta')}
          aria-label={pick('Search products', 'Product talash karein')}
          className="w-full min-h-[56px] pl-12 pr-4 rounded-2xl bg-card border-2 border-line focus:border-neela-600 outline-none text-lg"
        />
      </div>

      <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={pick('Filter', 'Filter')}>
        {FILTERS.map((f) => {
          const count = data?.counts_by_risk[f.id] ?? 0;
          const active = status === f.id;
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={active}
              onClick={() => set('status', f.id)}
              className={cn(
                'shrink-0 min-h-[44px] px-4 rounded-full font-bold border-2 whitespace-nowrap',
                active ? 'bg-neela-700 text-white border-neela-700' : 'bg-card text-ink-soft border-line hover:border-neela-300',
              )}
            >
              {pick(f.en, f.ur)} <span className={cn('ml-1 tabular', active ? 'text-white/70' : 'text-ink-faint')}>{count}</span>
            </button>
          );
        })}
      </div>

      {data && (
        <select
          value={category}
          onChange={(e) => set('category', e.target.value)}
          aria-label={pick('Category', 'Category')}
          className="w-full sm:w-80 min-h-[48px] px-3 rounded-xl bg-card border-2 border-line text-base"
        >
          <option value="">{pick('All categories', 'Tamam categories')}</option>
          {data.categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      )}

      {query.isError && <ErrorBox error={query.error} onRetry={() => query.refetch()} />}
      {!data && !query.isError && <Skeleton className="h-96" />}
      {data && data.products.length === 0 && (
        <EmptyState icon={<PackageSearch className="w-7 h-7" />} title={pick('No products match', 'Koi product nahi mila')}>
          {pick('Try another name or remove a filter.', 'Doosra naam likhein ya filter hatayein.')}
        </EmptyState>
      )}
      {data && data.products.length > 0 && (
        <ul className={cn('bg-card rounded-2xl border border-line shadow-card divide-y divide-line overflow-hidden', query.isFetching && 'opacity-70')}>
          {data.products.map((p) => (
            <li key={p.product_id}>
              <button onClick={() => ui.openProduct(p.product_id)} className="w-full text-left flex items-center gap-3 p-4 hover:bg-paper">
                <ProductImage src={p.image_url} alt="" className="w-14 h-14 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink truncate">{p.name}</p>
                  <p className="text-sm text-ink-muted">
                    {formatNumber(p.stock_qty)} {p.unit} {pick('in stock', 'stock mein')}, {lasts(p, pick)}
                  </p>
                  <p className="text-sm text-ink-faint">
                    {pick('Sells at', 'Qeemat')} {formatPKR(p.selling_price)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StockStatus risk={p.stockout_risk} dead={p.is_dead_stock} className="hidden sm:inline-flex" />
                  <ChevronRight className="w-5 h-5 text-ink-faint" />
                </div>
              </button>
              <div className="sm:hidden px-4 pb-3 -mt-1 pl-[5.25rem]">
                <StockStatus risk={p.stockout_risk} dead={p.is_dead_stock} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
