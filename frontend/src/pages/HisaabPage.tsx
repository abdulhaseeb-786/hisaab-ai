import { ChevronDown, ChevronRight, DoorClosed, DoorOpen, FileText, Receipt, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCashOutlook, useDayHistory, useDayToday, usePayables } from '@/api/queries';
import { useUi } from '@/app/UiContext';
import { FigureLines } from '@/components/day/DaySheet';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { ErrorBox, Skeleton } from '@/components/ui/QueryState';
import { PageTitle, Section } from '@/components/ui/Section';
import { Pill } from '@/components/ui/Status';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn, formatDate, formatDateTime, formatPKR, parseApiDate } from '@/lib/format';
import { Days, Verdict } from './CashPage';

function Galla() {
  const { pick } = useLanguage();
  const ui = useUi();
  const day = useDayToday();
  const d = day.data;
  if (day.isError) return <ErrorBox error={day.error} onRetry={() => day.refetch()} />;
  if (!d) return <Skeleton className="h-72" />;
  return (
    <div className="grid lg:grid-cols-[1fr_1.1fr] gap-4">
      <div className="bg-haldi-50 rounded-2xl border-2 border-haldi-200 shadow-card p-5 space-y-4">
        <div>
          <p className="text-base font-bold text-haldi-800">{pick('Should be in the cash box now', 'Abhi cash box mein hone chahiye')}</p>
          <p className="text-4xl font-extrabold tabular text-haldi-950">
            <Money value={d.cash_in_drawer_expected_pkr} />
          </p>
          <p className="text-sm text-ink-muted mt-1">
            {d.state === 'open' && d.session
              ? pick(`Open since ${formatDateTime(d.session.opened_at)}, counted ${formatPKR(d.session.opening_counted_pkr)}.`, `${formatDateTime(d.session.opened_at)} se khuli, ${formatPKR(d.session.opening_counted_pkr)} gine.`)
              : d.state === 'closed' && d.session
                ? pick(`Closed at ${formatDateTime(d.session.closed_at)}.`, `${formatDateTime(d.session.closed_at)} par band.`)
                : pick('The shop has not been opened today.', 'Aaj dukaan abhi nahi khuli.')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {d.state === 'not_opened' && (
            <Button onClick={() => ui.openDay('open')} icon={<DoorOpen className="w-5 h-5" />}>{pick('Open the shop', 'Dukaan kholein')}</Button>
          )}
          {d.state === 'open' && (
            <Button onClick={() => ui.openDay('close')} icon={<DoorClosed className="w-5 h-5" />}>{pick('Close the day', 'Din band karein')}</Button>
          )}
          <Button variant="secondary" onClick={ui.openExpense} icon={<Receipt className="w-5 h-5" />}>{pick('Kharcha', 'Kharcha')}</Button>
        </div>
      </div>
      <div className="space-y-2">
        <p className="font-bold">{pick('Today so far', 'Aaj ab tak')}</p>
        <FigureLines f={d.today} />
      </div>
    </div>
  );
}

function History() {
  const { pick, language } = useLanguage();
  const history = useDayHistory(14);
  if (!history.data?.length) return null;
  return (
    <Section title={pick('Last two weeks', 'Pichle do hafte')} hint={pick('Sales and the cash box count each night', 'Har raat ki sale aur cash box ki ginti')}>
      <ul className="bg-card rounded-2xl border border-line shadow-card divide-y divide-line">
        {history.data.map((h) => {
          const diff = h.closing_difference_pkr;
          const d = parseApiDate(h.business_date);
          return (
            <li key={h.session_id} className="p-4 flex items-center gap-3">
              <span className="w-24 shrink-0">
                <span className="block font-bold">{language === 'english' ? d.toLocaleDateString('en-PK', { weekday: 'short' }) : ['Itwar', 'Peer', 'Mangal', 'Budh', 'Jumeraat', 'Juma', 'Hafta'][d.getDay()]}</span>
                <span className="block text-sm text-ink-muted">{formatDate(h.business_date)}</span>
              </span>
              <span className="flex-1 min-w-0 text-sm text-ink-soft">
                {pick('Sale', 'Sale')} <strong className="text-ink tabular">{formatPKR(h.figures.sales_pkr)}</strong>
                <span className="hidden sm:inline">
                  {' '}· {pick('profit', 'munafa')} <span className="tabular">{formatPKR(h.figures.gross_profit_pkr)}</span>
                </span>
              </span>
              {diff === null ? (
                <Pill tone="info" className="text-xs">{pick('Open', 'Khuli')}</Pill>
              ) : Math.abs(diff) < 0.5 ? (
                <Pill tone="ok" className="text-xs">{pick('Cash Box matched', 'Cash Box barabar')}</Pill>
              ) : (
                <Pill tone={diff < 0 ? 'urgent' : 'watch'} className="text-xs">
                  {diff < 0 ? pick(`${formatPKR(-diff)} short`, `${formatPKR(-diff)} kam`) : pick(`${formatPKR(diff)} extra`, `${formatPKR(diff)} zyada`)}
                </Pill>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function Bills() {
  const { pick } = useLanguage();
  const ui = useUi();
  const payables = usePayables();
  return (
    <Section title={pick('Distributor bills', 'Distributors ke bill')} hint={pick('Payments clear the oldest bill first', 'Payment se sab se purana bill pehle saaf hota hai')}>
      {payables.isError && <ErrorBox error={payables.error} onRetry={() => payables.refetch()} />}
      {!payables.data && !payables.isError && <Skeleton className="h-64" />}
      {payables.data && (
        <ul className="bg-card rounded-2xl border border-line shadow-card divide-y divide-line">
          {payables.data.suppliers.map((s) => (
            <li key={s.supplier_id} className="p-4 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1 basis-48">
                <p className="font-bold">{s.name}</p>
                <p className="text-sm text-ink-muted">
                  {s.next_due_date ? pick(`Next bill due ${formatDate(s.next_due_date)}`, `Agla bill ${formatDate(s.next_due_date)} ko`) : pick('No bill due', 'Koi bill baqi nahi')}
                  {s.next_delivery_date && pick(`. Delivery coming ${formatDate(s.next_delivery_date)}.`, `. Maal ${formatDate(s.next_delivery_date)} ko aaye ga.`)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-extrabold tabular">{formatPKR(s.total_payable_pkr)}</p>
                {s.overdue_pkr > 0 && <Pill tone="urgent" className="text-xs px-2 py-0.5">{pick(`${formatPKR(s.overdue_pkr)} late`, `${formatPKR(s.overdue_pkr)} late`)}</Pill>}
              </div>
              {s.total_payable_pkr > 0 && (
                <Button size="sm" variant="secondary" onClick={() => ui.openPaySupplier(s.supplier_id)} icon={<Wallet className="w-4 h-4" />}>
                  {pick('Pay', 'Payment')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export default function HisaabPage() {
  const { pick } = useLanguage();
  const outlook = useCashOutlook();
  const o = outlook.data;
  return (
    <div className="space-y-8">
      <PageTitle title={pick('Hisaab', 'Hisaab')} subtitle={pick('The cash box, the week ahead, distributor bills, and a report for the bank.', 'Cash Box, aane wala hafta, distributors ke bill, aur bank ke liye report.')} />

      <Section title={pick('Cash Box', 'Cash Box')}>
        <Galla />
      </Section>

      <Section title={pick('Next 7 days', 'Agle 7 din')}>
        {outlook.isError && <ErrorBox error={outlook.error} onRetry={() => outlook.refetch()} />}
        {!o && !outlook.isError && <Skeleton className="h-44" />}
        {o && <Verdict o={o} />}
        {o && (
          <details className="group">
            <summary className="cursor-pointer list-none min-h-[44px] flex items-center gap-2 font-bold text-ink-soft">
              <ChevronDown className="w-5 h-5 transition-transform group-open:rotate-180" />
              {pick('Day by day', 'Din ba din')}
            </summary>
            <div className="mt-2 space-y-3">
              <Days o={o} />
              <ul className="space-y-1 list-disc pl-6 text-sm text-ink-muted">
                {o.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          </details>
        )}
      </Section>

      <Bills />

      <Link to="/app/report" className="group flex items-center gap-4 bg-sabz-900 border-2 border-haldi-400 text-white rounded-2xl p-5 hover:bg-sabz-800 transition-colors" data-tour="report-link">
        <span className="w-12 h-12 rounded-full bg-haldi-400 text-sabz-950 flex items-center justify-center shrink-0">
          <FileText className="w-6 h-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-extrabold">{pick('Business report for a loan', 'Loan ke liye karobar ki report')}</span>
          <span className="block text-sm text-sabz-200">{pick('Six months of sales, profit after costs, khata and bills, ready to print for a bank or microfinance officer.', 'Chhe mahine ki sale, kharche ke baad munafa, khata aur bill, bank ya microfinance ke liye print karne ko tayyar.')}</span>
        </span>
        <ChevronRight className={cn('w-6 h-6 text-haldi-300 group-hover:text-white')} />
      </Link>

      <History />
    </div>
  );
}
