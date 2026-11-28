import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { PackagePlus, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useCreditCheck, useCustomers, useGiveUdhaar, useProducts } from '@/api/queries';
import type { CustomerItem, Product, UdhaarResult } from '@/api/types';
import { useUi } from '@/app/UiContext';
import { MessageDraft } from '@/components/MessageDraft';
import { Button } from '@/components/ui/Button';
import { AmountInput, readAmount, Stamp, Stepper } from '@/components/ui/Fields';
import { ProductImage } from '@/components/ui/ProductImage';
import { ErrorBox } from '@/components/ui/QueryState';
import { Sheet } from '@/components/ui/Sheet';
import { useLanguage } from '@/i18n/LanguageContext';
import { formatDate, formatNumber, formatPKR } from '@/lib/format';
import { useDebounced } from '@/lib/useDebounced';
import { CreditVerdict } from './CreditVerdict';
import { CustomerPicker, initials } from './CustomerPicker';

interface Line {
  product: Product;
  qty: number;
}

function ItemSearch({ onAdd, taken }: { onAdd: (p: Product) => void; taken: Set<number> }) {
  const { pick } = useLanguage();
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim(), 250);
  const products = useProducts({ search: term, sort: 'name' });
  const results = term ? (products.data?.products ?? []).filter((p) => !taken.has(p.product_id)).slice(0, 6) : [];

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={pick('Add an item: Dalda, Surf, doodh...', 'Item daalein: Dalda, Surf, doodh...')}
          aria-label={pick('Find an item', 'Item dhoondein')}
          className="w-full min-h-[52px] pl-12 pr-4 rounded-2xl bg-card border-2 border-line focus:border-sabz outline-none text-lg"
        />
      </div>
      {results.length > 0 && (
        <ul className="bg-card rounded-2xl border border-line divide-y divide-line overflow-hidden">
          {results.map((p) => {
            const out = p.stock_qty <= 0;
            return (
              <li key={p.product_id}>
                <button
                  disabled={out}
                  onClick={() => {
                    onAdd(p);
                    setSearch('');
                  }}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-paper disabled:opacity-50 min-h-[60px]"
                >
                  <ProductImage src={p.image_url} alt="" className="w-11 h-11 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold leading-snug">{p.name}</span>
                    <span className="block text-sm text-ink-muted">
                      {out ? pick('Out of stock', 'Stock khatam') : pick(`${formatNumber(p.stock_qty)} ${p.unit} on the shelf`, `${formatNumber(p.stock_qty)} ${p.unit} shelf par`)}
                    </span>
                  </span>
                  <span className="font-extrabold tabular shrink-0">{formatPKR(p.selling_price)}</span>
                  <PackagePlus className="w-5 h-5 text-sabz shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {term && products.data && results.length === 0 && <p className="text-sm text-ink-muted px-1">{pick('No item found. Use "Other amount" below.', 'Item nahi mila. Neeche "Doosri raqam" likhein.')}</p>}
    </div>
  );
}

function Receipt({ r, onMore, onDone }: { r: UdhaarResult; onMore: () => void; onDone: () => void }) {
  const { pick } = useLanguage();
  const reduce = useReducedMotion();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-2xl font-extrabold">{pick('Written in the khata.', 'Khate mein likh diya.')}</p>
          <p className="text-base text-ink-soft mt-1">
            {pick(`${r.name} now owes ${formatPKR(r.balance_pkr)}. Due by ${formatDate(r.due_date)}.`, `${r.name} ka khata ab ${formatPKR(r.balance_pkr)}. Wapsi ${formatDate(r.due_date)} tak.`)}
          </p>
        </div>
        <motion.div initial={reduce ? false : { scale: 2.3, opacity: 0, rotate: -6 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 480, damping: 22 }}>
          <Stamp urdu="ادھار" line={formatPKR(r.total_pkr)} />
        </motion.div>
      </div>
      <MessageDraft draft={r.receipt} title={pick('Receipt for the customer', 'Customer ki raseed')} />
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onMore}>{pick('Another udhaar', 'Aur udhaar')}</Button>
        <Button className="flex-1" onClick={onDone}>{pick('Done', 'Theek hai')}</Button>
      </div>
    </div>
  );
}

export function UdhaarSheet() {
  const { pick } = useLanguage();
  const ui = useUi();
  const give = useGiveUdhaar();
  const customers = useCustomers('');
  const [customer, setCustomer] = useState<CustomerItem | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [extra, setExtra] = useState('');
  const [note, setNote] = useState('');
  const open = ui.udhaar.open;

  useEffect(() => {
    if (!open) {
      setCustomer(null);
      setLines([]);
      setExtra('');
      setNote('');
      give.reset();
      return;
    }
    if (ui.udhaar.customerId && customers.data) {
      setCustomer(customers.data.find((c) => c.customer_id === ui.udhaar.customerId) ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ui.udhaar.customerId, customers.data]);

  const extraValue = readAmount(extra);
  const total = useMemo(() => lines.reduce((s, l) => s + l.qty * l.product.selling_price, 0) + extraValue, [lines, extraValue]);
  const checkAmount = useDebounced(Math.round(total), 350);
  const check = useCreditCheck(customer?.customer_id ?? null, checkAmount);
  const taken = useMemo(() => new Set(lines.map((l) => l.product.product_id)), [lines]);

  const save = () => {
    if (!customer || total <= 0) return;
    give.mutate({
      customerId: customer.customer_id,
      items: lines.map((l) => ({ product_id: l.product.product_id, qty: l.qty })),
      extra: extraValue,
      note,
    });
  };

  const decision = check.data?.decision;

  return (
    <Sheet
      open={open}
      onClose={ui.closeUdhaar}
      width="lg"
      title={pick('Give udhaar', 'Udhaar likhein')}
      description={customer ? undefined : pick('Who is taking it?', 'Kaun le raha hai?')}
      footer={
        customer && !give.isSuccess ? (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-muted">{pick('Total on khata', 'Khate mein kul')}</p>
              <p className="text-2xl font-extrabold tabular">{formatPKR(total)}</p>
            </div>
            <Button size="lg" variant={decision === 'no' ? 'danger' : 'primary'} disabled={total <= 0 || give.isPending} onClick={save}>
              {give.isPending ? pick('Saving', 'Save ho raha') : decision === 'no' ? pick('Give anyway', 'Phir bhi dein') : pick('Write in khata', 'Khate mein likhein')}
            </Button>
          </div>
        ) : undefined
      }
    >
      {give.isSuccess ? (
        <Receipt r={give.data} onDone={ui.closeUdhaar} onMore={() => { give.reset(); setLines([]); setExtra(''); setNote(''); setCustomer(null); }} />
      ) : !customer ? (
        <CustomerPicker onPick={setCustomer} />
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-line">
            <span className="w-11 h-11 rounded-full bg-sabz-tint text-sabz-dark flex items-center justify-center font-extrabold shrink-0" aria-hidden>
              {initials(customer.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold leading-snug">{customer.name}</p>
              <p className="text-sm text-ink-muted">{pick(`Khata now ${formatPKR(customer.balance_pkr)}, limit ${formatPKR(customer.credit_limit_pkr)}`, `Khata abhi ${formatPKR(customer.balance_pkr)}, had ${formatPKR(customer.credit_limit_pkr)}`)}</p>
            </div>
            <button onClick={() => setCustomer(null)} className="min-h-[44px] px-3 rounded-xl text-sm font-bold text-ink-muted hover:bg-ink/5">
              {pick('Change', 'Badlein')}
            </button>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-bold">{pick('What are they taking?', 'Kya le rahe hain?')}</h3>
            <ItemSearch onAdd={(p) => setLines((ls) => [...ls, { product: p, qty: 1 }])} taken={taken} />
            {lines.length > 0 && (
              <ul className="parchi rounded-2xl border border-line shadow-slip">
                <AnimatePresence initial={false}>
                  {lines.map((l) => (
                    <motion.li
                      key={l.product.product_id}
                      layout="position"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10, transition: { duration: 0.15 } }}
                      className="pl-14 sm:pl-16 pr-2 sm:pr-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1"
                    >
                      <span className="min-w-0 flex-1 basis-40">
                        <span className="block font-bold leading-snug">{l.product.name}</span>
                        <span className="block text-sm text-ink-muted tabular">{formatPKR(l.product.selling_price)} / {l.product.unit}</span>
                      </span>
                      <span className="flex items-center gap-1 ml-auto">
                        <Stepper value={l.qty} min={1} max={l.product.stock_qty} label={l.product.name} onChange={(q) => setLines((ls) => ls.map((x) => (x.product.product_id === l.product.product_id ? { ...x, qty: q } : x)))} />
                        <span className="w-[5.5rem] text-right font-extrabold tabular">{formatPKR(l.qty * l.product.selling_price)}</span>
                        <button onClick={() => setLines((ls) => ls.filter((x) => x.product.product_id !== l.product.product_id))} className="w-10 h-11 rounded-xl flex items-center justify-center text-ink-muted hover:bg-lal-tint hover:text-lal-dark" aria-label={pick(`Remove ${l.product.name}`, `${l.product.name} hatayein`)}>
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>

          <details className="group" open={extraValue > 0 || undefined}>
            <summary className="cursor-pointer list-none min-h-[44px] flex items-center gap-2 font-bold text-ink-soft">
              <X className="w-5 h-5 rotate-45 transition-transform group-open:rotate-0" />
              {pick('Other amount (cash loan, item not in the list)', 'Doosri raqam (naqad udhaar, list se bahar ka item)')}
            </summary>
            <div className="mt-2 space-y-2">
              <AmountInput id="udhaar-extra" value={extra} onChange={setExtra} size="md" label={pick('Other amount', 'Doosri raqam')} />
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder={pick('What for? e.g. cash for medicine', 'Kis liye? maslan dawai ke liye cash')} aria-label={pick('What for?', 'Kis liye?')} className="w-full min-h-[48px] px-4 rounded-xl border-2 border-line bg-card outline-none focus:border-sabz" />
            </div>
          </details>

          {check.data && total > 0 && <CreditVerdict check={check.data} stale={check.isFetching || checkAmount !== Math.round(total)} />}
          {give.isError && <ErrorBox error={give.error} />}
        </div>
      )}
    </Sheet>
  );
}

export default UdhaarSheet;
