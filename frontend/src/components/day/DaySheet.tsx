import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, PackageSearch, Truck, Users } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCloseDay, useDayToday, useOpenDay } from '@/api/queries';
import type { DayClose, DayFigures } from '@/api/types';
import { useUi } from '@/app/UiContext';
import { Button } from '@/components/ui/Button';
import { AmountInput, readAmount, Stamp } from '@/components/ui/Fields';
import { ErrorBox, Skeleton } from '@/components/ui/QueryState';
import { Sheet } from '@/components/ui/Sheet';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn, formatDateTime, formatPKR } from '@/lib/format';

/** The day in register lines, the way it would be written in the hisaab book. */
export function FigureLines({ f }: { f: DayFigures }) {
  const { pick } = useLanguage();
  const rows: { en: string; ur: string; value: number; sign?: '+' | '−'; strong?: boolean; muted?: boolean }[] = [
    { en: `Sales (${f.bills} bills)`, ur: `Sale (${f.bills} bill)`, value: f.sales_pkr, strong: true },
    { en: 'of which cash', ur: 'jis mein cash', value: f.cash_sales_pkr, muted: true },
    { en: 'Given on udhaar', ur: 'Udhaar diya', value: f.udhaar_given_pkr, muted: true },
    { en: 'Khata collected in cash', ur: 'Cash wasooli', value: f.wasooli_cash_pkr, sign: '+' },
    { en: 'Collected by Easypaisa, JazzCash, bank', ur: 'Easypaisa, JazzCash, bank se wasooli', value: f.wasooli_digital_pkr, muted: true },
    { en: 'Paid to distributors', ur: 'Distributors ko diya', value: f.supplier_payments_pkr, sign: '−' },
    { en: 'Kharcha', ur: 'Kharcha', value: f.expenses_pkr, sign: '−' },
    { en: 'Taken home or banked', ur: 'Ghar le gaye ya bank', value: f.withdrawals_pkr, sign: '−' },
  ];
  return (
    <div className="parchi rounded-2xl border border-line shadow-slip">
      <ul className="pl-16 pr-5 py-2">
        {rows
          .filter((r) => r.strong || r.value > 0)
          .map((r) => (
            <li key={r.en} className={cn('flex items-baseline justify-between gap-3 min-h-[2.25rem]', r.muted && 'text-ink-muted text-sm')}>
              <span className={cn(r.strong && 'font-bold')}>{pick(r.en, r.ur)}</span>
              <span className={cn('tabular font-bold shrink-0', r.sign === '+' && 'text-sabz-dark', r.sign === '−' && 'text-lal-dark')}>
                {r.sign && !r.muted ? `${r.sign} ` : ''}
                {formatPKR(r.value)}
              </span>
            </li>
          ))}
        <li className="flex items-baseline justify-between gap-3 min-h-[2.5rem] border-t-2 border-ink/70 mt-1 pt-1">
          <span className="font-extrabold">{pick('Gross profit', 'Gross munafa')}</span>
          <span className="tabular font-extrabold text-sabz-dark">{formatPKR(f.gross_profit_pkr)}</span>
        </li>
      </ul>
    </div>
  );
}

function Difference({ diff }: { diff: number }) {
  const { pick } = useLanguage();
  if (Math.abs(diff) < 0.5) {
    return (
      <p className="flex items-center gap-2 text-lg font-bold text-sabz-dark">
        <CheckCircle2 className="w-6 h-6" /> {pick('Matches the records exactly.', 'Records se bilkul barabar.')}
      </p>
    );
  }
  const short = diff < 0;
  return (
    <p className={cn('flex items-start gap-2 text-lg font-bold', short ? 'text-lal-dark' : 'text-haldi-dark')}>
      <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
      <span>
        {short
          ? pick(`${formatPKR(-diff)} short. It will be written in the book as a galla difference.`, `${formatPKR(-diff)} kam. Kitaab mein galle ka farq likha jaye ga.`)
          : pick(`${formatPKR(diff)} extra. It will be written in the book as a galla difference.`, `${formatPKR(diff)} zyada. Kitaab mein galle ka farq likha jaye ga.`)}
      </span>
    </p>
  );
}

type OpenM = ReturnType<typeof useOpenDay>;
type CloseM = ReturnType<typeof useCloseDay>;

function CountForm({ mode, expected, open, close }: { mode: 'open' | 'close'; expected: number; open: OpenM; close: CloseM }) {
  const { pick } = useLanguage();
  const m = mode === 'open' ? open : close;
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const value = readAmount(counted);
  const has = counted.trim() !== '';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!has) return;
    if (mode === 'open') open.mutate({ counted: value, note });
    else close.mutate({ counted: value, note });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="p-4 rounded-2xl bg-card border border-line">
        <p className="text-base text-ink-muted">{pick('The records say the galla should have', 'Records ke mutabiq galle mein hone chahiye')}</p>
        <p className="text-3xl font-extrabold tabular">{formatPKR(expected)}</p>
      </div>
      <div className="space-y-2">
        <label htmlFor="galla" className="block text-lg font-bold">
          {pick('Count the cash. How much is there?', 'Cash gin lein. Kitna hai?')}
        </label>
        <AmountInput id="galla" value={counted} onChange={setCounted} autoFocus />
        <button type="button" onClick={() => setCounted(String(Math.round(expected)))} className="min-h-[40px] px-3 rounded-full border-2 border-line text-sm font-bold hover:border-ink-muted">
          {pick(`Exactly ${formatPKR(expected)}`, `Bilkul ${formatPKR(expected)}`)}
        </button>
      </div>
      {has && <Difference diff={value - expected} />}
      {has && Math.abs(value - expected) >= 0.5 && (
        <div className="space-y-1">
          <label htmlFor="galla-note" className="text-sm font-bold text-ink-soft">
            {pick('Note (optional)', 'Note (marzi se)')}
          </label>
          <input id="galla-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={pick('e.g. gave change from pocket', 'maslan jeb se khula diya')} className="w-full min-h-[48px] px-4 rounded-xl border-2 border-line bg-card outline-none focus:border-sabz" />
        </div>
      )}
      {m.isError && <ErrorBox error={m.error} />}
      <Button type="submit" size="lg" block disabled={!has || m.isPending}>
        {m.isPending
          ? pick('Saving', 'Save ho raha')
          : mode === 'open'
            ? pick('Open the shop', 'Dukaan kholein')
            : pick('Close the day', 'Din band karein')}
      </Button>
    </form>
  );
}

const WEEKDAY_UR: Record<string, string> = {
  Monday: 'Peer', Tuesday: 'Mangal', Wednesday: 'Budh', Thursday: 'Jumeraat', Friday: 'Juma', Saturday: 'Hafta', Sunday: 'Itwar',
};

function Tomorrow({ r }: { r: DayClose }) {
  const { pick } = useLanguage();
  const ui = useUi();
  const navigate = useNavigate();
  const t = r.tomorrow;
  return (
    <div className="space-y-3">
      <h3 className="text-xl font-extrabold flex items-center gap-2">
        <CalendarClock className="w-6 h-6 text-neela" />
        {pick(`Tomorrow, ${t.weekday}`, `Kal, ${WEEKDAY_UR[t.weekday] ?? t.weekday}`)}
      </h3>
      <ul className="bg-card rounded-2xl border border-line divide-y divide-line">
        <li className="p-4">
          <p className="font-bold">
            {t.bills_due.length
              ? pick(`${formatPKR(t.bills_due_total_pkr)} of distributor bills due`, `${formatPKR(t.bills_due_total_pkr)} ke distributor bill`)
              : pick('No distributor bill due', 'Koi distributor bill nahi')}
          </p>
          {t.bills_due.map((b) => (
            <p key={b.supplier_id} className="flex justify-between gap-3 text-sm text-ink-soft">
              <span className="truncate">{b.supplier_name}</span>
              <span className="tabular shrink-0">{formatPKR(b.amount_pkr)}</span>
            </p>
          ))}
        </li>
        <li className="p-4 flex items-start gap-3">
          <Truck className="w-5 h-5 text-ink-muted mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">
              {t.distributor_visits.length ? pick('Order bookers visiting', 'Order booker aayen ge') : pick('No order booker visit', 'Koi order booker nahi aaye ga')}
            </p>
            {t.distributor_visits.length > 0 && <p className="text-sm text-ink-soft">{t.distributor_visits.map((v) => v.supplier_name).join(', ')}</p>}
          </div>
        </li>
        {t.customers_to_remind.length > 0 && (
          <li className="p-4 space-y-2">
            <p className="font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-ink-muted" />
              {pick('Ask these customers for payment', 'In customers se wasooli karein')}
            </p>
            {t.customers_to_remind.map((c) => (
              <button key={c.customer_id} onClick={() => ui.openReminder(c.customer_id)} className="w-full flex items-center gap-3 min-h-[48px] px-3 rounded-xl hover:bg-paper text-left">
                <span className="flex-1">
                  <span className="font-bold">{c.name}</span>{' '}
                  <span className="text-sm text-lal-dark">{pick(`${formatPKR(c.overdue_pkr)} late, ${c.days_overdue} days`, `${formatPKR(c.overdue_pkr)} late, ${c.days_overdue} din`)}</span>
                </span>
                <ChevronRight className="w-5 h-5 text-ink-faint" />
              </button>
            ))}
          </li>
        )}
        {t.items_running_low > 0 && (
          <li>
            <button onClick={() => { ui.closeDay(); navigate('/app/order'); }} className="w-full p-4 flex items-center gap-3 text-left hover:bg-paper">
              <PackageSearch className="w-5 h-5 text-haldi-dark shrink-0" />
              <span className="flex-1 font-bold">{pick(`${t.items_running_low} items running low: plan the order`, `${t.items_running_low} items kam hain: order ka plan banayein`)}</span>
              <ChevronRight className="w-5 h-5 text-ink-faint" />
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}

export function DaySheet() {
  const { pick } = useLanguage();
  const ui = useUi();
  const reduce = useReducedMotion();
  const day = useDayToday();
  const openM = useOpenDay();
  const closeM = useCloseDay();
  const mode = ui.day;
  const d = day.data;
  // The result comes from the mutation itself: saving refreshes the day (open -> closed),
  // and the summary must stay on screen through that refresh.
  const result: { close: DayClose | null; diff: number } | null = closeM.isSuccess
    ? { close: closeM.data, diff: closeM.data.difference_pkr }
    : openM.isSuccess
      ? { close: null, diff: openM.data.difference_pkr }
      : null;

  useEffect(() => {
    if (mode === null) {
      openM.reset();
      closeM.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Asked to close a day that was never opened: open it first.
  const effective = mode === 'close' && d?.state === 'not_opened' ? 'open' : mode;
  const closedAlready = effective === 'close' && d?.state === 'closed' && !result;

  return (
    <Sheet
      open={mode !== null}
      onClose={ui.closeDay}
      title={effective === 'open' ? pick('Open the shop', 'Dukaan kholein') : pick('Close the day', 'Din band karein')}
      description={
        effective === 'open'
          ? pick('Count the galla before the first sale.', 'Pehli sale se pehle galla gin lein.')
          : pick('Count the galla and see the whole day in one place.', 'Galla ginein aur poora din ek jagah dekhein.')
      }
    >
      {day.isError && <ErrorBox error={day.error} onRetry={() => day.refetch()} />}
      {!d && !day.isError && <Skeleton className="h-72" />}

      {d && result && (
        <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-2xl font-extrabold text-sabz-dark">
                {result.close ? pick('Day closed.', 'Din band ho gaya.') : pick('Shop is open.', 'Dukaan khul gayi.')}
              </p>
              <div className="mt-1">
                <Difference diff={result.diff} />
              </div>
            </div>
            <motion.div initial={reduce ? false : { scale: 2.2, opacity: 0, rotate: -4 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 480, damping: 22 }}>
              <Stamp urdu={result.close ? 'حساب بند' : 'دکان کھلی'} line={formatPKR(result.close?.session.closing_counted_pkr ?? d.session?.opening_counted_pkr ?? 0)} tone={result.close ? 'lal' : 'sabz'} />
            </motion.div>
          </div>
          {result.close && (
            <>
              <FigureLines f={result.close.figures} />
              <Tomorrow r={result.close} />
            </>
          )}
          <Button block variant="secondary" onClick={ui.closeDay}>
            {pick('Done', 'Theek hai')}
          </Button>
        </motion.div>
      )}

      {d && !result && closedAlready && d.session && (
        <div className="space-y-4">
          <p className="text-lg font-bold">
            {pick(`Today was closed at ${formatDateTime(d.session.closed_at)}.`, `Aaj ka din ${formatDateTime(d.session.closed_at)} par band hua.`)}
          </p>
          {d.session.closing_difference_pkr !== null && <Difference diff={d.session.closing_difference_pkr} />}
          <FigureLines f={d.today} />
        </div>
      )}

      {d && !result && !closedAlready && effective === 'open' && (
        <div className="space-y-4">
          {d.state === 'open' && !openM.isPending ? (
            <p className="text-lg font-bold text-sabz-dark">{pick('The shop is already open today.', 'Dukaan aaj pehle se khuli hai.')}</p>
          ) : (
            <>
              {d.yesterday?.closing_counted_pkr != null && (
                <p className="text-base text-ink-soft">
                  {pick(`Last night you counted ${formatPKR(d.yesterday.closing_counted_pkr)}.`, `Kal raat aap ne ${formatPKR(d.yesterday.closing_counted_pkr)} gine the.`)}
                </p>
              )}
              <CountForm mode="open" expected={d.cash_in_drawer_expected_pkr} open={openM} close={closeM} />
            </>
          )}
        </div>
      )}

      {d && !result && !closedAlready && effective === 'close' && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-lg font-bold">{pick('Today in the book', 'Aaj ka hisaab')}</h3>
            <FigureLines f={d.today} />
          </div>
          <CountForm mode="close" expected={d.cash_in_drawer_expected_pkr} open={openM} close={closeM} />
        </div>
      )}
    </Sheet>
  );
}

export default DaySheet;
