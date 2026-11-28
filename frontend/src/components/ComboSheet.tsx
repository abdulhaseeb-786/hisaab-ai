import { AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useInsights, useProducts, useStore } from '@/api/queries';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn, formatPKR } from '@/lib/format';
import { MessageDraft } from './MessageDraft';
import { ProductImage } from './ui/ProductImage';
import { ErrorBox, Skeleton } from './ui/QueryState';
import { Sheet } from './ui/Sheet';

/** Pair a slow item with the fastest seller of its category and price the bundle. */
export function ComboSheet({ productId, onClose }: { productId: number | null; onClose: () => void }) {
  const { pick } = useLanguage();
  const insights = useInsights();
  const products = useProducts({});
  const store = useStore();
  const [discount, setDiscount] = useState(10);

  const dead = insights.data?.dead_stock.find((d) => d.product_id === productId);
  const partner = useMemo(() => {
    if (!dead || !products.data) return undefined;
    const sellers = products.data.products
      .filter((p) => p.product_id !== dead.product_id && (p.average_daily_demand ?? 0) > 0 && p.stock_qty > 0)
      .sort((a, b) => (b.average_daily_demand ?? 0) - (a.average_daily_demand ?? 0));
    return sellers.find((p) => p.category === dead.category) ?? sellers[0];
  }, [dead, products.data]);

  const ready = dead && partner;
  const regular = ready ? dead.selling_price_pkr + partner.selling_price : 0;
  const cost = ready ? dead.cost_price_pkr + partner.cost_price : 0;
  const price = Math.round((regular * (100 - discount)) / 100 / 5) * 5;
  const profit = price - cost;
  const offer = ready
    ? {
        english: `*Special offer at ${store.data?.name ?? 'our shop'}*\n${dead.name} + ${partner.name}\nOnly ${formatPKR(price)} (usually ${formatPKR(regular)}). While stock lasts.`,
        roman_urdu: `*${store.data?.name ?? 'Hamari dukaan'} par khaas offer*\n${dead.name} + ${partner.name}\nSirf ${formatPKR(price)} (asal ${formatPKR(regular)}). Stock khatam hone tak.`,
      }
    : null;
  const error = insights.error ?? products.error;

  return (
    <Sheet
      open={productId !== null}
      onClose={onClose}
      title={pick('Bundle offer for slow stock', 'Phase maal ka bundle offer')}
      description={pick('Sell a slow item together with a fast one.', 'Aahista bikne wala maal tez bikne wale ke saath bechein.')}
    >
      {error && <ErrorBox error={error} />}
      {!ready && !error && (insights.isLoading || products.isLoading) && <Skeleton className="h-64" />}
      {!ready && !error && !insights.isLoading && !products.isLoading && (
        <p className="text-lg">{pick('This item is selling again, so no bundle is needed.', 'Yeh item phir bikne laga hai, bundle ki zaroorat nahi.')}</p>
      )}
      {ready && (
        <div className="space-y-6">
          <p className="text-lg text-ink-soft">
            {pick(
              `${dead.name} has not sold for ${dead.days_since_last_sale} days. ${formatPKR(dead.tied_up_capital_pkr)} is stuck on the shelf.`,
              `${dead.name} ${dead.days_since_last_sale} din se nahi bika. ${formatPKR(dead.tied_up_capital_pkr)} shelf par ruka hua hai.`,
            )}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { tag: pick('Slow item', 'Aahista bikne wala'), name: dead.name, img: dead.image_url, p: dead.selling_price_pkr },
              { tag: pick('Fast seller', 'Tez bikne wala'), name: partner.name, img: partner.image_url, p: partner.selling_price },
            ].map((x) => (
              <div key={x.name} className="p-4 rounded-2xl bg-card border border-line space-y-2">
                <p className="text-sm font-bold text-ink-muted">{x.tag}</p>
                <ProductImage src={x.img} alt="" className="w-16 h-16" />
                <p className="font-bold leading-snug">{x.name}</p>
                <p className="text-sm text-ink-muted tabular">{formatPKR(x.p)}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <label htmlFor="discount" className="flex justify-between text-lg font-bold">
              <span>{pick('Discount on the pair', 'Jore par discount')}</span>
              <span className="tabular">{discount}%</span>
            </label>
            <input id="discount" type="range" min={0} max={25} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="w-full h-10 accent-[#0E6B3F]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-sabz-tint">
              <p className="text-sm text-sabz-dark font-bold">{pick('Bundle price', 'Bundle ki qeemat')}</p>
              <p className="text-2xl font-extrabold tabular">{formatPKR(price)}</p>
              <p className="text-sm text-ink-muted line-through tabular">{formatPKR(regular)}</p>
            </div>
            <div className={cn('p-4 rounded-2xl', profit >= 0 ? 'bg-card border border-line' : 'bg-lal-tint')}>
              <p className="text-sm font-bold text-ink-muted">{pick('Your profit per bundle', 'Har bundle par munafa')}</p>
              <p className={cn('text-2xl font-extrabold tabular', profit < 0 && 'text-lal-dark')}>{formatPKR(profit)}</p>
            </div>
          </div>
          {profit < 0 && (
            <p className="flex items-center gap-2 font-bold text-lal-dark">
              <AlertTriangle className="w-5 h-5" /> {pick('At this discount you sell below cost.', 'Is discount par khareed se kam mein bikay ga.')}
            </p>
          )}
          {offer && <MessageDraft draft={offer} title={pick('Offer to show or put up at the counter', 'Counter par dikhane ya lagane ke liye offer')} editable />}
        </div>
      )}
    </Sheet>
  );
}

export default ComboSheet;
