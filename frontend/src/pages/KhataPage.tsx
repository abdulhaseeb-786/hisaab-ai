import { CheckCircle2, ChevronRight, HandCoins, NotebookPen, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useState } from 'react';
import { useCreditSummary } from '@/api/queries';
import type { CreditSummary, KhataCustomer } from '@/api/types';
import { useUi } from '@/app/UiContext';
import { Money } from '@/components/ui/Money';
import { EmptyState, ErrorBox, Skeleton } from '@/components/ui/QueryState';
import { PageTitle, Section } from '@/components/ui/Section';
import { Pill } from '@/components/ui/Status';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn, formatPKR } from '@/lib/format';

function initials(name: string): string {
  return name
    .replace(/\(.*?\)/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function AgingBar({ d }: { d: CreditSummary }) {
  const { pick } = useLanguage();
  const a = d.aging;
  const total = Math.max(1, a.total_outstanding_pkr);
  const parts = [
    { value: a.not_due_pkr, cls: 'bg-sabz-500', en: 'Not due yet', ur: 'Abhi waqt hai' },
    { value: a.overdue_1_30_days_pkr, cls: 'bg-haldi-400', en: 'Up to 30 days late', ur: '30 din tak late' },
    { value: a.overdue_31_60_days_pkr + a.overdue_61_plus_days_pkr, cls: 'bg-lal-500', en: 'More than 30 days late', ur: '30 din se zyada late' },
  ];
  return (
    <div className="bg-card rounded-2xl border border-lal-100 shadow-card p-5 space-y-4">
      <div>
        <p className="text-base text-ink-muted">{pick('Customers owe you', 'Customers ka kul udhaar')}</p>
        <p className={cn('text-3xl font-extrabold tabular', d.total_overdue_customers > 0 ? 'text-lal-700' : 'text-ink')}>
          <Money value={a.total_outstanding_pkr} />
        </p>
        <p className="text-base text-ink-soft">
          {pick(`${d.total_customers_with_balance} customers. ${d.total_overdue_customers} are late.`, `${d.total_customers_with_balance} customers. ${d.total_overdue_customers} late hain.`)}
        </p>
      </div>
      <div className="flex h-4 rounded-full overflow-hidden bg-ink/[0.06]" aria-hidden>
        {parts.map((p) => (p.value > 0 ? <div key={p.en} className={p.cls} style={{ width: `${(p.value / total) * 100}%` }} /> : null))}
      </div>
      <ul className="grid sm:grid-cols-3 gap-2">
        {parts.map((p) => (
          <li key={p.en} className="flex items-center gap-2">
            <span className={cn('w-3 h-3 rounded-full shrink-0', p.cls)} />
            <span className="text-sm text-ink-muted">{pick(p.en, p.ur)}</span>
            <span className="ml-auto sm:ml-0 font-bold tabular">{formatPKR(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CustomerRow({ c }: { c: KhataCustomer }) {
  const { pick } = useLanguage();
  const ui = useUi();
  const late = c.overdue_amount_pkr > 0;
  return (
    <li>
      <button onClick={() => ui.openReminder(c.customer_id)} className="w-full text-left flex items-start gap-3 p-4 hover:bg-lal-50/40">
        <span className={cn('w-12 h-12 rounded-full flex items-center justify-center font-extrabold shrink-0', late ? 'bg-lal-100 text-lal-700' : 'bg-sabz-100 text-sabz-700')} aria-hidden>
          {initials(c.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink leading-snug">{c.name}</p>
          {late ? (
            <p className="text-sm text-lal-600 font-bold">
              {pick(`${formatPKR(c.overdue_amount_pkr)} late, oldest bill ${c.days_overdue} days`, `${formatPKR(c.overdue_amount_pkr)} late, purana bill ${c.days_overdue} din`)}
            </p>
          ) : (
            <p className="text-sm text-ink-muted">{pick('Nothing late', 'Kuch late nahi')}</p>
          )}
          {c.over_limit && (
            <Pill tone="urgent" className="text-xs px-2 py-0.5 mt-1">
              {pick('Over credit limit', 'Udhaar ki had se zyada')}
            </Pill>
          )}
        </div>
        <p className="text-lg font-extrabold tabular shrink-0 self-start mt-0.5">{formatPKR(c.total_balance_pkr)}</p>
        <ChevronRight className="w-5 h-5 text-ink-faint shrink-0" />
      </button>
    </li>
  );
}

export default function KhataPage() {
  const { pick } = useLanguage();
  const ui = useUi();
  const credit = useCreditSummary();
  const [search, setSearch] = useState('');
  const d = credit.data;
  const match = (c: KhataCustomer) => !search || c.name.toLowerCase().includes(search.toLowerCase());
  const late = d?.customers.filter((c) => c.overdue_amount_pkr > 0 && match(c)) ?? [];
  const others = d?.customers.filter((c) => c.overdue_amount_pkr <= 0 && match(c)) ?? [];

  return (
    <div className="space-y-6">
      <PageTitle title={pick('Khata', 'Khata')} subtitle={pick('Who owes you, and who to collect from first.', 'Kis ka kitna udhaar hai, aur pehle kis se wasooli karni hai.')} />

      <div className="grid grid-cols-2 gap-3">
        <Button size="lg" icon={<NotebookPen className="w-6 h-6" />} onClick={() => ui.openUdhaar()} data-tour="khata-udhaar">
          {pick('+ Udhaar', '+ Udhaar')}
        </Button>
        <Button size="lg" variant="secondary" icon={<HandCoins className="w-6 h-6" />} onClick={() => ui.openWasooli()}>
          {pick('+ Wasooli', '+ Wasooli')}
        </Button>
      </div>
      <p className="text-sm text-ink-muted -mt-2">
        {pick('Every udhaar is written with the items, prices and due date. Before you save, HisaabAI answers "Udhaar dun?" for that customer.', 'Har udhaar items, qeemat aur wapsi ki tareekh ke saath likha jata hai. Save se pehle HisaabAI us customer ke liye "Udhaar dun?" ka jawab deta hai.')}
      </p>

      {credit.isError && <ErrorBox error={credit.error} onRetry={() => credit.refetch()} />}
      {!d && !credit.isError && <Skeleton className="h-56" />}
      {d && <AgingBar d={d} />}

      {d && d.customers.length > 0 && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={pick('Find a customer', 'Customer dhoondein')}
            aria-label={pick('Find a customer', 'Customer dhoondein')}
            className="w-full min-h-[52px] pl-12 pr-4 rounded-2xl bg-card border-2 border-line focus:border-lal-500 outline-none text-base"
          />
        </div>
      )}

      {d && late.length > 0 && (
        <Section title={pick('Collect from these first', 'Pehle in se wasooli karein')} hint={pick('Biggest and oldest late amounts first', 'Sab se zyada aur purana udhaar pehle')}>
          <ul className="bg-card rounded-2xl border border-line shadow-card divide-y divide-line overflow-hidden">
            {late.map((c) => (
              <CustomerRow key={c.customer_id} c={c} />
            ))}
          </ul>
        </Section>
      )}

      {d && others.length > 0 && (
        <Section title={pick('Paying on time', 'Waqt par dene wale')}>
          <ul className="bg-card rounded-2xl border border-line shadow-card divide-y divide-line overflow-hidden">
            {others.map((c) => (
              <CustomerRow key={c.customer_id} c={c} />
            ))}
          </ul>
        </Section>
      )}

      {d && d.customers.length === 0 && (
        <EmptyState icon={<CheckCircle2 className="w-7 h-7" />} title={pick('No one owes you anything', 'Kisi ka udhaar baqi nahi')} />
      )}
    </div>
  );
}
