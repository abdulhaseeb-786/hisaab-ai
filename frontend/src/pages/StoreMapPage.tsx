import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, BookOpenText, CheckCircle2, ChevronRight, PackageX, TrendingDown } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import storeImg from '@/assets/store-isometric.jpg';
import { useUi } from '@/app/UiContext';
import { Button } from '@/components/ui/Button';
import { ErrorBox, Skeleton } from '@/components/ui/QueryState';
import { PageTitle } from '@/components/ui/Section';
import { Pill, type Tone } from '@/components/ui/Status';
import { KHATA_POSITION, ZONES, useStoreSignals, type ZoneSignal } from '@/features/storeSignals';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn, formatNumber, formatPKR } from '@/lib/format';

interface Spot {
  id: string;
  tone: Tone;
  Icon: typeof AlertTriangle;
  name: string;
  position: { x: string; y: string };
  status: string;
  headline: string;
  detail: string;
  action: string;
  run: () => void;
}

const PIN_BG: Record<Tone, string> = {
  urgent: 'bg-lal',
  watch: 'bg-haldi',
  ok: 'bg-sabz',
  neutral: 'bg-ink-muted',
  info: 'bg-neela',
};

export default function StoreMapPage() {
  const { pick } = useLanguage();
  const ui = useUi();
  const navigate = useNavigate();
  const signals = useStoreSignals();
  const reduce = useReducedMotion();
  const [selected, setSelected] = useState<string | null>(null);

  const toSpot = (z: ZoneSignal): Spot => {
    const zone = ZONES[z.zone];
    const name = pick(...zone.title);
    if (z.type === 'stockout' && z.product) {
      return {
        id: z.zone, tone: 'urgent', Icon: AlertTriangle, name, position: zone.position,
        status: pick(`${z.atRiskCount} running low`, `${z.atRiskCount} kam hain`),
        headline: pick(`${z.product.name}: ${formatNumber(z.product.stock_qty)} ${z.product.unit} left`, `${z.product.name}: ${formatNumber(z.product.stock_qty)} ${z.product.unit} bacha`),
        detail: pick(z.product.risk_reason, z.product.risk_reason_ur),
        action: pick('Make the order list', 'Order list banayein'),
        run: () => navigate('/app/buy'),
      };
    }
    if (z.type === 'squeeze' && z.squeeze) {
      const s = z.squeeze;
      return {
        id: z.zone, tone: 'watch', Icon: TrendingDown, name, position: zone.position,
        status: pick('Price too low', 'Qeemat kam'),
        headline: pick(`${s.name}: margin ${s.previous_margin_pct}% → ${s.current_margin_pct}%`, `${s.name}: munafa ${s.previous_margin_pct}% → ${s.current_margin_pct}%`),
        detail: pick(`The supplier cost went up but the shelf price did not. Suggested price ${formatPKR(s.recommended_selling_price_pkr)}.`, `Supplier ka rate barha, shelf price nahi. Mashwara: ${formatPKR(s.recommended_selling_price_pkr)}.`),
        action: pick('Change the price', 'Qeemat badlein'),
        run: () => ui.openProduct(s.product_id),
      };
    }
    if (z.type === 'dead' && z.dead) {
      const d = z.dead;
      return {
        id: z.zone, tone: 'neutral', Icon: PackageX, name, position: zone.position,
        status: pick('Not selling', 'Nahi bik raha'),
        headline: pick(`${d.name}: ${formatPKR(d.tied_up_capital_pkr)} stuck`, `${d.name}: ${formatPKR(d.tied_up_capital_pkr)} ruka hua`),
        detail: pick(`No sale for ${d.days_since_last_sale} days.`, `${d.days_since_last_sale} din se koi sale nahi.`),
        action: pick('Make a bundle offer', 'Bundle offer banayein'),
        run: () => ui.openCombo(d.product_id),
      };
    }
    const p = z.product;
    return {
      id: z.zone, tone: 'ok', Icon: CheckCircle2, name, position: zone.position,
      status: pick('All good', 'Sab theek'),
      headline: pick('Well stocked', 'Stock poora hai'),
      detail: p ? pick(`Best seller here: ${p.name}, about ${formatNumber(p.average_daily_demand, 1)} a day.`, `Yahan sab se zyada: ${p.name}, rozana takreeban ${formatNumber(p.average_daily_demand, 1)}.`) : '',
      action: pick('See this product', 'Yeh product dekhein'),
      run: () => p && ui.openProduct(p.product_id),
    };
  };

  const d = signals.data;
  const spots: Spot[] = d ? d.zones.map(toSpot) : [];
  if (d?.topDefaulter) {
    const c = d.topDefaulter;
    spots.push({
      id: 'khata', tone: 'urgent', Icon: BookOpenText, name: pick('Khata counter', 'Khata counter'), position: KHATA_POSITION,
      status: pick(`${d.overdueCustomers} late`, `${d.overdueCustomers} late`),
      headline: pick(`${c.name}: ${formatPKR(c.overdue_amount_pkr)} late`, `${c.name}: ${formatPKR(c.overdue_amount_pkr)} late`),
      detail: pick(`Oldest bill is ${c.days_overdue} days late.`, `Purana bill ${c.days_overdue} din late hai.`),
      action: pick('Send a reminder', 'Yaad dihani bhejein'),
      run: () => ui.openReminder(c.customer_id),
    });
  }
  const current = spots.find((s) => s.id === selected) ?? spots.find((s) => s.tone === 'urgent') ?? spots[0];

  return (
    <div className="space-y-6">
      <PageTitle title={pick('Store map', 'Dukaan ka naqsha')} subtitle={pick('Each pin shows the most important thing in that part of the shop.', 'Har pin dukaan ke us hisse ki sab se ahem baat dikhata hai.')} />

      {signals.error ? <ErrorBox error={signals.error} onRetry={signals.refetch} /> : null}
      {!d && !signals.error && <Skeleton className="aspect-[16/9]" />}

      {d && (
        <>
          <div className="relative rounded-2xl overflow-hidden border border-line shadow-card bg-card">
            <img src={storeImg} alt={pick('Drawing of the shop', 'Dukaan ki tasveer')} className="w-full aspect-[16/9] object-cover" />
            {spots.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                aria-label={`${s.name}: ${s.status}`}
                aria-pressed={current?.id === s.id}
                style={{ left: s.position.x, top: s.position.y }}
                className="absolute -translate-x-1/2 -translate-y-1/2 p-1"
              >
                <motion.span
                  animate={!reduce && s.tone === 'urgent' ? { scale: [1, 1.12, 1] } : undefined}
                  transition={{ repeat: Infinity, duration: 1.8 }}
                  className={cn('flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full text-white border-[3px] border-white shadow-lift', PIN_BG[s.tone], current?.id === s.id && 'ring-4 ring-haldi')}
                >
                  <s.Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </motion.span>
              </button>
            ))}
          </div>

          {current && (
            <div className="bg-card rounded-2xl border border-line shadow-card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-ink-muted">{current.name}</p>
                <p className="text-xl font-extrabold leading-snug mt-0.5">{current.headline}</p>
                <p className="text-base text-ink-soft mt-1">{current.detail}</p>
              </div>
              <Button onClick={current.run} className="shrink-0">
                {current.action}
              </Button>
            </div>
          )}

          <ul className="bg-card rounded-2xl border border-line shadow-card divide-y divide-line overflow-hidden">
            {spots.map((s) => (
              <li key={s.id}>
                <button onClick={() => setSelected(s.id)} className={cn('w-full text-left flex items-center gap-3 p-4 hover:bg-paper', current?.id === s.id && 'bg-paper')}>
                  <span className={cn('w-10 h-10 rounded-full text-white flex items-center justify-center shrink-0', PIN_BG[s.tone])}>
                    <s.Icon className="w-5 h-5" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold">{s.name}</span>
                    <span className="block text-sm text-ink-muted truncate">{s.headline}</span>
                  </span>
                  <Pill tone={s.tone} className="hidden sm:inline-flex">{s.status}</Pill>
                  <ChevronRight className="w-5 h-5 text-ink-faint" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
