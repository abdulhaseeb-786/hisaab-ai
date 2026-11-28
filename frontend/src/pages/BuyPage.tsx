import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, ClipboardList, PackageCheck, SlidersHorizontal, Truck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useCreateOrdersFromPlan, useReorderPlan, useStore } from '@/api/queries';
import type { PlanOrdersCreated, ReorderLine, ReorderPlan, StoreProfile } from '@/api/types';
import { useUi } from '@/app/UiContext';
import { MessageDraft, type Draft } from '@/components/MessageDraft';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { ProductImage } from '@/components/ui/ProductImage';
import { EmptyState, ErrorBox, Skeleton } from '@/components/ui/QueryState';
import { Section } from '@/components/ui/Section';
import { Segmented } from '@/components/ui/Segmented';
import { StockStatus } from '@/components/ui/Status';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn, formatNumber, formatPKR } from '@/lib/format';
import { useDebounced } from '@/lib/useDebounced';

const PRESETS = [25_000, 50_000, 75_000, 100_000];
const MIN = 1_000;
const MAX = 10_000_000;

function orderText(lines: ReorderLine[], store: StoreProfile | undefined): Draft {
  const groups = new Map<string, ReorderLine[]>();
  for (const l of lines) groups.set(l.supplier_name, [...(groups.get(l.supplier_name) ?? []), l]);
  const date = new Date().toLocaleDateString('en-PK');
  const total = lines.reduce((s, l) => s + l.line_total_cost_pkr, 0);
  const make = (est: string, sum: string) => {
    const blocks = [...groups.entries()].map(([name, items]) => {
      const t = items.reduce((s, l) => s + l.line_total_cost_pkr, 0);
      return [`*${name}*`, ...items.map((l) => `- ${l.product_name}: ${l.recommended_packs} ${l.pack_unit}`), `${est}: ${formatPKR(t)}`].join('\n');
    });
    const head = [`*Order: ${store?.name ?? ''}*`, `${store?.location ?? ''}, ${date}`, ''];
    const tail = groups.size > 1 ? [`*${sum}: ${formatPKR(total)}*`] : [];
    return [...head, ...blocks.flatMap((b) => [b, '']), ...tail].join('\n').trim();
  };
  return { roman_urdu: make('Andaaza', 'Kul'), english: make('Estimate', 'Total') };
}

function Line({ line }: { line: ReorderLine }) {
  const { pick, language } = useLanguage();
  const ui = useUi();
  const [open, setOpen] = useState(false);
  const reasons = language === 'roman_urdu' ? line.reasons_ur : line.reasons;
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12, transition: { duration: 0.15 } }}
      transition={{ duration: 0.25 }}
      className="py-4 first:pt-0 last:pb-0"
    >
      <div className="flex items-start gap-3">
        <button onClick={() => ui.openProduct(line.product_id)} className="shrink-0" aria-label={line.product_name}>
          <ProductImage src={line.image_url} alt="" className="w-14 h-14" />
        </button>
        <div className="min-w-0 flex-1">
          <button onClick={() => ui.openProduct(line.product_id)} className="text-left font-bold text-ink leading-snug hover:underline">
            {line.product_name}
          </button>
          <p className="text-sm text-ink-muted mt-0.5">
            {pick('Stock lasts', 'Stock')} {formatNumber(line.days_of_cover_before, 1)} {pick('days now', 'din ka')}, {pick('then', 'phir')}{' '}
            <strong className="text-sabz-dark">{formatNumber(line.projected_cover_after)} {pick('days', 'din')}</strong>
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-extrabold text-ink tabular">
            {line.recommended_packs} {line.pack_unit}
          </p>
          <p className="text-sm text-ink-muted tabular">{formatPKR(line.line_total_cost_pkr)}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-2 pl-[4.25rem]">
        <StockStatus risk={line.stockout_risk} />
        {line.is_reduced_by_budget && (
          <span className="text-sm text-haldi-dark font-bold">
            {pick(`${line.recommended_packs} of ${line.needed_packs} fit the budget`, `${line.needed_packs} mein se ${line.recommended_packs} budget mein`)}
          </span>
        )}
        <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="ml-auto min-h-[44px] px-2 inline-flex items-center gap-1 text-sm font-bold text-ink-muted hover:text-ink">
          {pick('Why?', 'Kyun?')}
          <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
        </button>
      </div>
      {open && (
        <ul className="mt-1 ml-[4.25rem] p-3 rounded-xl bg-paper border border-line space-y-1 text-base text-ink-soft list-disc list-inside">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </motion.li>
  );
}

function OrderDraft({ lines, title, store, draftOverride }: { lines: ReorderLine[]; title: string; store: StoreProfile | undefined; draftOverride?: Draft }) {
  const { pick } = useLanguage();
  const [open, setOpen] = useState(false);
  const draft = useMemo(() => draftOverride ?? orderText(lines, store), [lines, store, draftOverride]);
  return (
    <div className="space-y-3">
      <Button variant={open ? 'secondary' : 'primary'} size="sm" icon={<ClipboardList className="w-5 h-5" />} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? pick('Hide order text', 'Order chhupayein') : pick('Show order text', 'Order dikhayein')}
      </Button>
      {open && <MessageDraft draft={draft} title={title} editable />}
    </div>
  );
}

function Plan({ plan, stale, onSave, saving }: { plan: ReorderPlan; stale: boolean; onSave: () => void; saving: boolean }) {
  const { pick } = useLanguage();
  const store = useStore();
  const [view, setView] = useState<'urgency' | 'supplier'>('urgency');
  const lines = plan.recommendations;
  const bySupplier = useMemo(() => {
    const m = new Map<string, ReorderLine[]>();
    for (const l of lines) m.set(l.supplier_name, [...(m.get(l.supplier_name) ?? []), l]);
    return [...m.entries()];
  }, [lines]);

  if (!lines.length) {
    return (
      <EmptyState icon={<Check className="w-7 h-7" />} title={plan.items_needing_reorder ? pick('No whole pack fits this budget', 'Is budget mein koi poora pack nahi aata') : pick('Nothing needs buying right now', 'Abhi kuch khareedne ki zaroorat nahi')}>
        {plan.items_needing_reorder ? pick('Try a bigger amount.', 'Zyada raqam likh kar dekhein.') : null}
      </EmptyState>
    );
  }

  return (
    <div className={cn('space-y-6 transition-opacity', stale && 'opacity-60')}>
      <div className="bg-card rounded-2xl border border-line shadow-card p-5 space-y-4">
        <p className="text-xl font-extrabold leading-snug">
          {pick(
            `${plan.total_skus_recommended} items for `,
            `${plan.total_skus_recommended} cheezein, `,
          )}
          <Money value={plan.total_allocated_spend_pkr} className="tabular" />
          {pick('.', ' mein.')}{' '}
          <span className="text-ink-muted font-bold">
            {pick(`${formatPKR(plan.remaining_unallocated_pkr)} stays with you.`, `${formatPKR(plan.remaining_unallocated_pkr)} bachein ge.`)}
          </span>
        </p>
        <div className="h-3 rounded-full bg-ink/[0.07] overflow-hidden" role="progressbar" aria-valuenow={Math.round(plan.budget_used_pct)} aria-valuemin={0} aria-valuemax={100} aria-label={pick('Budget used', 'Budget istemal')}>
          <motion.div className="h-full bg-sabz rounded-full" initial={false} animate={{ width: `${Math.min(100, plan.budget_used_pct)}%` }} transition={{ duration: 0.5 }} />
        </div>
        <ul className="text-base text-ink-soft space-y-1">
          <li>
            {pick('When it sells, this stock brings in about', 'Yeh maal bik kar takreeban')} <strong className="text-ink">{formatPKR(plan.projected_revenue_pkr)}</strong>
            {pick(', with', ' laye ga, jis mein')} <strong className="text-sabz-dark">{formatPKR(plan.projected_gross_profit_pkr)}</strong> {pick('gross profit.', 'gross munafa.')}
          </li>
          {plan.budget_to_cover_everything_pkr > plan.budget_entered_pkr && (
            <li>
              {pick(
                `To stock all ${plan.items_needing_reorder} items that need it would take about ${formatPKR(plan.budget_to_cover_everything_pkr)}.`,
                `Sab ${plan.items_needing_reorder} zaroori items poore karne ke liye takreeban ${formatPKR(plan.budget_to_cover_everything_pkr)} chahiye.`,
              )}
            </li>
          )}
        </ul>
      </div>

      <Section
        title={pick('Your order', 'Aap ka order')}
        action={
          <Segmented
            label={pick('Sort the order', 'Order ki tarteeb')}
            value={view}
            onChange={setView}
            options={[
              { value: 'urgency', label: pick('Most urgent', 'Zaroori pehle') },
              { value: 'supplier', label: pick('By supplier', 'Supplier wise') },
            ]}
          />
        }
      >
        {view === 'urgency' ? (
          <div className="bg-card rounded-2xl border border-line shadow-card p-4 sm:p-5">
            <ol className="divide-y divide-line">
              <AnimatePresence initial={false}>
                {lines.map((l) => (
                  <Line key={l.product_id} line={l} />
                ))}
              </AnimatePresence>
            </ol>
          </div>
        ) : (
          <div className="space-y-4">
            {bySupplier.map(([name, items]) => (
              <div key={name} className="bg-card rounded-2xl border border-line shadow-card p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-line">
                  <div>
                    <p className="text-lg font-extrabold">{name}</p>
                    <p className="text-sm text-ink-muted">
                      {items.length} {pick('items', 'items')}, {formatPKR(items.reduce((s, l) => s + l.line_total_cost_pkr, 0))}
                    </p>
                  </div>
                </div>
                <div className="mb-3">
                  <OrderDraft lines={items} store={store.data} title={pick(`Order for ${name}`, `${name} ka order`)} />
                </div>
                <ol className="divide-y divide-line">
                  {items.map((l) => (
                    <Line key={l.product_id} line={l} />
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </Section>

      {plan.skipped_count > 0 && (
        <details className="bg-card rounded-2xl border border-line p-5 group">
          <summary className="cursor-pointer font-bold text-ink-soft list-none flex items-center gap-2 min-h-[44px]">
            <ChevronDown className="w-5 h-5 transition-transform group-open:rotate-180" />
            {pick(`${plan.skipped_count} more items need stock but did not fit`, `${plan.skipped_count} aur items ko stock chahiye, budget mein nahi aaye`)}
          </summary>
          <ul className="mt-2 divide-y divide-line">
            {plan.skipped.map((s) => (
              <li key={s.product_id} className="flex justify-between gap-3 py-2 text-base">
                <span>{s.product_name}</span>
                <span className="text-ink-muted shrink-0 tabular">
                  {formatPKR(s.cost_of_one_pack_pkr)} / {s.pack_unit}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <details className="text-sm text-ink-muted">
        <summary className="cursor-pointer font-bold min-h-[44px] flex items-center">{pick('How is the list made?', 'List kaise banti hai?')}</summary>
        <p className="mt-1">{plan.ranking_rule}</p>
      </details>

      <div className="bg-card rounded-2xl border border-line p-5 space-y-3">
        <p className="text-lg font-extrabold">
          {pick('Whole order', 'Poora order')}: <span className="tabular">{formatPKR(plan.total_allocated_spend_pkr)}</span>
        </p>
        <Button size="lg" block disabled={stale || saving} onClick={onSave} icon={<Truck className="w-5 h-5" />}>
          {saving
            ? pick('Saving', 'Save ho raha')
            : pick(`Save as orders (${bySupplier.length} distributors)`, `Order save karein (${bySupplier.length} distributors)`)}
        </Button>
        <p className="text-sm text-ink-muted">
          {pick(
            'Saved orders wait under "On the way". When each delivery comes, tap Maal aaya: the bill is checked and stock goes up.',
            'Save shuda orders "Raste mein" mein rehte hain. Jab maal aaye, "Maal aaya" dabayein: bill check hoga aur stock barhe ga.',
          )}
        </p>
        <MessageDraft draft={orderText(lines, store.data)} title={pick('Order list to read out or copy', 'Parhne ya copy karne ke liye order list')} editable />
      </div>
    </div>
  );
}

function SavedOrders({ r, onDone }: { r: PlanOrdersCreated; onDone: () => void }) {
  const { pick } = useLanguage();
  return (
    <div className="bg-sabz-tint border-2 border-sabz rounded-2xl p-5 space-y-4" role="status">
      <p className="flex items-center gap-2 text-xl font-extrabold text-sabz-dark">
        <PackageCheck className="w-6 h-6" />
        {pick(`${r.orders.length} orders saved: ${formatPKR(r.total_pkr)}`, `${r.orders.length} order save ho gaye: ${formatPKR(r.total_pkr)}`)}
      </p>
      <p className="text-base text-ink-soft">
        {pick('They are under "On the way" above. Tap Maal aaya when each delivery comes.', 'Yeh upar "Raste mein" mein hain. Har maal aane par "Maal aaya" dabayein.')}
      </p>
      <ul className="space-y-3">
        {r.orders.map((o) => (
          <li key={o.purchase_id} className="bg-card rounded-xl border border-line p-3 space-y-2">
            <p className="flex justify-between gap-3 font-bold">
              <span>{o.supplier_name}</span>
              <span className="tabular">{formatPKR(o.total_pkr)}</span>
            </p>
            <OrderDraft lines={[]} store={undefined} title={pick(`Order for ${o.supplier_name}`, `${o.supplier_name} ka order`)} draftOverride={o.draft} />
          </li>
        ))}
      </ul>
      <Button variant="secondary" onClick={onDone}>{pick('Plan again', 'Naya plan')}</Button>
    </div>
  );
}

/** "I have Rs 50,000: what should I buy?" for the whole shop, saved as real orders. */
export function BudgetPlanner() {
  const { pick } = useLanguage();
  const save = useCreateOrdersFromPlan();
  const [input, setInput] = useState('50000');
  const [cover, setCover] = useState(14);
  const [options, setOptions] = useState(false);
  const amount = Number(input.replace(/\D/g, ''));
  const valid = amount >= MIN && amount <= MAX;
  const budget = useDebounced(valid ? amount : 0, 400);
  const plan = useReorderPlan(budget, cover);
  const stale = plan.isFetching || (valid && budget !== amount);

  return (
    <div className="space-y-6">
      <p className="text-base text-ink-soft">
        {pick('Going to the market yourself? Type your budget: a list in whole cartons for the whole shop, most urgent first, never over budget.', 'Khud market ja rahe hain? Budget likhein: poori dukaan ki list poore carton mein, zaroori maal pehle, budget se zyada kabhi nahi.')}
      </p>

      <div className="bg-card rounded-2xl border border-line shadow-card p-5 space-y-4">
        <label htmlFor="budget" className="block text-lg font-bold">
          {pick('How much can you spend today?', 'Aaj kitna kharch kar sakte hain?')}
        </label>
        <div className={cn('flex items-center rounded-2xl border-2 bg-paper px-4 focus-within:border-sabz', valid ? 'border-line-strong' : 'border-lal')}>
          <span className="text-2xl font-extrabold text-ink-muted">Rs</span>
          <input
            id="budget"
            inputMode="numeric"
            autoComplete="off"
            value={input ? formatNumber(amount) : ''}
            onChange={(e) => setInput(e.target.value)}
            aria-invalid={!valid}
            aria-describedby="budget-help"
            className="w-full bg-transparent outline-none px-3 py-3 text-3xl font-extrabold tabular"
          />
        </div>
        <p id="budget-help" className={cn('text-sm', valid ? 'text-ink-muted' : 'text-lal-dark font-bold')}>
          {valid ? pick('Or pick an amount:', 'Ya raqam chunein:') : pick('Type an amount between Rs 1,000 and Rs 10,000,000.', 'Rs 1,000 se Rs 10,000,000 ke darmiyan raqam likhein.')}
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setInput(String(p))}
              aria-pressed={amount === p}
              className={cn('min-h-[44px] px-4 rounded-xl font-bold border-2 tabular', amount === p ? 'bg-sabz-tint border-sabz text-sabz-dark' : 'bg-card border-line text-ink-soft hover:border-ink-muted')}
            >
              {p === 100_000 ? pick('Rs 1 lakh', 'Rs 1 lakh') : formatPKR(p)}
            </button>
          ))}
        </div>
        <button onClick={() => setOptions((v) => !v)} aria-expanded={options} className="inline-flex items-center gap-2 min-h-[44px] font-bold text-ink-muted hover:text-ink">
          <SlidersHorizontal className="w-5 h-5" />
          {pick('Options', 'Options')}
        </button>
        {options && (
          <div className="space-y-2">
            <p className="font-bold">{pick('Buy enough stock for', 'Kitne din ka stock khareedein')}</p>
            <Segmented
              label={pick('Days of stock', 'Kitne din')}
              value={cover}
              onChange={setCover}
              options={[7, 14, 21].map((d) => ({ value: d, label: pick(`${d} days`, `${d} din`) }))}
            />
          </div>
        )}
      </div>

      {/* The save result lives here, not in <Plan>: saving refreshes the plan, which may then show nothing left to buy. */}
      {save.isSuccess && <SavedOrders r={save.data} onDone={() => save.reset()} />}
      {save.isError && <ErrorBox error={save.error} />}
      {plan.isError && <ErrorBox error={plan.error} onRetry={() => plan.refetch()} />}
      {!plan.data && !plan.isError && valid && <Skeleton className="h-80" />}
      {plan.data && !save.isSuccess && (
        <Plan
          plan={plan.data}
          stale={stale}
          saving={save.isPending}
          onSave={() =>
            save.mutate({
              budget,
              lines: plan.data.recommendations.flatMap((l) => (l.supplier_id ? [{ product_id: l.product_id, supplier_id: l.supplier_id, packs: l.recommended_packs }] : [])),
            })
          }
        />
      )}
    </div>
  );
}

export default function BuyPage() {
  return <BudgetPlanner />;
}
