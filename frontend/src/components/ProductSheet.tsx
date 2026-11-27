import confetti from 'canvas-confetti';
import { Check, ChevronDown, Minus, Plus, ShoppingCart } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdjustStock, useForecast, useInsights, useProduct, useUpdatePrice } from '@/api/queries';
import type { ProductDetail } from '@/api/types';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn, formatDate, formatNumber, formatPct, formatPKR } from '@/lib/format';
import { ForecastChart } from './ForecastChart';
import { Button } from './ui/Button';
import { ProductImage } from './ui/ProductImage';
import { ErrorBox, Skeleton } from './ui/QueryState';
import { Sheet } from './ui/Sheet';
import { Pill, StockStatus } from './ui/Status';

function Fact({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="p-3 sm:p-4 rounded-2xl bg-card border border-line">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className={cn('text-xl font-extrabold tabular leading-tight mt-0.5', tone)}>{value}</p>
      <p className="text-xs text-ink-muted mt-0.5">{sub}</p>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-bold">{title}</h3>
      {children}
    </section>
  );
}

function PriceForm({ p }: { p: ProductDetail }) {
  const { pick } = useLanguage();
  const insights = useInsights();
  const squeeze = insights.data?.margin_squeezes.find((s) => s.product_id === p.product_id);
  const suggested = squeeze?.recommended_selling_price_pkr ?? p.selling_price;
  const [price, setPrice] = useState(String(suggested));
  const update = useUpdatePrice();
  useEffect(() => setPrice(String(suggested)), [suggested]);
  const value = Number(price);
  const valid = value > 0;
  const margin = valid ? ((value - p.cost_price) / value) * 100 : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid || value === p.selling_price) return;
    update.mutate(
      { productId: p.product_id, price: value, reason: squeeze ? 'Raised after supplier cost increase' : 'Shelf price changed' },
      { onSuccess: () => confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } }) },
    );
  };

  return (
    <Block title={pick('Shelf price', 'Shelf ki qeemat')}>
      {squeeze && (
        <div className="p-4 rounded-2xl bg-haldi-tint text-haldi-dark text-base">
          <p className="font-bold">{pick('The supplier raised the cost, but your price did not change.', 'Supplier ne rate barhaya, magar aap ki qeemat wahi hai.')}</p>
          <p className="mt-1">
            {pick(
              `Cost ${formatPKR(squeeze.previous_cost_pkr)} → ${formatPKR(squeeze.current_cost_pkr)}. At ${formatPKR(squeeze.recommended_selling_price_pkr)} your margin is back to ${squeeze.previous_margin_pct}%.`,
              `Khareed ${formatPKR(squeeze.previous_cost_pkr)} → ${formatPKR(squeeze.current_cost_pkr)}. ${formatPKR(squeeze.recommended_selling_price_pkr)} par munafa wapas ${squeeze.previous_margin_pct}% ho jaye ga.`,
            )}
          </p>
        </div>
      )}
      <form onSubmit={submit} className="flex gap-2">
        <div className="flex-1 flex items-center rounded-xl border-2 border-line-strong bg-card px-3 focus-within:border-sabz">
          <span className="font-bold text-ink-muted">Rs</span>
          <input
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            aria-label={pick('New shelf price', 'Nayi qeemat')}
            className="w-full min-h-[48px] bg-transparent outline-none px-2 text-xl font-bold tabular"
          />
        </div>
        <Button type="submit" disabled={!valid || value === p.selling_price || update.isPending}>
          {update.isPending ? pick('Saving', 'Save ho raha') : pick('Save price', 'Qeemat save')}
        </Button>
      </form>
      <p className={cn('text-base', margin !== null && margin < 0 ? 'text-lal-dark font-bold' : 'text-ink-muted')}>
        {pick('Now', 'Abhi')} {formatPKR(p.selling_price)}, {pick('cost', 'khareed')} {formatPKR(p.cost_price)}.{' '}
        {margin !== null && pick(`Margin at the new price: ${formatPct(margin)}`, `Nayi qeemat par munafa: ${formatPct(margin)}`)}
        {margin !== null && margin < 0 && pick(' (below cost)', ' (khareed se kam)')}
      </p>
      {update.isSuccess && (
        <p className="flex items-center gap-2 font-bold text-sabz-dark">
          <Check className="w-5 h-5" /> {pick('Price saved.', 'Qeemat save ho gayi.')}
        </p>
      )}
      {update.isError && <p className="font-bold text-lal-dark">{update.error.message}</p>}
    </Block>
  );
}

function StockForm({ p }: { p: ProductDetail }) {
  const { pick } = useLanguage();
  const pack = p.pack_info;
  const [dir, setDir] = useState<1 | -1>(1);
  const [qty, setQty] = useState('');
  const adjust = useAdjustStock();
  const value = Number(qty);
  const valid = value > 0 && (dir === 1 || value <= p.stock_qty);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    adjust.mutate(
      { productId: p.product_id, change: dir * value, reason: dir === 1 ? 'Delivery received' : 'Damaged or lost' },
      { onSuccess: () => setQty('') },
    );
  };

  return (
    <Block title={pick('Update stock', 'Stock darj karein')}>
      <div role="radiogroup" aria-label={pick('Stock change', 'Stock tabdeeli')} className="grid grid-cols-2 gap-2">
        <button role="radio" aria-checked={dir === 1} onClick={() => setDir(1)} className={cn('min-h-[48px] rounded-xl border-2 font-bold flex items-center justify-center gap-2', dir === 1 ? 'border-sabz bg-sabz-tint text-sabz-dark' : 'border-line bg-card')}>
          <Plus className="w-5 h-5" /> {pick('Delivery came', 'Maal aaya')}
        </button>
        <button role="radio" aria-checked={dir === -1} onClick={() => setDir(-1)} className={cn('min-h-[48px] rounded-xl border-2 font-bold flex items-center justify-center gap-2', dir === -1 ? 'border-lal bg-lal-tint text-lal-dark' : 'border-line bg-card')}>
          <Minus className="w-5 h-5" /> {pick('Damaged or lost', 'Kharab ya gum')}
        </button>
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <div className="flex-1 flex items-center rounded-xl border-2 border-line-strong bg-card px-3 focus-within:border-sabz">
          <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" aria-label={pick('Quantity', 'Miqdar')} className="w-full min-h-[48px] bg-transparent outline-none text-xl font-bold tabular" />
          <span className="font-bold text-ink-muted">{p.unit}</span>
        </div>
        <Button type="submit" disabled={!valid || adjust.isPending}>
          {pick('Save', 'Save')}
        </Button>
      </form>
      {pack && dir === 1 && (
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((n) => (
            <button key={n} type="button" onClick={() => setQty(String(n * pack.units_per_pack))} className="min-h-[40px] px-3 rounded-full border-2 border-line text-sm font-bold hover:border-ink-muted">
              {n} {pack.pack_unit} = {n * pack.units_per_pack} {p.unit}
            </button>
          ))}
        </div>
      )}
      {dir === -1 && value > p.stock_qty && <p className="font-bold text-lal-dark">{pick(`Only ${p.stock_qty} in stock.`, `Sirf ${p.stock_qty} stock mein hai.`)}</p>}
      {adjust.isSuccess && (
        <p className="flex items-center gap-2 font-bold text-sabz-dark">
          <Check className="w-5 h-5" /> {pick(`Stock is now ${adjust.data.new_stock} ${p.unit}.`, `Ab stock ${adjust.data.new_stock} ${p.unit} hai.`)}
        </p>
      )}
      {adjust.isError && <p className="font-bold text-lal-dark">{adjust.error.message}</p>}
    </Block>
  );
}

function ForecastBlock({ p }: { p: ProductDetail }) {
  const { pick } = useLanguage();
  const fc = useForecast({ productId: p.product_id });
  const f = fc.data;
  const tone = f?.quality_label === 'Good' ? 'ok' : f?.quality_label === 'Fair' ? 'watch' : 'neutral';
  const label: Record<string, [string, string]> = {
    Good: ['Reliable', 'Bharose layak'],
    Fair: ['Fairly reliable', 'Kaafi had tak theek'],
    Low: ['Rough guess', 'Mota andaza'],
    Sparse: ['Sells rarely', 'Kabhi kabhi bikta hai'],
    Unknown: ['Too new to tell', 'Abhi nahi keh sakte'],
  };
  return (
    <Block title={pick('Sales and what to expect', 'Sale aur aage ka andaza')}>
      {fc.isError && <ErrorBox error={fc.error} onRetry={() => fc.refetch()} />}
      {!f && !fc.isError && <Skeleton className="h-48" />}
      {f && (
        <div className="p-4 rounded-2xl bg-card border border-line space-y-3">
          <ForecastChart forecast={f} unit={p.unit} />
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={tone}>{pick(...(label[f.quality_label] ?? label.Unknown!))}</Pill>
            <span className="text-sm text-ink-muted">{f.quality_reason}</span>
          </div>
          <details className="group">
            <summary className="cursor-pointer list-none min-h-[44px] flex items-center gap-2 font-bold text-ink-muted">
              <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
              {pick('How was this tested?', 'Yeh kaise test hua?')}
            </summary>
            <p className="text-sm text-ink-soft">{f.selection_reason}</p>
            <table className="w-full text-sm mt-2">
              <thead>
                <tr className="text-left text-ink-muted">
                  <th className="font-bold py-1">{pick('Method', 'Tareeqa')}</th>
                  <th className="font-bold py-1 text-right">{pick('Daily error', 'Rozana ghalati')}</th>
                  <th className="font-bold py-1 text-right">{pick('14-day total error', '14 din kul ghalati')}</th>
                </tr>
              </thead>
              <tbody>
                {f.model_comparison.map((m) => (
                  <tr key={m.model} className={m.model === f.model_used ? 'font-bold text-sabz-dark' : ''}>
                    <td className="py-1">{m.label}{m.model === f.model_used ? ` (${pick('used', 'istemal')})` : ''}</td>
                    <td className="py-1 text-right tabular">{formatPct(m.wape_pct)}</td>
                    <td className="py-1 text-right tabular">{formatPct(m.total_error_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {f.learned_calendar_effects.length > 0 && (
              <p className="text-sm text-ink-muted mt-2">
                {pick('Learned from last year', 'Pichle saal se seekha')}: {f.learned_calendar_effects.map((e) => `${e.event} ×${e.multiplier}`).join(', ')}
              </p>
            )}
            <p className="text-xs text-ink-faint mt-2">{pick('Tested on simulated demo data. Not a claim about real shops.', 'Demo ke farzi data par test. Asal dukaanon ka daawa nahi.')}</p>
          </details>
        </div>
      )}
    </Block>
  );
}

export function ProductSheet({ productId, onClose }: { productId: number | null; onClose: () => void }) {
  const { pick } = useLanguage();
  const navigate = useNavigate();
  const q = useProduct(productId);
  const p = q.data;
  const needsOrder = p && (p.stockout_risk === 'critical' || p.stockout_risk === 'high');

  return (
    <Sheet
      open={productId !== null}
      onClose={onClose}
      width="lg"
      title={
        <span className="flex items-center gap-3">
          {p && <ProductImage src={p.image_url} alt="" className="w-12 h-12 shrink-0" />}
          <span>{p?.name ?? '...'}</span>
        </span>
      }
    >
      {q.isError && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
      {!p && !q.isError && <Skeleton className="h-96" />}
      {p && (
        <div className="space-y-7">
          <div className="space-y-2">
            <StockStatus risk={p.stockout_risk} dead={p.is_dead_stock} />
            <p className="text-lg text-ink-soft">{pick(p.risk_reason, p.risk_reason_ur)}</p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Fact
              label={pick('In stock', 'Stock mein')}
              value={`${formatNumber(p.stock_qty)} ${p.unit}`}
              sub={p.pending_receipts ? pick(`${formatNumber(p.pending_receipts)} on the way`, `${formatNumber(p.pending_receipts)} raste mein`) : pick('none on the way', 'raste mein kuch nahi')}
            />
            <Fact
              label={pick('Lasts', 'Chalega')}
              value={p.days_of_cover !== null ? pick(`${formatNumber(p.days_of_cover, 1)} days`, `${formatNumber(p.days_of_cover, 1)} din`) : '—'}
              tone={p.stockout_risk === 'critical' ? 'text-lal-dark' : undefined}
              sub={pick(`delivery takes ${p.lead_time_days} days`, `maal ${p.lead_time_days} din mein aata hai`)}
            />
            <Fact
              label={pick('Sells', 'Bikta hai')}
              value={p.average_daily_demand ? `${formatNumber(p.average_daily_demand, 1)}` : '—'}
              sub={pick(`${p.unit} a day`, `${p.unit} rozana`)}
            />
          </div>

          {needsOrder && (
            <Button
              size="lg"
              block
              icon={<ShoppingCart className="w-5 h-5" />}
              onClick={() => {
                onClose();
                navigate('/app/buy');
              }}
            >
              {pick('Add to today’s order list', 'Aaj ke order mein dekhein')}
            </Button>
          )}

          <PriceForm p={p} />
          <StockForm p={p} />
          <ForecastBlock p={p} />

          <details className="group">
            <summary className="cursor-pointer list-none min-h-[44px] flex items-center gap-2 text-lg font-bold">
              <ChevronDown className="w-5 h-5 transition-transform group-open:rotate-180" />
              {pick('Price history', 'Qeemat ki tareekh')}
            </summary>
            <ul className="bg-card rounded-2xl border border-line divide-y divide-line mt-2">
              {p.price_history.map((h) => (
                <li key={`${h.effective_date}-${h.cost_price}-${h.selling_price}`} className="px-4 py-3">
                  <div className="flex justify-between gap-3">
                    <span className="font-bold tabular">
                      {formatPKR(h.cost_price)} → {formatPKR(h.selling_price)}
                    </span>
                    <span className="text-sm text-ink-muted">{formatDate(h.effective_date, true)}</span>
                  </div>
                  <p className="text-sm text-ink-muted">
                    {h.reason}. {pick('Margin', 'Munafa')} {formatPct(h.margin_pct)}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </Sheet>
  );
}

export default ProductSheet;
