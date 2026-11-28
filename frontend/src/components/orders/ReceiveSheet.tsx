import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Check, ChevronRight, PackageCheck, Truck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useOrders, useReceiveOrder, useUpdatePrice } from '@/api/queries';
import type { Order, PaymentMethod, ReceiveResult } from '@/api/types';
import { useUi } from '@/app/UiContext';
import { Button } from '@/components/ui/Button';
import { AmountInput, MethodPicker, readAmount, Stamp } from '@/components/ui/Fields';
import { ErrorBox, Skeleton } from '@/components/ui/QueryState';
import { Sheet } from '@/components/ui/Sheet';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn, formatDate, formatNumber, formatPKR } from '@/lib/format';

const TOLERANCE = 0.005;

interface LineState {
  received: string;
  rate: string;
}

function PriceFix({ c }: { c: ReceiveResult['price_changes'][number] }) {
  const { pick } = useLanguage();
  const update = useUpdatePrice();
  const up = c.change_pct > 0;
  return (
    <li className={cn('p-4 rounded-2xl border-2 space-y-2', up ? 'bg-haldi-tint border-haldi/50' : 'bg-sabz-tint border-sabz-mid')}>
      <p className="font-bold flex items-center gap-2">
        {up ? <ArrowUpRight className="w-5 h-5 text-haldi-dark" /> : <ArrowDownRight className="w-5 h-5 text-sabz" />}
        {c.name}
      </p>
      <p className="text-base">
        {pick(
          `Bill rate ${formatPKR(c.old_cost)} → ${formatPKR(c.new_cost)} (${up ? '+' : ''}${c.change_pct}%). At your price of ${formatPKR(c.selling_price)}, margin goes from ${c.old_margin_pct}% to ${c.new_margin_pct}%.`,
          `Bill ka rate ${formatPKR(c.old_cost)} → ${formatPKR(c.new_cost)} (${up ? '+' : ''}${c.change_pct}%). Aap ki qeemat ${formatPKR(c.selling_price)} par munafa ${c.old_margin_pct}% se ${c.new_margin_pct}%.`,
        )}
      </p>
      {up && c.price_to_keep_margin > c.selling_price && (
        update.isSuccess ? (
          <p className="flex items-center gap-2 font-bold text-sabz-dark">
            <Check className="w-5 h-5" /> {pick(`Shelf price is now ${formatPKR(c.price_to_keep_margin)}.`, `Shelf ki qeemat ab ${formatPKR(c.price_to_keep_margin)}.`)}
          </p>
        ) : (
          <Button size="sm" variant="secondary" disabled={update.isPending} onClick={() => update.mutate({ productId: c.product_id, price: c.price_to_keep_margin, reason: 'Distributor rate went up' })}>
            {pick(`Set price to ${formatPKR(c.price_to_keep_margin)} to keep the margin`, `Munafa barqarar rakhne ke liye qeemat ${formatPKR(c.price_to_keep_margin)} karein`)}
          </Button>
        )
      )}
      {update.isError && <p className="text-sm text-lal-dark">{update.error.message}</p>}
    </li>
  );
}

function Done({ r, onClose }: { r: ReceiveResult; onClose: () => void }) {
  const { pick } = useLanguage();
  const reduce = useReducedMotion();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-2xl font-extrabold text-sabz-dark">{pick('Stock added to the shelf.', 'Maal stock mein aa gaya.')}</p>
          <p className="text-base text-ink-soft mt-1">
            {r.left_to_pay_pkr > 0
              ? pick(`Bill ${formatPKR(r.bill_total_pkr)}. ${formatPKR(r.left_to_pay_pkr)} to pay by ${formatDate(r.due_date)}.`, `Bill ${formatPKR(r.bill_total_pkr)}. ${formatPKR(r.left_to_pay_pkr)} ${formatDate(r.due_date)} tak dene hain.`)
              : pick(`Bill ${formatPKR(r.bill_total_pkr)}, paid in full.`, `Bill ${formatPKR(r.bill_total_pkr)}, poora ada.`)}
          </p>
        </div>
        <motion.div initial={reduce ? false : { scale: 2.3, opacity: 0, rotate: -6 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 480, damping: 22 }}>
          <Stamp urdu="مال آیا" line={formatPKR(r.bill_total_pkr)} tone="sabz" />
        </motion.div>
      </div>
      {r.price_changes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-bold">{pick('Rates changed on this bill', 'Is bill par rate badle')}</h3>
          <ul className="space-y-2">
            {r.price_changes.map((c) => (
              <PriceFix key={c.product_id} c={c} />
            ))}
          </ul>
          <p className="text-sm text-ink-muted">{pick('Your cost is updated for every number in HisaabAI from now on.', 'Ab se HisaabAI ke har hisaab mein naya cost lagay ga.')}</p>
        </div>
      )}
      {r.short_items.length > 0 && (
        <div className="p-4 rounded-2xl bg-lal-tint space-y-1">
          <p className="font-bold text-lal-dark flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> {pick('Came short', 'Kam aaya')}
          </p>
          {r.short_items.map((s) => (
            <p key={s.product_id} className="text-base">
              {s.name}: {formatNumber(s.received_qty)} / {formatNumber(s.ordered_qty)} {s.unit}
            </p>
          ))}
        </div>
      )}
      <Button block onClick={onClose}>{pick('Done', 'Theek hai')}</Button>
    </div>
  );
}

function ReceiveForm({ order }: { order: Order }) {
  const { pick } = useLanguage();
  const receive = useReceiveOrder();
  const ui = useUi();
  const [lines, setLines] = useState<Record<number, LineState>>(() =>
    Object.fromEntries(order.lines.map((l) => [l.product_id, { received: String(l.qty), rate: String(l.unit_cost) }])),
  );
  const [bill, setBill] = useState('');
  const [payNow, setPayNow] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');

  const total = useMemo(
    () => order.lines.reduce((s, l) => s + Number(lines[l.product_id]?.received || 0) * Number(lines[l.product_id]?.rate || 0), 0),
    [lines, order.lines],
  );
  const pay = readAmount(payNow);
  const tooMuch = pay > total + 0.01;

  if (receive.isSuccess) return <Done r={receive.data} onClose={ui.closeReceive} />;

  const set = (id: number, patch: Partial<LineState>) => setLines((ls) => ({ ...ls, [id]: { ...ls[id]!, ...patch } }));
  const save = () =>
    receive.mutate({
      purchaseId: order.purchase_id,
      billNumber: bill,
      payNow: pay,
      method,
      lines: order.lines.map((l) => ({
        product_id: l.product_id,
        received_qty: Number(lines[l.product_id]?.received || 0),
        unit_cost: Number(lines[l.product_id]?.rate || 0),
      })),
    });

  return (
    <div className="space-y-6">
      <p className="text-base text-ink-soft">
        {pick('Check each item against the bill. Change the quantity if less came, and the rate if the bill says a different price.', 'Har item bill se milayein. Kam aaya ho to tadaad, aur bill par rate alag ho to rate badlein.')}
      </p>
      <ul className="bg-card rounded-2xl border border-line divide-y divide-line">
        {order.lines.map((l) => {
          const st = lines[l.product_id]!;
          const rate = Number(st.rate || 0);
          const qty = Number(st.received || 0);
          const changed = l.unit_cost > 0 && Math.abs(rate - l.unit_cost) / l.unit_cost > TOLERANCE;
          const short = qty < l.qty;
          return (
            <li key={l.product_id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold leading-snug">{l.name}</p>
                  <p className="text-sm text-ink-muted">
                    {pick('Ordered', 'Order')} {formatNumber(l.packs, 2)} {l.pack_unit} = {formatNumber(l.qty)} {l.unit}
                  </p>
                </div>
                <p className="font-extrabold tabular shrink-0">{formatPKR(qty * rate)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-sm font-bold text-ink-soft">{pick(`Came (${l.unit})`, `Aaya (${l.unit})`)}</span>
                  <input inputMode="decimal" value={st.received} onChange={(e) => set(l.product_id, { received: e.target.value.replace(/[^\d.]/g, '') })} className={cn('w-full min-h-[48px] px-3 rounded-xl border-2 bg-paper outline-none text-lg font-bold tabular focus:border-sabz', short ? 'border-lal' : 'border-line')} />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-bold text-ink-soft">{pick('Bill rate (Rs)', 'Bill ka rate (Rs)')}</span>
                  <input inputMode="decimal" value={st.rate} onChange={(e) => set(l.product_id, { rate: e.target.value.replace(/[^\d.]/g, '') })} className={cn('w-full min-h-[48px] px-3 rounded-xl border-2 bg-paper outline-none text-lg font-bold tabular focus:border-sabz', changed ? 'border-haldi' : 'border-line')} />
                </label>
              </div>
              {changed && (
                <p className="text-sm font-bold text-haldi-dark">
                  {pick(`Rate ${rate > l.unit_cost ? 'up' : 'down'} ${formatNumber((Math.abs(rate - l.unit_cost) / l.unit_cost) * 100, 1)}% from ${formatPKR(l.unit_cost)}`, `Rate ${formatPKR(l.unit_cost)} se ${formatNumber((Math.abs(rate - l.unit_cost) / l.unit_cost) * 100, 1)}% ${rate > l.unit_cost ? 'zyada' : 'kam'}`)}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <div className="space-y-1">
        <label htmlFor="bill-no" className="text-sm font-bold text-ink-soft">{pick('Bill number (optional)', 'Bill number (marzi se)')}</label>
        <input id="bill-no" value={bill} onChange={(e) => setBill(e.target.value)} maxLength={40} className="w-full min-h-[48px] px-4 rounded-xl border-2 border-line bg-card outline-none focus:border-sabz" />
      </div>
      <div className="p-4 rounded-2xl bg-card border border-line space-y-3">
        <p className="flex justify-between text-lg font-extrabold">
          <span>{pick('Bill total', 'Bill ka kul')}</span>
          <span className="tabular">{formatPKR(total)}</span>
        </p>
        <label htmlFor="pay-now" className="block font-bold">{pick('Paying now? (leave empty to pay later)', 'Abhi de rahe hain? (baad mein dena ho to khali chhorein)')}</label>
        <AmountInput id="pay-now" value={payNow} onChange={setPayNow} size="md" invalid={tooMuch} />
        {pay > 0 && <MethodPicker value={method} onChange={setMethod} direction="out" />}
        {tooMuch && <p className="text-sm font-bold text-lal-dark">{pick('More than the bill.', 'Bill se zyada.')}</p>}
      </div>
      {receive.isError && <ErrorBox error={receive.error} />}
      <Button size="lg" block disabled={total <= 0 || tooMuch || receive.isPending} onClick={save} icon={<PackageCheck className="w-6 h-6" />}>
        {receive.isPending ? pick('Saving', 'Save ho raha') : pick('Maal aaya: add to stock', 'Maal aaya: stock mein daalein')}
      </Button>
    </div>
  );
}

export function ReceiveSheet() {
  const { pick } = useLanguage();
  const ui = useUi();
  const orders = useOrders('pending');
  const [chosen, setChosen] = useState<number | null>(null);
  // Keep the order being received even after saving: the pending list refreshes and
  // drops it, but the shopkeeper still needs to see the result (rate changes, short items).
  const [snapshot, setSnapshot] = useState<Order | null>(null);
  const id = ui.receivePurchaseId;

  useEffect(() => {
    setChosen(id && id > 0 ? id : null);
    setSnapshot(null);
  }, [id]);

  const live = orders.data?.find((o) => o.purchase_id === chosen);
  useEffect(() => {
    if (live && snapshot?.purchase_id !== live.purchase_id) setSnapshot(live);
  }, [live, snapshot]);
  const order = snapshot && snapshot.purchase_id === chosen ? snapshot : live;

  return (
    <Sheet open={id !== null} onClose={ui.closeReceive} width="lg" title={pick('Maal aaya', 'Maal aaya')} description={order ? `${order.supplier_name}, ${pick('ordered', 'order')} ${formatDate(order.ordered_at)}` : pick('Which delivery came?', 'Kaun sa maal aaya?')}>
      {orders.isError && <ErrorBox error={orders.error} onRetry={() => orders.refetch()} />}
      {!orders.data && !orders.isError && <Skeleton className="h-64" />}
      {orders.data && !chosen && (
        orders.data.length ? (
          <ul className="bg-card rounded-2xl border border-line divide-y divide-line overflow-hidden">
            {orders.data.map((o) => (
              <li key={o.purchase_id}>
                <button onClick={() => setChosen(o.purchase_id)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-paper">
                  <Truck className="w-6 h-6 text-ink-muted shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{o.supplier_name}</span>
                    <span className="block text-sm text-ink-muted">
                      {o.lines.length} {pick('items', 'items')}, {pick('expected', 'aana tha')} {formatDate(o.expected_date)}
                    </span>
                  </span>
                  <span className="font-extrabold tabular">{formatPKR(o.total_pkr)}</span>
                  <ChevronRight className="w-5 h-5 text-ink-faint" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-lg">{pick('No order is on the way. Save an order first from the Order screen.', 'Koi order raste mein nahi. Pehle Order screen se order save karein.')}</p>
        )
      )}
      {order && <ReceiveForm key={order.purchase_id} order={order} />}
      {orders.data && chosen && !order && !orders.isFetching && <p className="text-lg">{pick('This order was already received.', 'Yeh order pehle hi aa chuka.')}</p>}
    </Sheet>
  );
}

export default ReceiveSheet;
