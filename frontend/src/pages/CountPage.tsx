import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Check, CheckCircle2, ClipboardCheck, Equal, History } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCountHistory, useCountSheet, useSubmitCount } from '@/api/queries';
import type { CountResult, CountSheetItem } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Stamp } from '@/components/ui/Fields';
import { ProductImage } from '@/components/ui/ProductImage';
import { ErrorBox, Skeleton } from '@/components/ui/QueryState';
import { PageTitle, Section } from '@/components/ui/Section';
import { Segmented } from '@/components/ui/Segmented';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn, formatDate, formatDateTime, formatNumber, formatPKR } from '@/lib/format';

function Row({ item, value, onChange }: { item: CountSheetItem; value: string | undefined; onChange: (v: string | undefined) => void }) {
  const { pick } = useLanguage();
  const counted = value !== undefined && value !== '';
  const diff = counted ? Number(value) - item.expected_qty : 0;
  return (
    <li className={cn('p-3 sm:p-4 flex flex-wrap items-center gap-3', counted && 'bg-sabz-50/70')}>
      <ProductImage src={item.image_url} alt="" className="w-12 h-12 shrink-0" />
      <div className="min-w-0 flex-1 basis-40">
        <p className="font-bold leading-snug">{item.name}</p>
        <p className="text-sm text-ink-muted">
          {pick('Records', 'Records')}: <strong className="text-ink tabular">{formatNumber(item.expected_qty, 2)}</strong> {item.unit}
          {item.last_counted_at && <span> · {pick('counted', 'gina')} {formatDate(item.last_counted_at)}</span>}
        </p>
        {counted && Math.abs(diff) > 1e-9 && (
          <p className={cn('text-sm font-bold', diff < 0 ? 'text-lal-dark' : 'text-haldi-dark')}>
            {diff < 0 ? pick(`${formatNumber(-diff, 2)} short (${formatPKR(-diff * item.cost_price)})`, `${formatNumber(-diff, 2)} kam (${formatPKR(-diff * item.cost_price)})`) : pick(`${formatNumber(diff, 2)} extra`, `${formatNumber(diff, 2)} zyada`)}
          </p>
        )}
        {counted && Math.abs(diff) <= 1e-9 && <p className="text-sm font-bold text-sabz-dark">{pick('Matches', 'Barabar')}</p>}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(String(item.expected_qty))} className={cn('min-h-[44px] px-3 rounded-xl border-2 text-sm font-bold inline-flex items-center gap-1', counted && Math.abs(diff) < 1e-9 ? 'bg-sabz border-sabz text-white' : 'border-line hover:border-ink-muted')} aria-label={pick(`${item.name}: same as records`, `${item.name}: records jitna`)}>
          <Equal className="w-4 h-4" />
          {pick('Same', 'Utna hi')}
        </button>
        <input
          inputMode="decimal"
          value={value ?? ''}
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d.]/g, '');
            onChange(v === '' ? undefined : v);
          }}
          placeholder={pick('Count', 'Ginti')}
          aria-label={pick(`Counted ${item.name}`, `${item.name} ki ginti`)}
          className="w-24 min-h-[48px] px-3 rounded-xl border-2 border-line-strong bg-card outline-none text-lg font-extrabold tabular text-center focus:border-sabz"
        />
      </div>
    </li>
  );
}

function Result({ r, onAgain }: { r: CountResult; onAgain: () => void }) {
  const { pick } = useLanguage();
  const reduce = useReducedMotion();
  const off = r.lines.filter((l) => Math.abs(l.difference_qty) > 1e-9);
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between gap-4 bg-card rounded-2xl border-2 border-sabz-mid p-5">
        <div>
          <p className="text-2xl font-extrabold text-sabz-dark">{pick('Count saved. Stock now matches the shelf.', 'Ginti save ho gayi. Stock ab shelf ke barabar.')}</p>
          <p className="text-base text-ink-soft mt-1">
            {pick(`${r.items_counted} items counted: ${r.items_matched} matched, ${r.items_short} short, ${r.items_extra} extra.`, `${r.items_counted} items gine: ${r.items_matched} barabar, ${r.items_short} kam, ${r.items_extra} zyada.`)}
          </p>
        </div>
        <Stamp urdu="گنتی" line={`${r.items_counted}`} tone="sabz" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className={cn('p-4 rounded-2xl', r.short_value_at_cost_pkr > 0 ? 'bg-lal-tint' : 'bg-card border border-line')}>
          <p className="text-sm font-bold text-ink-muted">{pick('Short on the shelf (at cost)', 'Shelf par kam (khareed qeemat)')}</p>
          <p className="text-2xl font-extrabold tabular">{formatPKR(r.short_value_at_cost_pkr)}</p>
        </div>
        {r.inferred_sale_id ? (
          <div className="p-4 rounded-2xl bg-sabz-tint">
            <p className="text-sm font-bold text-sabz-dark">{pick('Booked as cash sales not written down', 'Bina likhi cash sale ke tor par likha')}</p>
            <p className="text-2xl font-extrabold tabular">{formatPKR(r.inferred_sales_pkr)}</p>
            <p className="text-sm text-ink-soft">{pick('This is now expected in the cash box.', 'Yeh ab cash box mein hona chahiye.')}</p>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-card border border-line">
            <p className="text-sm font-bold text-ink-muted">{pick('Extra on the shelf (at cost)', 'Shelf par zyada (khareed qeemat)')}</p>
            <p className="text-2xl font-extrabold tabular">{formatPKR(r.extra_value_at_cost_pkr)}</p>
          </div>
        )}
      </div>
      {off.length > 0 && (
        <Section title={pick('Items that did not match', 'Jo barabar nahi the')}>
          <ul className="bg-card rounded-2xl border border-line divide-y divide-line">
            {off.map((l) => (
              <li key={l.product_id} className="p-4 space-y-1">
                <div className="flex justify-between gap-3">
                  <p className="font-bold">{l.name}</p>
                  <p className={cn('font-extrabold tabular shrink-0', l.difference_qty < 0 ? 'text-lal-dark' : 'text-haldi-dark')}>
                    {l.difference_qty > 0 ? '+' : '−'}
                    {formatNumber(Math.abs(l.difference_qty), 2)} {l.unit}
                  </p>
                </div>
                <p className="text-sm text-ink-muted">
                  {pick(`Records ${formatNumber(l.expected_qty, 2)}, counted ${formatNumber(l.counted_qty, 2)}.`, `Records ${formatNumber(l.expected_qty, 2)}, gine ${formatNumber(l.counted_qty, 2)}.`)}
                  {l.sold_since_last_count != null && l.recorded_sales_since_last_count != null && l.last_counted_at && (
                    <>
                      {' '}
                      {pick(
                        `Since the count on ${formatDate(l.last_counted_at)}: ${formatNumber(l.sold_since_last_count, 2)} left the shelf, ${formatNumber(l.recorded_sales_since_last_count, 2)} were billed.`,
                        `${formatDate(l.last_counted_at)} ki ginti se: ${formatNumber(l.sold_since_last_count, 2)} shelf se gaye, ${formatNumber(l.recorded_sales_since_last_count, 2)} ka bill bana.`,
                      )}
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Button variant="secondary" onClick={onAgain} icon={<ClipboardCheck className="w-5 h-5" />}>
        {pick('Count another shelf', 'Doosri shelf ginein')}
      </Button>
    </motion.div>
  );
}

export default function CountPage() {
  const { pick } = useLanguage();
  const [category, setCategory] = useState('');
  const sheet = useCountSheet(category);
  const history = useCountHistory();
  const submit = useSubmitCount();
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [treat, setTreat] = useState<'loss' | 'sales'>('loss');
  const categories = sheet.data?.categories ?? [];

  // Start on the first shelf.
  useEffect(() => {
    if (!category && categories[0]) setCategory(categories[0].category);
  }, [category, categories]);

  const entered = useMemo(() => Object.entries(counts).filter(([, v]) => v !== '' && v !== undefined), [counts]);
  const items = sheet.data?.category === category ? sheet.data.items : [];
  const countedHere = items.filter((i) => counts[i.product_id] !== undefined).length;

  const save = () =>
    submit.mutate(
      { lines: entered.map(([id, v]) => ({ product_id: Number(id), counted_qty: Number(v) })), treatShortAs: treat },
      { onSuccess: () => setCounts({}) },
    );

  return (
    <div className="space-y-6">
      <Link to="/app/stock" className="inline-flex items-center gap-2 min-h-[44px] font-bold text-ink-muted hover:text-ink">
        <ArrowLeft className="w-5 h-5" /> {pick('Stock', 'Stock')}
      </Link>
      <PageTitle
        title={pick('Ginti: count the shelf', 'Ginti: shelf ginein')}
        subtitle={pick('Count one shelf at a time. HisaabAI compares with the records, fixes the stock, and shows what went missing.', 'Ek waqt mein ek shelf ginein. HisaabAI records se milata hai, stock theek karta hai, aur batata hai kya kam hua.')}
      />

      {submit.isSuccess ? (
        <Result r={submit.data} onAgain={() => submit.reset()} />
      ) : (
        <>
          {sheet.isError && <ErrorBox error={sheet.error} onRetry={() => sheet.refetch()} />}
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
            <div role="tablist" aria-label={pick('Shelves', 'Shelves')} className="flex gap-2 pb-1 w-max">
              {categories.map((c) => (
                <button
                  key={c.category}
                  role="tab"
                  aria-selected={category === c.category}
                  onClick={() => setCategory(c.category)}
                  className={cn('min-h-[44px] px-4 rounded-full border-2 font-bold whitespace-nowrap', category === c.category ? 'bg-neela-700 text-white border-neela-700' : 'bg-card border-line text-ink-soft hover:border-neela-300')}
                >
                  {c.category} <span className="opacity-70">{c.items}</span>
                </button>
              ))}
            </div>
          </div>

          {!sheet.data && !sheet.isError && <Skeleton className="h-96" />}
          {items.length > 0 && (
            <>
              <p className="text-sm text-ink-muted">{pick(`${countedHere} of ${items.length} counted on this shelf. Leave an item empty to skip it.`, `Is shelf par ${items.length} mein se ${countedHere} gine. Kisi item ko chhorna ho to khali rehne dein.`)}</p>
              <ul className={cn('bg-card rounded-2xl border border-line shadow-card divide-y divide-line overflow-hidden transition-opacity', sheet.isFetching && 'opacity-60')}>
                {items.map((i) => (
                  <Row
                    key={i.product_id}
                    item={i}
                    value={counts[i.product_id]}
                    onChange={(v) =>
                      setCounts((c) => {
                        const next = { ...c };
                        if (v === undefined) delete next[i.product_id];
                        else next[i.product_id] = v;
                        return next;
                      })
                    }
                  />
                ))}
              </ul>
            </>
          )}

          {entered.length > 0 && (
            <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-4 z-10 bg-card rounded-2xl border border-line shadow-lift p-4 space-y-3">
              <div className="space-y-1">
                <p className="font-bold">{pick('If something is short, it was:', 'Agar kuch kam hai to woh:')}</p>
                <Segmented
                  label={pick('Shortfall is', 'Kami')}
                  value={treat}
                  onChange={setTreat}
                  options={[
                    { value: 'loss', label: pick('Lost or damaged', 'Kharab / gum') },
                    { value: 'sales', label: pick('Sold, not written', 'Bika, likha nahi') },
                  ]}
                />
                <p className="text-sm text-ink-muted">
                  {treat === 'loss'
                    ? pick('Written off at cost. Sales and the cash box do not change.', 'Khareed qeemat par nuqsaan likha jaye ga. Sale aur cash box nahi badle ga.')
                    : pick('Booked as cash sales at the shelf price, so the cash box should have that money.', 'Shelf ki qeemat par cash sale likhi jaye gi, yani yeh paisa cash box mein hona chahiye.')}
                </p>
              </div>
              <Button block size="lg" onClick={save} disabled={submit.isPending} icon={<Check className="w-6 h-6" />}>
                {submit.isPending ? pick('Saving', 'Save ho raha') : pick(`Save count (${entered.length} items)`, `Ginti save karein (${entered.length} items)`)}
              </Button>
              {submit.isError && <ErrorBox error={submit.error} />}
            </div>
          )}
        </>
      )}

      {history.data && history.data.length > 0 && (
        <Section title={pick('Past counts', 'Pichli ginti')}>
          <ul className="bg-card rounded-2xl border border-line divide-y divide-line">
            {history.data.map((h) => (
              <li key={h.count_id} className="p-4 flex items-center gap-3">
                <History className="w-5 h-5 text-ink-muted shrink-0" />
                <span className="flex-1">
                  <span className="block font-bold">{formatDateTime(h.timestamp)}</span>
                  <span className="block text-sm text-ink-muted">{pick(`${h.items_counted} items, ${h.items_matched} matched`, `${h.items_counted} items, ${h.items_matched} barabar`)}</span>
                </span>
                {h.short_value_at_cost_pkr > 0 ? (
                  <span className="font-bold text-lal-dark tabular">−{formatPKR(h.short_value_at_cost_pkr)}</span>
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-sabz" />
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
