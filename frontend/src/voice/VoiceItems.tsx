import { AnimatePresence, motion } from 'framer-motion';
import { PackagePlus, PencilLine, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ItemHeard, Product, ProductOption } from '@/api/types';
import { ItemSearch } from '@/components/khata/UdhaarSheet';
import { Button } from '@/components/ui/Button';
import { Stepper } from '@/components/ui/Fields';
import { ProductImage } from '@/components/ui/ProductImage';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn, formatNumber, formatPKR } from '@/lib/format';
import type { ItemWords } from './sentence';

/** One line of the udhaar list while the shopkeeper checks it. */
export interface ReviewItem {
  key: string;
  words: string | null;          // as heard; null when added by hand
  wordsUrdu: string | null;
  heardProductId: number | null;
  heardQty: number | null;
  qtyHeard: boolean;
  options: ProductOption[];
  product: ProductOption | null;
  qty: number;
  choosing: boolean;
}

const FRACTIONAL = new Set(['kg', 'litre', 'dozen']);

export function itemsFromProposal(items: ItemHeard[]): ReviewItem[] {
  return items.map((i, n) => ({
    key: `heard-${n}`,
    words: i.words,
    wordsUrdu: i.words_urdu ?? null,
    heardProductId: i.match?.product_id ?? null,
    heardQty: i.match?.qty ?? null,
    qtyHeard: i.qty_heard,
    options: i.options,
    product: i.match ?? null,
    qty: i.match?.qty ?? 1,
    choosing: !i.match,
  }));
}

export function itemsTotal(items: ReviewItem[]): number {
  return items.reduce((s, i) => s + (i.product ? i.qty * i.product.selling_price : 0), 0);
}

/** "Loose White Sugar (Cheeni) 1kg" -> "White Sugar (Cheeni)": short enough to read back. */
export function shortName(name: string): string {
  return name
    .replace(/\b\d+(\.\d+)?\s*(kg|g|l|ml|s)\b/gi, '')
    .replace(/\b(Loose|Pouch|Bag|Bottle|Box|Tin|Jar|Pack|Packet|Tetra Pak|PET|Tub)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function itemWords(i: ReviewItem): ItemWords | null {
  if (!i.product) return null;
  const unchanged = i.words && i.product.product_id === i.heardProductId && i.qty === i.heardQty;
  const plain = `${formatNumber(i.qty, 2)} ${i.product.unit} ${shortName(i.product.name)}`;
  return unchanged ? { roman: i.words!, urdu: i.wordsUrdu, english: plain } : { roman: plain, urdu: null, english: plain };
}

export function itemProblems(items: ReviewItem[]): { en: string; ur: string }[] {
  const out: { en: string; ur: string }[] = [];
  for (const i of items) {
    if (!i.product) out.push({ en: `Choose which item “${i.words ?? ''}” is.`, ur: `Chunein “${i.words ?? ''}” kaun sa item hai.` });
    else if (i.qty <= 0) out.push({ en: `Write how many ${shortName(i.product.name)}.`, ur: `${shortName(i.product.name)} kitne?` });
    else if (i.qty > i.product.stock_qty + 1e-9)
      out.push({ en: `Only ${formatNumber(i.product.stock_qty, 2)} ${i.product.unit} of ${shortName(i.product.name)} in stock.`, ur: `${shortName(i.product.name)} sirf ${formatNumber(i.product.stock_qty, 2)} ${i.product.unit} stock mein.` });
  }
  return out;
}

function fromProduct(p: Product): ProductOption {
  return { product_id: p.product_id, name: p.name, unit: p.unit, selling_price: p.selling_price, stock_qty: p.stock_qty, image_url: p.image_url ?? null, score: 1, qty: 1 };
}

function Choices({ item, onPick }: { item: ReviewItem; onPick: (o: ProductOption) => void }) {
  const { pick } = useLanguage();
  const [searching, setSearching] = useState(item.options.length === 0);
  return (
    <div className="space-y-2">
      {item.options.length > 0 && (
        <>
          <p className="text-sm font-bold text-ink-muted">{pick('Which one?', 'Kaun sa?')}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {item.options.map((o) => (
              <li key={o.product_id}>
                <button type="button" onClick={() => onPick(o)} disabled={o.stock_qty <= 0} className="w-full flex items-center gap-3 p-2 rounded-xl bg-card border-2 border-line hover:border-sabz text-left min-h-[60px] disabled:opacity-50">
                  <ProductImage src={o.image_url} alt="" className="w-10 h-10 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold leading-snug text-sm">{o.name}</span>
                    <span className="block text-xs text-ink-muted">{o.stock_qty <= 0 ? pick('Out of stock', 'Stock khatam') : `${formatPKR(o.selling_price)} / ${o.unit}`}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {searching ? (
        <ItemSearch onAdd={(p) => onPick(fromProduct(p))} taken={new Set()} />
      ) : (
        <button type="button" onClick={() => setSearching(true)} className="min-h-[44px] px-2 text-sm font-bold text-sabz-dark hover:underline">
          {pick('Something else? Search', 'Koi aur? Dhoondein')}
        </button>
      )}
    </div>
  );
}

/** What was taken on udhaar: each item as heard, matched to the shelf, with quantity and shelf price. */
export function VoiceItems({ items, onChange }: { items: ReviewItem[]; onChange: (items: ReviewItem[]) => void }) {
  const { pick } = useLanguage();
  const [adding, setAdding] = useState(false);
  const set = (key: string, patch: Partial<ReviewItem>) => onChange(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const total = itemsTotal(items);

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <ul className="parchi rounded-2xl border border-line shadow-slip">
          <AnimatePresence initial={false}>
            {items.map((i) => {
              const p = i.product;
              const step = p && FRACTIONAL.has(p.unit) ? 0.25 : 1;
              const over = p ? i.qty > p.stock_qty + 1e-9 : false;
              return (
                <motion.li key={i.key} layout="position" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10, transition: { duration: 0.15 } }} className="pl-14 sm:pl-16 pr-2 sm:pr-3 py-3 space-y-2">
                  {i.words && (
                    <p className="text-sm text-ink-muted">
                      {pick('Heard', 'Suna')}: “{i.words}”
                      {!i.qtyHeard && <span className="ml-1 font-bold text-haldi-dark">{pick('(quantity not said)', '(miqdaar nahi suni)')}</span>}
                    </p>
                  )}
                  {p && !i.choosing ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <ProductImage src={p.image_url} alt="" className="w-11 h-11 shrink-0" />
                      <span className="min-w-0 flex-1 basis-40">
                        <span className="block font-bold leading-snug">{p.name}</span>
                        <span className={cn('block text-sm tabular', over ? 'text-lal-dark font-bold' : 'text-ink-muted')}>
                          {formatPKR(p.selling_price)} / {p.unit}
                          {over && ` · ${pick(`only ${formatNumber(p.stock_qty, 2)} in stock`, `stock sirf ${formatNumber(p.stock_qty, 2)}`)}`}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 ml-auto">
                        <Stepper value={i.qty} min={step} step={step} max={Math.max(p.stock_qty, step)} label={p.name} onChange={(q) => set(i.key, { qty: q })} />
                        <span className="w-[5.5rem] text-right font-extrabold tabular">{formatPKR(i.qty * p.selling_price)}</span>
                        {i.options.length > 1 && (
                          <button type="button" onClick={() => set(i.key, { choosing: true })} className="w-10 h-11 rounded-xl flex items-center justify-center text-ink-muted hover:bg-ink/5" aria-label={pick(`Change ${p.name}`, `${p.name} badlein`)}>
                            <PencilLine className="w-5 h-5" />
                          </button>
                        )}
                        <button type="button" onClick={() => onChange(items.filter((x) => x.key !== i.key))} className="w-10 h-11 rounded-xl flex items-center justify-center text-ink-muted hover:bg-lal-tint hover:text-lal-dark" aria-label={pick(`Remove ${p.name}`, `${p.name} hatayein`)}>
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Choices
                        item={i}
                        onPick={(o) => {
                          // Keep the heard quantity for this product (its own unit), unless the shopkeeper changed it.
                          const qty = i.product && i.qty !== i.heardQty ? i.qty : o.qty;
                          set(i.key, { product: o, qty: qty > 0 ? qty : 1, choosing: false });
                        }}
                      />
                      <button type="button" onClick={() => (i.product ? set(i.key, { choosing: false }) : onChange(items.filter((x) => x.key !== i.key)))} className="min-h-[44px] px-2 text-sm font-bold text-ink-muted hover:underline">
                        {i.product ? pick('Keep as it was', 'Pehle wala rakhein') : pick('Leave this out', 'Yeh nikal dein')}
                      </button>
                    </div>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
          {items.length > 1 && (
            <li className="pl-14 sm:pl-16 pr-3 py-2 flex justify-between font-extrabold border-t border-line">
              <span>{pick('Items total', 'Items ka kul')}</span>
              <span className="tabular">{formatPKR(total)}</span>
            </li>
          )}
        </ul>
      )}
      {adding ? (
        <div className="space-y-2">
          <ItemSearch
            taken={new Set(items.flatMap((i) => (i.product ? [i.product.product_id] : [])))}
            onAdd={(p) => {
              onChange([...items, { key: `added-${p.product_id}-${Date.now()}`, words: null, wordsUrdu: null, heardProductId: null, heardQty: null, qtyHeard: true, options: [], product: fromProduct(p), qty: 1, choosing: false }]);
              setAdding(false);
            }}
          />
          <Button variant="ghost" onClick={() => setAdding(false)}>{pick('Done', 'Bas')}</Button>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)} icon={<PackagePlus className="w-5 h-5" />}>
          {items.length ? pick('Add another item', 'Aur item daalein') : pick('Add items from the shelf', 'Shelf se items daalein')}
        </Button>
      )}
    </div>
  );
}
