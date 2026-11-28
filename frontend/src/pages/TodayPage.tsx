import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ChevronDown, ChevronRight, ClipboardList, DoorClosed, DoorOpen, HandCoins, NotebookPen, PackageCheck, Receipt } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDashboard, useDayToday, useOrders, useStore, useTodayActions } from '@/api/queries';
import type { ActionType, KpiSummary, TodayAction } from '@/api/types';
import storeImg from '@/assets/store-isometric.jpg';
import { RegisterBook } from '@/components/RegisterBook';
import { useUi } from '@/app/UiContext';
import { Button } from '@/components/ui/Button';
import { ProductImage } from '@/components/ui/ProductImage';
import { ErrorBox, Skeleton } from '@/components/ui/QueryState';
import { Section } from '@/components/ui/Section';
import { Pill } from '@/components/ui/Status';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn, formatChange, formatDate, formatDateTime, formatNumber, formatPct, formatPKR } from '@/lib/format';

const CTA: Record<ActionType, [string, string]> = {
  restock: ['Make the order list', 'Order list banayein'],
  fix_price: ['Change the price', 'Qeemat badlein'],
  collect_khata: ['See the reminder', 'Yaad dihani dekhein'],
  clear_dead_stock: ['Make a bundle offer', 'Bundle offer banayein'],
  cash_warning: ['See the cash plan', 'Cash ka plan dekhein'],
};

const URGENCY: Record<TodayAction['urgency'], { tone: 'urgent' | 'watch' | 'neutral'; en: string; ur: string }> = {
  critical: { tone: 'urgent', en: 'Do it now', ur: 'Abhi karein' },
  high: { tone: 'watch', en: 'Important', ur: 'Ahem' },
  medium: { tone: 'neutral', en: 'This week', ur: 'Is hafte' },
  low: { tone: 'neutral', en: 'Later', ur: 'Baad mein' },
};

const URDU_DAYS = ['Itwar', 'Peer', 'Mangal', 'Budh', 'Jumeraat', 'Juma', 'Hafta'];

function greeting(hour: number, english: boolean): string {
  if (english) return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return 'Assalam-o-Alaikum';
}

function Job({ action, first }: { action: TodayAction; first: boolean }) {
  const { pick, t } = useLanguage();
  const ui = useUi();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const u = URGENCY[action.urgency];
  const id = action.target.id;

  const run = () => {
    if (action.action_type === 'restock') navigate('/app/order');
    else if (action.action_type === 'cash_warning') navigate('/app/hisaab');
    else if (id === null) return;
    else if (action.action_type === 'fix_price') ui.openProduct(id);
    else if (action.action_type === 'collect_khata') ui.openReminder(id);
    else if (action.action_type === 'clear_dead_stock') ui.openCombo(id);
  };

  return (
    <li className="relative pl-16 pr-4 sm:pr-6 py-5 border-b border-line last:border-b-0" data-tour={first ? 'first-job' : undefined}>
      <span className="absolute left-0 w-[3.25rem] text-center top-5 text-3xl font-extrabold text-lal/80 tabular" aria-hidden>
        {action.priority}
      </span>
      <div className="flex gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <Pill tone={u.tone} icon={action.urgency === 'critical' ? <AlertTriangle className="w-4 h-4" /> : undefined}>
            {pick(u.en, u.ur)}
          </Pill>
          <h3 className="text-xl font-extrabold text-ink leading-snug">{pick(action.title, action.title_ur)}</h3>
          <p className="text-base text-ink-soft">{pick(action.summary, action.summary_ur)}</p>
        </div>
        {action.image_url && <ProductImage src={action.image_url} alt="" className="hidden sm:block w-16 h-16 shrink-0" />}
      </div>

      {open && (
        <div className="mt-3 p-4 rounded-xl bg-card border border-line space-y-1.5 text-base">
          <p>
            <span className="font-bold">{t('next_step')}:</span> {pick(action.next_step, action.next_step_ur)}
          </p>
          <p>
            <span className="font-bold">{pick('Money at stake', 'Kitna paisa daao par')}:</span> {formatPKR(action.money_at_stake_pkr)}{' '}
            <span className="text-ink-muted">({action.money_at_stake_label})</span>
          </p>
        </div>
      )}

      <div className="flex flex-col items-stretch min-[400px]:flex-row min-[400px]:items-center gap-1 min-[400px]:gap-2 mt-4">
        <Button onClick={run} data-tour={first ? 'first-action' : undefined} className="min-[400px]:flex-1 sm:flex-none">
          {pick(...CTA[action.action_type])}
        </Button>
        <Button variant="ghost" className="px-3 self-start min-[400px]:self-auto" onClick={() => setOpen((v) => !v)} aria-expanded={open} icon={<ChevronDown className={cn('w-5 h-5 transition-transform', open && 'rotate-180')} />}>
          {pick('Why?', 'Kyun?')}
        </Button>
      </div>
    </li>
  );
}

function Parchi() {
  const { pick } = useLanguage();
  const actions = useTodayActions();
  const [rule, setRule] = useState(false);
  const reduce = useReducedMotion();

  return (
    <Section title={pick("Today's 3 jobs", 'Aaj ke 3 kaam')} hint={pick('Most important first', 'Sab se zaroori pehle')}>
      <motion.div
        data-tour="today-actions"
        initial={reduce ? false : { opacity: 0, y: 14, rotate: -0.6 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ type: 'spring', damping: 18, stiffness: 140 }}
        className="parchi rounded-2xl border border-line shadow-slip overflow-hidden"
      >
        {actions.isError && <ErrorBox className="m-4" error={actions.error} onRetry={() => actions.refetch()} />}
        {!actions.data && !actions.isError && (
          <div className="pl-16 pr-6 py-6 space-y-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        )}
        {actions.data &&
          (actions.data.actions.length ? (
            <ol>
              {actions.data.actions.map((a, i) => (
                <Job key={a.id} action={a} first={i === 0} />
              ))}
            </ol>
          ) : (
            <p className="pl-16 pr-6 py-8 text-lg font-bold">{pick('Nothing urgent today. Well done.', 'Aaj koi fori kaam nahi. Shabash.')}</p>
          ))}
        {actions.data && (
          <div className="pl-16 pr-6 py-3 border-t border-line bg-card/70">
            <button onClick={() => setRule((v) => !v)} className="min-h-[44px] text-sm font-bold text-ink-muted hover:text-ink" aria-expanded={rule}>
              {pick('How are these chosen?', 'Yeh kaise chune gaye?')}
            </button>
            {rule && <p className="text-sm text-ink-soft pb-2">{actions.data.ranking_rule}</p>}
          </div>
        )}
      </motion.div>
    </Section>
  );
}

function TodayRegister() {
  const { pick, language } = useLanguage();
  const store = useStore();
  const today = useDashboard('today');
  const k = today.data;
  const now = new Date();
  const english = language === 'english';
  const ownerName = store.data?.owner_name ?? '';
  const owner = ownerName ? `${ownerName.split(' ')[0]} ${ownerName.split(' ').slice(-1)[0]}` : '';
  const change = k?.revenue_change_pct ?? null;

  if (today.isError) return <ErrorBox error={today.error} onRetry={() => today.refetch()} />;

  return (
    <div data-tour="numbers">
      <RegisterBook
        ready={!!k && !!store.data}
        storeName={store.data?.name ?? ''}
        heading={
          <>
            <p className="text-base text-ink-muted">
              {english
                ? now.toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' })
                : `${URDU_DAYS[now.getDay()]}, ${now.toLocaleDateString('en-PK', { day: 'numeric', month: 'long' })}`}
            </p>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight mt-0.5 leading-tight">
              {greeting(now.getHours(), english)}
              {owner ? `, ${owner}${english ? '' : ' sahab'}` : ''}
            </h1>
            {k && (
              <p className="hidden md:block text-base text-ink-soft mt-3 max-w-xs">
                {pick(`Today's register so far: ${formatNumber(k.sales_count)} bills.`, `Aaj ke register mein ab tak ${formatNumber(k.sales_count)} bill.`)}
              </p>
            )}
          </>
        }
        lines={
          k
            ? [
                {
                  label: pick("Today's sale", 'Aaj ki sale'),
                  value: formatPKR(k.revenue_pkr),
                  note: change === null ? undefined : pick(`${formatChange(change)} vs this time yesterday`, `kal isi waqt se ${formatChange(change)}`),
                },
                {
                  label: pick('Cash in drawer', 'Galle mein cash'),
                  value: formatPKR(k.cash_in_hand_pkr),
                  note: pick(`${formatPKR(k.payables_due_7d_pkr)} due to suppliers this week`, `is hafte suppliers ko ${formatPKR(k.payables_due_7d_pkr)}`),
                  to: '/app/hisaab',
                },
                {
                  label: pick('Late khata', 'Late udhaar'),
                  value: formatPKR(k.overdue_receivables_pkr),
                  note: pick(`${k.overdue_customers_count} customers late`, `${k.overdue_customers_count} customers late`),
                  tone: k.overdue_receivables_pkr > 0 ? 'red' : 'ink',
                  to: '/app/khata',
                },
                {
                  label: pick('Running low', 'Kam maal'),
                  value: pick(`${k.products_at_risk_count} items`, `${k.products_at_risk_count} items`),
                  note: k.out_of_stock_count
                    ? pick(`${k.out_of_stock_count} finished, ${k.out_of_stock_on_order_count} already on order`, `${k.out_of_stock_count} khatam, ${k.out_of_stock_on_order_count} ka order ho chuka`)
                    : undefined,
                  tone: k.products_at_risk_count > 0 ? 'red' : 'ink',
                  to: '/app/stock?status=at_risk',
                },
              ]
            : [0, 1, 2, 3].map((i) => ({ label: [' ', ' ', ' ', ' '][i]!, value: '' }))
        }
      />
    </div>
  );
}

/** Open or close the day: the galla count that keeps every number honest. */
function DayBar() {
  const { pick } = useLanguage();
  const ui = useUi();
  const day = useDayToday();
  const d = day.data;
  if (!d) return <Skeleton className="h-[72px]" />;
  const evening = new Date().getHours() >= 20;

  if (d.state === 'not_opened') {
    return (
      <button data-tour="day-bar" onClick={() => ui.openDay('open')} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-haldi-tint border-2 border-haldi/60 text-left hover:brightness-[0.98]">
        <span className="w-12 h-12 rounded-full bg-haldi text-ink flex items-center justify-center shrink-0 animate-pulse-ring">
          <DoorOpen className="w-6 h-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-extrabold">{pick('Open the shop', 'Dukaan kholein')}</span>
          <span className="block text-sm text-ink-soft">{pick('Count the galla first, so tonight the cash adds up.', 'Pehle galla gin lein, taake raat ko hisaab barabar ho.')}</span>
        </span>
        <ChevronRight className="w-6 h-6 text-ink-faint" />
      </button>
    );
  }
  if (d.state === 'closed') {
    const diff = d.session?.closing_difference_pkr ?? 0;
    return (
      <div data-tour="day-bar" className="flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-card border border-line">
        <DoorClosed className="w-6 h-6 text-ink-muted" />
        <p className="flex-1 font-bold">
          {pick(`Day closed at ${formatDateTime(d.session?.closed_at)}.`, `Din ${formatDateTime(d.session?.closed_at)} par band hua.`)}{' '}
          <span className={cn('font-normal', Math.abs(diff) < 0.5 ? 'text-sabz-dark' : 'text-lal-dark')}>
            {Math.abs(diff) < 0.5 ? pick('Galla matched.', 'Galla barabar tha.') : diff < 0 ? pick(`${formatPKR(-diff)} short.`, `${formatPKR(-diff)} kam.`) : pick(`${formatPKR(diff)} extra.`, `${formatPKR(diff)} zyada.`)}
          </span>
        </p>
        <Button variant="ghost" size="sm" onClick={() => ui.openDay('close')}>{pick('See the day', 'Din dekhein')}</Button>
      </div>
    );
  }
  return (
    <div data-tour="day-bar" className={cn('flex flex-wrap items-center gap-3 p-4 rounded-2xl border-2', evening ? 'bg-neela-tint border-neela/40' : 'bg-card border-line')}>
      <span className="relative flex w-3 h-3 shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full rounded-full bg-sabz opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex w-3 h-3 rounded-full bg-sabz" />
      </span>
      <p className="flex-1 min-w-0 basis-48">
        <span className="font-extrabold">{pick('Shop is open', 'Dukaan khuli hai')}</span>{' '}
        <span className="text-ink-soft">
          {pick(`since ${formatDateTime(d.session?.opened_at)}. Galla should have `, `${formatDateTime(d.session?.opened_at)} se. Galle mein hone chahiye `)}
          <strong className="text-ink tabular">{formatPKR(d.cash_in_drawer_expected_pkr)}</strong>
        </span>
      </p>
      <Button size="sm" variant={evening ? 'primary' : 'secondary'} onClick={() => ui.openDay('close')} icon={<DoorClosed className="w-5 h-5" />}>
        {pick('Close the day', 'Din band karein')}
      </Button>
    </div>
  );
}

function QuickAction({ icon, label, hint, onClick, primary, tour, wide }: { icon: ReactNode; label: string; hint?: string; onClick: () => void; primary?: boolean; tour?: string; wide?: boolean }) {
  return (
    <button
      onClick={onClick}
      data-tour={tour}
      className={cn(
        'flex gap-2 p-3.5 sm:p-4 rounded-2xl border-2 text-left transition-colors',
        wide ? 'col-span-2 sm:col-span-1 flex-row items-center sm:flex-col sm:items-start min-h-[64px] sm:min-h-[112px]' : 'flex-col items-start min-h-[100px] sm:min-h-[112px]',
        primary ? 'bg-sabz text-white border-sabz hover:bg-sabz-dark' : 'bg-card border-line hover:border-ink-muted',
      )}
    >
      <span className={cn('w-11 h-11 rounded-full flex items-center justify-center shrink-0', primary ? 'bg-white/15' : 'bg-sabz-tint text-sabz')}>{icon}</span>
      <span className={cn('min-w-0', wide && 'flex-1 flex items-baseline gap-2 sm:block')}>
        <span className="block text-lg font-extrabold leading-tight">{label}</span>
        {hint && <span className={cn('block text-sm leading-snug', primary ? 'text-white/80' : 'text-ink-muted')}>{hint}</span>}
      </span>
    </button>
  );
}

function QuickActions() {
  const { pick } = useLanguage();
  const ui = useUi();
  const navigate = useNavigate();
  const pending = useOrders('pending');
  const onTheWay = pending.data?.length ?? 0;
  return (
    <section aria-label={pick('Quick actions', 'Fori kaam')} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" data-tour="quick-actions">
      <QuickAction primary icon={<NotebookPen className="w-6 h-6" />} label="+ Udhaar" hint={pick('Who took what', 'Kis ne kya liya')} onClick={() => ui.openUdhaar()} tour="quick-udhaar" />
      <QuickAction icon={<HandCoins className="w-6 h-6" />} label="+ Wasooli" hint={pick('Money received', 'Raqam aayi')} onClick={() => ui.openWasooli()} />
      <QuickAction icon={<ClipboardList className="w-6 h-6" />} label={pick('Order booker', 'Order booker aaya')} hint={pick('What to order', 'Kya mangwayein')} onClick={() => navigate('/app/order')} />
      <QuickAction icon={<PackageCheck className="w-6 h-6" />} label={pick('Delivery came', 'Maal aaya')} hint={onTheWay ? pick(`${onTheWay} on the way`, `${onTheWay} raste mein`) : pick('Check the bill', 'Bill milayein')} onClick={() => ui.openReceive()} />
      <QuickAction wide icon={<Receipt className="w-6 h-6" />} label="Kharcha" hint={pick('Paid from the galla', 'Galle se diya')} onClick={ui.openExpense} />
    </section>
  );
}

function SalesTrend({ k }: { k: KpiSummary }) {
  const { pick } = useLanguage();
  const points = k.daily_revenue;
  const max = Math.max(1, ...points.map((p) => p.revenue_pkr));
  const w = 100 / Math.max(1, points.length - 1);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * w).toFixed(2)},${(38 - (p.revenue_pkr / max) * 34).toFixed(2)}`).join(' ');
  return (
    <div className="bg-card rounded-2xl border border-line shadow-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-base text-ink-soft">
          {pick('Sales in the last 30 days', 'Pichle 30 din ki sale')}: <strong className="text-ink tabular">{formatPKR(k.revenue_pkr)}</strong>
        </p>
        <p className={cn('text-sm font-bold', (k.revenue_change_pct ?? 0) < 0 ? 'text-lal-dark' : 'text-sabz')}>
          {formatChange(k.revenue_change_pct)} {pick('vs the 30 days before', 'pichle 30 din se')}
        </p>
      </div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-20 mt-3" role="img" aria-label={pick('Daily sales, last 30 days', 'Rozana sale, pichle 30 din')}>
        <path d={`${path} L100,40 L0,40 Z`} className="fill-sabz-tint" />
        <path d={path} className="stroke-sabz fill-none" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
      </svg>
      <p className="text-sm text-ink-muted mt-2">
        {pick(
          `Gross profit ${formatPKR(k.gross_profit_pkr)} (${formatPct(k.gross_margin_pct)}), before rent, salary and bills.`,
          `Gross munafa ${formatPKR(k.gross_profit_pkr)} (${formatPct(k.gross_margin_pct)}), kiraye, tankhwah aur bills se pehle.`,
        )}{' '}
        {pick(`${formatNumber(k.sales_count)} bills, average ${formatPKR(k.average_basket_pkr)}.`, `${formatNumber(k.sales_count)} bill, ausat ${formatPKR(k.average_basket_pkr)}.`)}
      </p>
    </div>
  );
}

export default function TodayPage() {
  const { pick, language } = useLanguage();
  const store = useStore();
  const month = useDashboard('30d');

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <DayBar />
        <QuickActions />
      </div>

      <TodayRegister />

      <Parchi />

      <Section title={pick('How sales are going', 'Sale ka rujhaan')}>{month.data ? <SalesTrend k={month.data} /> : <Skeleton className="h-40" />}</Section>

      <Link to="/app/store-map" className="group flex items-center gap-4 bg-card rounded-2xl border border-line shadow-card overflow-hidden hover:border-ink-muted">
        <img src={storeImg} alt="" className="w-28 sm:w-40 h-24 sm:h-28 object-cover shrink-0" />
        <div className="py-3 pr-2 min-w-0">
          <p className="text-lg font-extrabold">{pick('Walk through your shop', 'Dukaan ka chakkar lagayein')}</p>
          <p className="text-sm text-ink-muted">{pick('See each section of the shop on a map', 'Dukaan ka har hissa naqshe par dekhein')}</p>
        </div>
        <ChevronRight className="w-6 h-6 text-ink-faint ml-auto mr-4 shrink-0 group-hover:text-ink" />
      </Link>

      {store.data?.data_end && (
        <p className="text-sm text-ink-faint">
          {pick('Demo shop with simulated records, up to', 'Demo dukaan, farzi records,')} {formatDate(store.data.data_end, true)}
          {language === 'english' ? '.' : ' tak.'}
        </p>
      )}
    </div>
  );
}
