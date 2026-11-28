import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CalendarDays, ChevronDown, ClipboardList, PackageCheck, Plus, Trash2, Truck, Wallet } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCreateOrder, useOrders, useOrderSuggestion, useProduct, useProducts, useSuppliers } from '@/api/queries';
import { Segmented } from '@/components/ui/Segmented';
import { BudgetPlanner } from './BuyPage';
import type { OrderCreated, OrderSuggestion, Product, SupplierOverview } from '@/api/types';
import { useUi } from '@/app/UiContext';
import { MessageDraft } from '@/components/MessageDraft';
import { Button } from '@/components/ui/Button';
import { AmountInput, readAmount, Stepper } from '@/components/ui/Fields';
import { ProductImage } from '@/components/ui/ProductImage';
import { EmptyState, ErrorBox, Skeleton } from '@/components/ui/QueryState';
import { PageTitle, Section } from '@/components/ui/Section';
import { Pill, StockStatus } from '@/components/ui/Status';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn, formatDate, formatNumber, formatPKR } from '@/lib/format';
import { useDebounced } from '@/lib/useDebounced';

function nextVisit(s: SupplierOverview, pick: (en: string, ur: string) => string): string {
  if (s.visits_today) return pick('Visits today', 'Aaj aaye ga');
  if (s.next_visit_in_days === 1) return pick('Visits tomorrow', 'Kal aaye ga');
  if (s.next_visit_in_days === null) return pick('No fixed day', 'Koi din tay nahi');
  return pick(`Next visit in ${s.next_visit_in_days} days`, `${s.next_visit_in_days} din baad aaye ga`);
}

function SupplierCard({ s, selected, onSelect }: { s: SupplierOverview; selected: boolean; onSelect: () => void }) {
  const { pick, language } = useLanguage();
  const ui = useUi();
  return (
    <li className={cn('bg-card rounded-2xl border-2 shadow-card p-4 space-y-3', selected ? 'border-neela-600 bg-neela-50/30' : 'border-line')}>
      <div className="flex items-start gap-3">
        <span className={cn('w-11 h-11 rounded-full flex items-center justify-center shrink-0', s.visits_today ? 'bg-haldi-100 text-haldi-800' : 'bg-neela-100 text-neela-700')}>
          <Truck className="w-6 h-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold leading-snug">{s.name}</p>
          <p className="text-sm text-ink-muted flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4" />
            {language === 'english' ? s.visit_days_label : s.visit_days_label_ur} · {nextVisit(s, pick)}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="p-2.5 rounded-xl bg-haldi-50 border border-haldi-100">
          <p className="text-ink-muted">{pick('You owe them', 'Un ke dene hain')}</p>
          <p className="font-extrabold text-base tabular">{formatPKR(s.total_payable_pkr)}</p>
          {s.overdue_pkr > 0 && <p className="text-lal-600 font-bold">{pick(`${formatPKR(s.overdue_pkr)} late`, `${formatPKR(s.overdue_pkr)} late`)}</p>}
        </div>
        <div className="p-2.5 rounded-xl bg-sabz-50 border border-sabz-100">
          <p className="text-ink-muted">{pick('Safe to order', 'Mehfooz order')}</p>
          <p className="font-extrabold text-base tabular text-sabz-700">{formatPKR(s.suggested_budget_pkr)}</p>
          {s.pending_orders_count > 0 && <p className="text-ink-muted">{pick(`${s.pending_orders_count} on the way`, `${s.pending_orders_count} raste mein`)}</p>}
        </div>
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" variant={selected ? 'secondary' : 'primary'} onClick={onSelect} icon={<ClipboardList className="w-5 h-5" />}>
          {selected ? pick('Making order below', 'Neeche order ban raha') : pick('Make order', 'Order banayein')}
        </Button>
        {s.total_payable_pkr > 0 && (
          <Button variant="ghost" onClick={() => ui.openPaySupplier(s.supplier_id)} icon={<Wallet className="w-5 h-5" />}>
            {pick('Pay', 'Payment')}
          </Button>
        )}
      </div>
    </li>
  );
}

interface Line {
  product_id: number;
  name: string;
  image_url: string;
  pack_unit: string;
  units_per_pack: number;
  unit_cost: number;
  packs: number;
  suggested: boolean;
  reasons: string[];
  risk?: OrderSuggestion['recommendations'][number]['stockout_risk'];
}

function linesFrom(plan: OrderSuggestion, english: boolean): Line[] {
  return plan.recommendations.map((r) => ({
    product_id: r.product_id,
    name: r.product_name,
    image_url: r.image_url,
    pack_unit: r.pack_unit,
    units_per_pack: r.units_per_pack,
    unit_cost: r.estimated_unit_cost,
    packs: r.recommended_packs,
    suggested: true,
    reasons: english ? r.reasons : r.reasons_ur,
    risk: r.stockout_risk,
  }));
}

function AddItem({ supplierId, taken, onAdd }: { supplierId: number; taken: Set<number>; onAdd: (p: Product) => void }) {
  const { pick } = useLanguage();
  const [open, setOpen] = useState(false);
  const products = useProducts({ sort: 'name' });
  const mine = (products.data?.products ?? []).filter((p) => p.supplier_id === supplierId && !taken.has(p.product_id));
  if (!open) {
    return (
      <Button variant="ghost" icon={<Plus className="w-5 h-5" />} onClick={() => setOpen(true)}>
        {pick('Add another item from this distributor', 'Is distributor ka aur item')}
      </Button>
    );
  }
  return (
    <div className="space-y-2">
      <p className="font-bold">{pick('Their other items', 'Un ke doosre items')}</p>
      <ul className="max-h-72 overflow-y-auto bg-card rounded-2xl border border-line divide-y divide-line">
        {mine.map((p) => (
          <li key={p.product_id}>
            <button onClick={() => { onAdd(p); setOpen(false); }} className="w-full flex items-center gap-3 p-3 text-left hover:bg-paper min-h-[56px]">
              <ProductImage src={p.image_url} alt="" className="w-10 h-10 shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block font-bold leading-snug">{p.name}</span>
                <span className="block text-sm text-ink-muted">{pick(`${formatNumber(p.stock_qty)} ${p.unit} on the shelf`, `${formatNumber(p.stock_qty)} ${p.unit} shelf par`)}</span>
              </span>
              <StockStatus risk={p.stockout_risk} dead={p.is_dead_stock} />
            </button>
          </li>
        ))}
        {!mine.length && <li className="p-3 text-ink-muted">{pick('Nothing else from them.', 'Un ka aur koi item nahi.')}</li>}
      </ul>
    </div>
  );
}

function OrderBuilder({ s, onSaved }: { s: SupplierOverview; onSaved: (o: OrderCreated) => void }) {
  const { pick, language } = useLanguage();
  const create = useCreateOrder();
  const [input, setInput] = useState(String(Math.max(1000, s.suggested_budget_pkr)));
  const [why, setWhy] = useState(false);
  const budget = useDebounced(readAmount(input), 450);
  const plan = useOrderSuggestion(s.supplier_id, budget);
  const [lines, setLines] = useState<Line[]>([]);
  const [touched, setTouched] = useState(false);
  const english = language === 'english';

  // A new suggestion replaces the list until the shopkeeper edits it by hand.
  useEffect(() => {
    if (plan.data && !touched) setLines(linesFrom(plan.data, english));
  }, [plan.data, touched, english]);

  const total = lines.reduce((sum, l) => sum + l.packs * l.units_per_pack * l.unit_cost, 0);
  const over = total > budget + 0.01 && budget > 0;
  const taken = useMemo(() => new Set(lines.map((l) => l.product_id)), [lines]);
  const edit = (id: number, packs: number) => {
    setTouched(true);
    setLines((ls) => ls.map((l) => (l.product_id === id ? { ...l, packs } : l)));
  };

  const save = () =>
    create.mutate(
      { supplierId: s.supplier_id, lines: lines.filter((l) => l.packs > 0).map((l) => ({ product_id: l.product_id, packs: l.packs })) },
      { onSuccess: onSaved },
    );

  return (
    <div className="space-y-5">
      <div className="bg-card rounded-2xl border border-line shadow-card p-5 space-y-3">
        <label htmlFor="order-budget" className="block text-lg font-bold">
          {pick(`Budget for ${s.name}`, `${s.name} ke liye budget`)}
        </label>
        <AmountInput id="order-budget" value={input} onChange={(v) => { setInput(v); setTouched(false); }} />
        <p className="text-sm text-ink-soft">
          {pick(
            `Safe to order: ${formatPKR(s.suggested_budget_pkr)}. You usually order ${formatPKR(s.usual_order_pkr)} from them; the cash box can take up to ${formatPKR(s.budget.safe_to_order_pkr)}.`,
            `Mehfooz order: ${formatPKR(s.suggested_budget_pkr)}. Aap aam tor par ${formatPKR(s.usual_order_pkr)} ka order dete hain; cash box ${formatPKR(s.budget.safe_to_order_pkr)} tak bardasht kar sakta hai.`,
          )}
        </p>
        <button onClick={() => setWhy((v) => !v)} aria-expanded={why} className="inline-flex items-center gap-1 min-h-[44px] text-sm font-bold text-ink-muted hover:text-ink">
          {pick('How is this worked out?', 'Yeh kaise nikala?')}
          <ChevronDown className={cn('w-4 h-4 transition-transform', why && 'rotate-180')} />
        </button>
        {why && (
          <ol className="list-decimal pl-5 space-y-1 text-base text-ink-soft">
            {(english ? s.budget.explanation : s.budget.explanation_ur).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ol>
        )}
      </div>

      {plan.isError && <ErrorBox error={plan.error} onRetry={() => plan.refetch()} />}
      {!plan.data && !plan.isError && <Skeleton className="h-56" />}
      {plan.data && (
        <div className={cn('space-y-3 transition-opacity', plan.isFetching && 'opacity-60')}>
          {lines.length === 0 ? (
            <EmptyState icon={<PackageCheck className="w-7 h-7" />} title={pick('Nothing from them is running low', 'Un ka koi maal kam nahi')}>
              {pick('You can still add items by hand.', 'Phir bhi khud items daal sakte hain.')}
            </EmptyState>
          ) : (
            <ul className="parchi rounded-2xl border border-line shadow-slip">
              <AnimatePresence initial={false}>
                {lines.map((l) => (
                  <motion.li key={l.product_id} layout="position" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10, transition: { duration: 0.15 } }} className="pl-14 sm:pl-16 pr-2 sm:pr-3 py-3 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <ProductImage src={l.image_url} alt="" className="w-11 h-11 shrink-0" />
                      <span className="min-w-0 flex-1 basis-36">
                        <span className="block font-bold leading-snug">{l.name}</span>
                        <span className="block text-sm text-ink-muted tabular">
                          {l.units_per_pack} / {l.pack_unit} · {formatPKR(l.units_per_pack * l.unit_cost)}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 ml-auto">
                        <Stepper value={l.packs} min={0} label={`${l.name} (${l.pack_unit})`} onChange={(v) => edit(l.product_id, v)} />
                        <span className="w-[5.5rem] text-right font-extrabold tabular">{formatPKR(l.packs * l.units_per_pack * l.unit_cost)}</span>
                        <button onClick={() => { setTouched(true); setLines((ls) => ls.filter((x) => x.product_id !== l.product_id)); }} className="w-10 h-11 rounded-xl flex items-center justify-center text-ink-muted hover:bg-lal-tint hover:text-lal-dark" aria-label={pick(`Remove ${l.name}`, `${l.name} hatayein`)}>
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </span>
                    </div>
                    {l.reasons.length > 0 && <p className="text-sm text-ink-soft">{l.reasons[0]}</p>}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
          <AddItem
            supplierId={s.supplier_id}
            taken={taken}
            onAdd={(p) => {
              setTouched(true);
              setLines((ls) => [...ls, { product_id: p.product_id, name: p.name, image_url: p.image_url, pack_unit: p.pack_info?.pack_unit ?? 'piece', units_per_pack: p.pack_info?.units_per_pack ?? 1, unit_cost: p.cost_price, packs: 1, suggested: false, reasons: [] }]);
            }}
          />
        </div>
      )}

      {lines.length > 0 && (
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-4 z-10 bg-card rounded-2xl border border-line shadow-lift p-4 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-muted">{pick('Order total (estimate)', 'Order ka andaaza')}</p>
            <p className={cn('text-2xl font-extrabold tabular', over && 'text-lal-dark')}>{formatPKR(total)}</p>
            {over && <p className="text-xs font-bold text-lal-dark">{pick('Above the budget', 'Budget se zyada')}</p>}
          </div>
          <Button size="lg" onClick={save} disabled={create.isPending || total <= 0}>
            {create.isPending ? pick('Saving', 'Save ho raha') : pick('Save order', 'Order save karein')}
          </Button>
        </div>
      )}
      {create.isError && <ErrorBox error={create.error} />}
    </div>
  );
}

function Saved({ o, onAnother }: { o: OrderCreated; onAnother: () => void }) {
  const { pick } = useLanguage();
  const reduce = useReducedMotion();
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 bg-card rounded-2xl border-2 border-sabz-mid p-5">
      <div>
        <p className="text-2xl font-extrabold text-sabz-dark">{pick('Order saved.', 'Order save ho gaya.')}</p>
        <p className="text-base text-ink-soft mt-1">
          {pick(`${o.lines.length} items, about ${formatPKR(o.total_pkr)}. Expected by ${formatDate(o.expected_date)}. When it arrives, tap "Maal aaya".`, `${o.lines.length} items, takreeban ${formatPKR(o.total_pkr)}. ${formatDate(o.expected_date)} tak aana chahiye. Jab aaye, "Maal aaya" dabayein.`)}
        </p>
      </div>
      <MessageDraft draft={o.draft} title={pick('Order for the booker', 'Booker ke liye order')} editable />
      <Button variant="secondary" onClick={onAnother}>{pick('Order from another distributor', 'Doosre distributor ka order')}</Button>
    </motion.div>
  );
}

function OnTheWay() {
  const { pick } = useLanguage();
  const ui = useUi();
  const orders = useOrders('pending');
  const [all, setAll] = useState(false);
  if (!orders.data?.length) return null;
  // Due first; only the first few show, so the rest of the screen stays in reach.
  const sorted = [...orders.data].sort((x, y) => String(x.expected_date ?? '').localeCompare(String(y.expected_date ?? '')));
  const shown = all ? sorted : sorted.slice(0, 3);
  return (
    <Section title={pick(`On the way (${sorted.length})`, `Raste mein (${sorted.length})`)} hint={pick('Tap "Maal aaya" when the delivery comes', 'Maal aaye to "Maal aaya" dabayein')}>
      <ul className="bg-neela-50/50 rounded-2xl border-2 border-neela-200 shadow-card divide-y divide-neela-100">
        {shown.map((o) => (
          <li key={o.purchase_id} className="p-4 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1 basis-48">
              <p className="font-bold">{o.supplier_name}</p>
              <p className="text-sm text-ink-muted">
                {o.lines.length} {pick('items', 'items')} · {formatPKR(o.total_pkr)} · {pick('expected', 'aana tha')} {formatDate(o.expected_date)}
              </p>
            </div>
            <Button onClick={() => ui.openReceive(o.purchase_id)} icon={<PackageCheck className="w-5 h-5" />}>
              {pick('Maal aaya', 'Maal aaya')}
            </Button>
          </li>
        ))}
        {sorted.length > 3 && (
          <li>
            <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className="w-full min-h-[48px] px-4 flex items-center gap-2 font-bold text-ink-soft hover:bg-paper">
              <ChevronDown className={cn('w-5 h-5 transition-transform', all && 'rotate-180')} />
              {all ? pick('Show fewer', 'Kam dikhayein') : pick(`${sorted.length - 3} more on the way`, `${sorted.length - 3} aur raste mein`)}
            </button>
          </li>
        )}
      </ul>
    </Section>
  );
}

export default function OrderPage() {
  const { pick } = useLanguage();
  const suppliers = useSuppliers();
  const [selected, setSelected] = useState<number | null>(null);
  const [saved, setSaved] = useState<OrderCreated | null>(null);
  const builderRef = useRef<HTMLDivElement>(null);
  const list = suppliers.data?.suppliers ?? [];
  const today = list.filter((s) => s.visits_today);
  const others = list.filter((s) => !s.visits_today);
  const current = list.find((s) => s.supplier_id === selected);

  const choose = (id: number) => {
    setSelected(id);
    setSaved(null);
    window.setTimeout(() => builderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  // One Order screen, two ways to buy. Every "order this" link in the app lands here:
  //   /app/order?mode=budget          whole shop, one budget (going to the market yourself)
  //   /app/order?supplier=3           that distributor's order (the booker is here)
  //   /app/order?product=12           the distributor of that product
  const [params, setParams] = useSearchParams();
  const mode = params.get('mode') === 'budget' ? 'budget' : 'booker';
  const setMode = (m: 'budget' | 'booker') => {
    const next = new URLSearchParams(params);
    if (m === 'budget') next.set('mode', 'budget');
    else next.delete('mode');
    setParams(next, { replace: true });
  };
  const productId = Number(params.get('product')) || null;
  const product = useProduct(productId);
  const wanted = Number(params.get('supplier')) || product.data?.supplier_id || 0;
  useEffect(() => {
    if (wanted && list.some((s) => s.supplier_id === wanted)) {
      choose(wanted);
      const next = new URLSearchParams(params);
      next.delete('supplier');
      next.delete('product');
      next.delete('mode');
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, list.length]);

  return (
    <div className="space-y-8">
      <PageTitle title={pick('Order', 'Order')} subtitle={pick('Buy for the shop: with the order booker, or yourself at the market. Every order arrives through Maal aaya.', 'Dukaan ke liye khareedari: order booker ke saath, ya khud market se. Har order "Maal aaya" se aata hai.')} />

      <OnTheWay />

      <Segmented
        label={pick('How are you buying?', 'Kaise khareed rahe hain?')}
        value={mode}
        onChange={setMode}
        options={[
          { value: 'booker', label: pick('Order booker is here', 'Order booker aaya') },
          { value: 'budget', label: pick('Whole shop, one budget', 'Poori dukaan, ek budget') },
        ]}
        className="w-full sm:w-auto [&>button]:flex-1"
      />

      {mode === 'budget' ? (
        <BudgetPlanner />
      ) : (
      <>
      <p className="text-base text-ink-soft -mt-4">{pick('Pick the distributor. HisaabAI suggests what to order and how much you can safely spend.', 'Distributor chunein. HisaabAI batata hai kya mangwana hai aur kitna kharch mehfooz hai.')}</p>
      {suppliers.isError && <ErrorBox error={suppliers.error} onRetry={() => suppliers.refetch()} />}
      {!suppliers.data && !suppliers.isError && <Skeleton className="h-64" />}

      {suppliers.data && (
        <Section title={today.length ? pick('Visiting today', 'Aaj aane wale') : pick('Distributors', 'Distributors')} hint={pick('Route days from your records', 'Records ke mutabiq aane ke din')}>
          <ul className="grid md:grid-cols-2 gap-3" data-tour="order-suppliers">
            {(today.length ? today : others).map((s) => (
              <SupplierCard key={s.supplier_id} s={s} selected={s.supplier_id === selected} onSelect={() => choose(s.supplier_id)} />
            ))}
          </ul>
        </Section>
      )}

      {current && (
        <div ref={builderRef} className="scroll-mt-24 space-y-3">
          <h2 className="text-xl font-extrabold">{pick(`Order for ${current.name}`, `${current.name} ka order`)}</h2>
          {saved ? <Saved o={saved} onAnother={() => { setSaved(null); setSelected(null); }} /> : <OrderBuilder key={current.supplier_id} s={current} onSaved={setSaved} />}
        </div>
      )}

      {suppliers.data && today.length > 0 && others.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none min-h-[44px] flex items-center gap-2 text-lg font-extrabold">
            <ChevronDown className="w-5 h-5 transition-transform group-open:rotate-180" />
            {pick(`Other distributors (${others.length})`, `Doosre distributors (${others.length})`)}
          </summary>
          <ul className="grid md:grid-cols-2 gap-3 mt-3">
            {others.map((s) => (
              <SupplierCard key={s.supplier_id} s={s} selected={s.supplier_id === selected} onSelect={() => choose(s.supplier_id)} />
            ))}
          </ul>
        </details>
      )}

      </>
      )}

      {list.some((s) => s.overdue_pkr > 0) && (
        <p className="text-sm text-ink-muted flex items-center gap-2">
          <Pill tone="urgent" className="text-xs px-2 py-0.5">{pick('Late', 'Late')}</Pill>
          {pick('Some distributor bills are late. Pay them from the distributor card or the Hisaab screen.', 'Kuch distributor bill late hain. Card ya Hisaab screen se payment karein.')}
        </p>
      )}
    </div>
  );
}
