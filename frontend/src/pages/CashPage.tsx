import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useCashOutlook, usePayables } from '@/api/queries';
import type { CashOutlook } from '@/api/types';
import { Money } from '@/components/ui/Money';
import { ErrorBox, Skeleton } from '@/components/ui/QueryState';
import { PageTitle, Section } from '@/components/ui/Section';
import { Pill } from '@/components/ui/Status';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn, formatDate, formatPKR, parseApiDate } from '@/lib/format';

function weekday(date: string, english: boolean): string {
  const d = parseApiDate(date);
  if (english) return d.toLocaleDateString('en-PK', { weekday: 'long' });
  return ['Itwar', 'Peer', 'Mangal', 'Budh', 'Jumeraat', 'Juma', 'Hafta'][d.getDay()] ?? '';
}

function Verdict({ o }: { o: CashOutlook }) {
  const { pick } = useLanguage();
  const ok = !o.shortfall_warning;
  return (
    <div className={cn('rounded-2xl p-5 sm:p-6 border-2', ok ? 'bg-sabz-tint border-sabz-mid' : 'bg-lal-tint border-lal/40')}>
      <div className="flex items-start gap-3">
        {ok ? <CheckCircle2 className="w-8 h-8 text-sabz shrink-0" /> : <AlertTriangle className="w-8 h-8 text-lal shrink-0" />}
        <div>
          <p className={cn('text-2xl font-extrabold leading-tight', ok ? 'text-sabz-dark' : 'text-lal-dark')}>
            {ok
              ? pick('You will have enough cash for the next 7 days.', 'Agle 7 din ke liye cash kaafi hai.')
              : pick(`Cash may run short on ${formatDate(o.shortfall_date)}.`, `${formatDate(o.shortfall_date)} ko cash kam par sakta hai.`)}
          </p>
          <p className="text-lg text-ink-soft mt-2">
            {pick('In the drawer now', 'Abhi galle mein')}: <strong className="text-ink tabular"><Money value={o.opening_cash_pkr} /></strong>.{' '}
            {pick('In 7 days, about', '7 din baad takreeban')} <strong className="text-ink tabular">{formatPKR(o.projected_closing_cash_pkr)}</strong>.
          </p>
        </div>
      </div>
      <WeekChart o={o} />
    </div>
  );
}

function WeekChart({ o }: { o: CashOutlook }) {
  const { pick, language } = useLanguage();
  const reduce = useReducedMotion();
  const points = [{ date: '', value: o.opening_cash_pkr }, ...o.days.map((d) => ({ date: d.date, value: d.closing_cash_pkr }))];
  const values = points.map((p) => p.value);
  const lo = Math.min(...values, o.safety_cash_pkr);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.12 || 1;
  const min = lo - pad;
  const max = hi + pad;
  const x = (i: number) => (i / (points.length - 1)) * 100;
  const y = (v: number) => 100 - ((v - min) / (max - min)) * 100;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(p.value).toFixed(2)}`).join(' ');
  const lowIndex = values.indexOf(Math.min(...values.slice(1))) ;
  const showSafety = o.safety_cash_pkr >= min;

  return (
    <figure className="mt-5 px-2 overflow-hidden">
      <motion.div
        className="relative h-40"
        initial={reduce ? false : { clipPath: 'inset(-20% 100% -20% 0)' }}
        animate={{ clipPath: 'inset(-20% -5% -20% 0)' }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible" role="img" aria-label={pick('Cash at the end of each day', 'Har din ke aakhir ka cash')}>
          {showSafety && <line x1={0} x2={100} y1={y(o.safety_cash_pkr)} y2={y(o.safety_cash_pkr)} stroke="#C0392B" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
          <path d={`${path} L100,100 L0,100 Z`} fill="rgba(14,107,63,0.12)" />
          <path d={path} fill="none" stroke="#0E6B3F" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
        </svg>
        {points.map((p, i) => (
          <span
            key={i}
            className={cn('absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-white', i === lowIndex ? 'bg-lal' : 'bg-sabz')}
            style={{ left: `${x(i)}%`, top: `${y(p.value)}%` }}
          />
        ))}
        <span
          className="absolute -translate-y-full -mt-2.5 px-2 py-0.5 rounded-md bg-card border border-line text-xs font-bold whitespace-nowrap tabular"
          style={{
            left: `${x(lowIndex)}%`,
            top: `${y(values[lowIndex] ?? 0)}%`,
            transform: `translate(${x(lowIndex) > 65 ? '-100%' : x(lowIndex) < 35 ? '0%' : '-50%'}, -100%)`,
          }}
        >
          {pick('Lowest', 'Sab se kam')} {formatPKR(values[lowIndex])}
        </span>
      </motion.div>
      <div className="grid mt-2 text-xs text-ink-muted" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
        {points.map((p, i) => (
          <span key={i} className={cn('text-center', i === 0 && 'text-left', i === points.length - 1 && 'text-right')}>
            {i === 0 ? pick('Now', 'Abhi') : weekday(p.date, language === 'english').slice(0, 3)}
          </span>
        ))}
      </div>
      {showSafety && (
        <figcaption className="text-xs text-ink-muted mt-2 flex items-center gap-2">
          <span className="w-5 border-t-2 border-dashed border-lal" />
          {pick(`Safety level ${formatPKR(o.safety_cash_pkr)}`, `Hifazati had ${formatPKR(o.safety_cash_pkr)}`)}
        </figcaption>
      )}
    </figure>
  );
}

function Days({ o }: { o: CashOutlook }) {
  const { pick, language } = useLanguage();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ul className="bg-card rounded-2xl border border-line shadow-card divide-y divide-line overflow-hidden">
      {o.days.map((d) => {
        const inflow = d.cash_sales_in_pkr + d.wasooli_in_pkr;
        const outflow = d.supplier_payments_out_pkr + d.expenses_out_pkr;
        const low = d.closing_cash_pkr < o.safety_cash_pkr;
        const isOpen = open === d.date;
        return (
          <li key={d.date}>
            <button onClick={() => setOpen(isOpen ? null : d.date)} aria-expanded={isOpen} className="w-full text-left p-4 hover:bg-paper">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {weekday(d.date, language === 'english')} <span className="font-normal text-ink-muted">{formatDate(d.date)}</span>
                  </p>
                  <p className="text-sm tabular mt-0.5">
                    <span className="text-sabz-dark font-bold">+{formatPKR(inflow)}</span>{' '}
                    <span className="text-lal-dark font-bold">−{formatPKR(outflow)}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn('text-lg font-extrabold tabular', low && 'text-lal-dark')}>{formatPKR(d.closing_cash_pkr)}</p>
                  <p className="text-xs text-ink-muted">{pick('left at night', 'raat ko bachay ga')}</p>
                </div>
                <ChevronDown className={cn('w-5 h-5 text-ink-faint shrink-0 mt-1 transition-transform', isOpen && 'rotate-180')} />
              </div>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 grid sm:grid-cols-2 gap-3 text-base">
                <div className="p-3 rounded-xl bg-sabz-tint">
                  <p className="font-bold text-sabz-dark mb-1">{pick('Coming in', 'Aaye ga')}</p>
                  <p className="flex justify-between"><span>{pick('Cash sales', 'Cash sale')}</span><span className="tabular">{formatPKR(d.cash_sales_in_pkr)}</span></p>
                  <p className="flex justify-between"><span>{pick('Khata repaid', 'Wasooli')}</span><span className="tabular">{formatPKR(d.wasooli_in_pkr)}</span></p>
                </div>
                <div className="p-3 rounded-xl bg-lal-tint">
                  <p className="font-bold text-lal-dark mb-1">{pick('Going out', 'Jaye ga')}</p>
                  {d.supplier_payments.map((p) => (
                    <p key={`${p.reference}`} className="flex justify-between gap-2"><span className="truncate">{p.supplier_name}</span><span className="tabular shrink-0">{formatPKR(p.amount_pkr)}</span></p>
                  ))}
                  {d.expenses.map((e) => (
                    <p key={e.category} className="flex justify-between gap-2"><span>{e.label}</span><span className="tabular shrink-0">{formatPKR(e.amount_pkr)}</span></p>
                  ))}
                  {!d.supplier_payments.length && !d.expenses.length && <p>{pick('Nothing big', 'Koi bara kharcha nahi')}</p>}
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function CashPage() {
  const { pick } = useLanguage();
  const outlook = useCashOutlook();
  const payables = usePayables();
  const o = outlook.data;

  return (
    <div className="space-y-6">
      <PageTitle title={pick('Cash', 'Cash')} subtitle={pick('Will there be enough cash to pay what is due this week?', 'Kya is hafte ke bills dene ke liye cash kaafi hoga?')} />

      {outlook.isError && <ErrorBox error={outlook.error} onRetry={() => outlook.refetch()} />}
      {!o && !outlook.isError && <Skeleton className="h-44" />}
      {o && <Verdict o={o} />}

      {o && (
        <Section title={pick('Day by day', 'Din ba din')} hint={pick('Tap a day to see what comes in and goes out', 'Kisi din par tap karein: kya aaye ga, kya jaye ga')}>
          <Days o={o} />
        </Section>
      )}

      <Section title={pick('What you owe distributors', 'Distributors ka hisaab')}>
        {payables.isError && <ErrorBox error={payables.error} onRetry={() => payables.refetch()} />}
        {!payables.data && !payables.isError && <Skeleton className="h-64" />}
        {payables.data && (
          <ul className="bg-card rounded-2xl border border-line shadow-card divide-y divide-line">
            {payables.data.suppliers.map((s) => (
              <li key={s.supplier_id} className="p-4 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{s.name}</p>
                  <p className="text-sm text-ink-muted">
                    {s.next_due_date ? pick(`Next bill due ${formatDate(s.next_due_date)}`, `Agla bill ${formatDate(s.next_due_date)} ko`) : pick('No bill due', 'Koi bill baqi nahi')}
                    {s.next_delivery_date && pick(`. Delivery coming ${formatDate(s.next_delivery_date)}.`, `. Maal ${formatDate(s.next_delivery_date)} ko aaye ga.`)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-extrabold tabular">{formatPKR(s.total_payable_pkr)}</p>
                  {s.overdue_pkr > 0 && <Pill tone="urgent" className="text-xs px-2 py-0.5">{pick(`${formatPKR(s.overdue_pkr)} late`, `${formatPKR(s.overdue_pkr)} late`)}</Pill>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {o && (
        <details className="text-base text-ink-soft group">
          <summary className="cursor-pointer font-bold min-h-[44px] flex items-center gap-2 list-none">
            <ChevronDown className="w-5 h-5 transition-transform group-open:rotate-180" />
            {pick('How is this worked out?', 'Yeh kaise nikala gaya?')}
          </summary>
          <ul className="mt-2 space-y-1 list-disc pl-6">
            {o.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
