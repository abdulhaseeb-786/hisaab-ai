import { ArrowLeft, CheckCircle2, Printer, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useBusinessReport } from '@/api/queries';
import type { BusinessReport } from '@/api/types';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { ErrorBox, Skeleton } from '@/components/ui/QueryState';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn, formatChange, formatDate, formatNumber, formatPKR, formatPct } from '@/lib/format';

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="p-4 rounded-2xl border border-line bg-card print:rounded-none print:border-ink/30">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="text-xl font-extrabold tabular whitespace-nowrap">{value}</p>
      {note && <p className="text-sm text-ink-soft">{note}</p>}
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 break-inside-avoid">
      <h2 className="text-xl font-extrabold border-b-2 border-ink pb-1">{title}</h2>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y divide-line">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 py-2">
          <dt className="text-ink-soft">{k}</dt>
          <dd className="font-bold tabular text-right">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Report({ r }: { r: BusinessReport }) {
  const s = r.summary;
  const full = r.months.filter((m) => !m.is_partial);
  const maxRev = Math.max(1, ...r.months.map((m) => m.revenue_pkr));
  return (
    <article className="space-y-8 bg-card rounded-2xl border border-line shadow-card p-5 sm:p-8 print:shadow-none print:border-0 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">Business report</p>
          <h1 className="text-3xl font-extrabold">{r.store.name}</h1>
          <p className="text-ink-soft">
            {[r.store.location, r.store.owner_name && `Owner: ${r.store.owner_name}`].filter(Boolean).join(' · ')}
          </p>
          <p className="text-sm text-ink-muted mt-1">
            Prepared {formatDate(r.generated_at, true)} from {formatNumber(r.store.days_of_records)} days of shop records
            {r.store.records_since && ` (since ${formatDate(r.store.records_since, true)})`}.
          </p>
        </div>
        <Logo />
      </header>

      {r.data_label && (
        <p className="p-3 rounded-xl bg-haldi-tint text-haldi-dark font-bold text-sm print:border print:border-ink/40">
          {r.data_label}: this report is generated from a demo shop with simulated records.
        </p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Average monthly sales" value={formatPKR(s.average_monthly_sales_pkr)} note={`last ${s.full_months} full months`} />
        <Tile label="Average monthly net profit" value={formatPKR(s.average_monthly_net_profit_pkr)} note={`profitable in ${s.profitable_months} of ${s.full_months}`} />
        <Tile label="Gross margin" value={formatPct(s.average_gross_margin_pct)} note="sales minus cost of goods" />
        <Tile label="Sales trend" value={formatChange(s.sales_trend_3m_pct)} note="last 3 months vs 3 before" />
      </div>

      <Block title="Month by month">
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-ink-muted">
                <th className="py-2 px-1 font-bold">Month</th>
                <th className="py-2 px-1 font-bold text-right">Sales</th>
                <th className="py-2 px-1 font-bold w-28" aria-label="Sales bar" />
                <th className="py-2 px-1 font-bold text-right">Gross profit</th>
                <th className="py-2 px-1 font-bold text-right">Running costs</th>
                <th className="py-2 px-1 font-bold text-right">Net profit</th>
                <th className="py-2 px-1 font-bold text-right">Cash share</th>
                <th className="py-2 px-1 font-bold text-right">Days open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {r.months.map((m) => (
                <tr key={m.month} className={cn(m.is_partial && 'text-ink-muted')}>
                  <td className="py-2 px-1 font-bold whitespace-nowrap">
                    {m.month}
                    {m.is_partial && ' (so far)'}
                  </td>
                  <td className="py-2 px-1 text-right tabular">{formatPKR(m.revenue_pkr)}</td>
                  <td className="py-2 px-1">
                    <div className="h-2.5 rounded-full bg-ink/[0.06] overflow-hidden">
                      <div className={cn('h-full rounded-full', m.is_partial ? 'bg-ink-faint' : 'bg-sabz')} style={{ width: `${(m.revenue_pkr / maxRev) * 100}%` }} />
                    </div>
                  </td>
                  <td className="py-2 px-1 text-right tabular">{formatPKR(m.gross_profit_pkr)}</td>
                  <td className="py-2 px-1 text-right tabular">{formatPKR(m.operating_expenses_pkr)}</td>
                  <td className={cn('py-2 px-1 text-right tabular font-bold', m.net_profit_pkr < 0 && 'text-lal-dark')}>{formatPKR(m.net_profit_pkr)}</td>
                  <td className="py-2 px-1 text-right tabular">{formatPct(m.cash_sales_pct, 0)}</td>
                  <td className="py-2 px-1 text-right tabular">{m.days_trading}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {full.length < 6 && <p className="text-sm text-ink-muted">Only {full.length} full months of records are available.</p>}
      </Block>

      <div className="grid md:grid-cols-2 gap-8">
        <Block title="What the shop has and owes today">
          <Rows
            rows={[
              ['Cash in hand', formatPKR(r.position.cash_in_hand_pkr)],
              ['Stock on the shelves (at cost)', formatPKR(r.position.stock_value_at_cost_pkr)],
              ['Owed by customers (khata)', formatPKR(r.position.customer_credit_outstanding_pkr)],
              ['Owed to distributors', `− ${formatPKR(r.position.supplier_bills_outstanding_pkr)}`],
              ['Working capital', formatPKR(r.position.working_capital_pkr)],
            ]}
          />
        </Block>
        <Block title="Customer credit (khata)">
          <Rows
            rows={[
              ['Outstanding', formatPKR(r.credit.outstanding_pkr)],
              ['Overdue', `${formatPKR(r.credit.overdue_pkr)} (${formatPct(r.credit.overdue_pct, 0)})`],
              ['Customers with a balance', String(r.credit.customers_with_balance)],
              ['Given in the last 90 days', formatPKR(r.credit.given_90d_pkr)],
              ['Collected in the last 90 days', `${formatPKR(r.credit.collected_90d_pkr)}${r.credit.collection_ratio_pct != null ? ` (${formatPct(r.credit.collection_ratio_pct, 0)})` : ''}`],
            ]}
          />
        </Block>
        <Block title="Distributors">
          <Rows
            rows={[
              ['Bills outstanding', formatPKR(r.suppliers.outstanding_pkr)],
              ['Overdue', formatPKR(r.suppliers.overdue_pkr)],
              ['Bought in the last 90 days', formatPKR(r.suppliers.billed_90d_pkr)],
              ['Paid in the last 90 days', formatPKR(r.suppliers.paid_90d_pkr)],
              ['Average purchases a month', formatPKR(r.suppliers.average_monthly_purchases_pkr)],
            ]}
          />
        </Block>
        <Block title="Record keeping">
          <Rows
            rows={[
              ['Days the cash was counted (last 30)', `${r.record_keeping.days_closed_last_30} of 30`],
              ['Days it matched the records', String(r.record_keeping.days_galla_matched)],
              ['Total cash difference (30 days)', formatPKR(r.record_keeping.galla_difference_30d_pkr)],
            ]}
          />
        </Block>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Block title="Strengths">
          <ul className="space-y-2">
            {r.strengths.map((x) => (
              <li key={x} className="flex gap-2">
                <CheckCircle2 className="w-5 h-5 text-sabz shrink-0 mt-0.5" />
                {x}
              </li>
            ))}
            {!r.strengths.length && <li className="text-ink-muted">None listed.</li>}
          </ul>
        </Block>
        <Block title="Points to watch">
          <ul className="space-y-2">
            {r.cautions.map((x) => (
              <li key={x} className="flex gap-2">
                <TriangleAlert className="w-5 h-5 text-haldi-dark shrink-0 mt-0.5" />
                {x}
              </li>
            ))}
            {!r.cautions.length && <li className="text-ink-muted">None.</li>}
          </ul>
        </Block>
      </div>

      <Block title="How the numbers are worked out">
        <ul className="list-disc pl-5 space-y-1 text-sm text-ink-soft">
          {r.method_notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </Block>
    </article>
  );
}

export default function ReportPage() {
  const { pick } = useLanguage();
  const report = useBusinessReport();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to="/app/hisaab" className="inline-flex items-center gap-2 min-h-[44px] font-bold text-ink-muted hover:text-ink">
          <ArrowLeft className="w-5 h-5" /> {pick('Hisaab', 'Hisaab')}
        </Link>
        <Button onClick={() => window.print()} icon={<Printer className="w-5 h-5" />} disabled={!report.data}>
          {pick('Print or save as PDF', 'Print ya PDF save karein')}
        </Button>
      </div>
      <p className="text-base text-ink-soft print:hidden">
        {pick('This report is in English because banks and microfinance officers ask for it that way. Every number comes from your own records.', 'Yeh report English mein hai kyun ke bank aur microfinance wale isi tarah maangte hain. Har number aap ke apne records se hai.')}
      </p>
      {report.isError && <ErrorBox error={report.error} onRetry={() => report.refetch()} />}
      {!report.data && !report.isError && <Skeleton className="h-[40rem]" />}
      {report.data && <Report r={report.data} />}
    </div>
  );
}
