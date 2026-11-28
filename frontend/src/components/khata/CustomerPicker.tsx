import { ChevronRight, Search, UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useCreateCustomer, useCustomers } from '@/api/queries';
import type { CustomerItem } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { AmountInput, readAmount } from '@/components/ui/Fields';
import { ErrorBox, Skeleton } from '@/components/ui/QueryState';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn, formatPKR } from '@/lib/format';
import { useDebounced } from '@/lib/useDebounced';

export function initials(name: string): string {
  return name
    .replace(/\(.*?\)/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function NewCustomer({ initialName, onCreated, onCancel }: { initialName: string; onCreated: (c: CustomerItem) => void; onCancel: () => void }) {
  const { pick } = useLanguage();
  const create = useCreateCustomer();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState('');
  const [limit, setLimit] = useState('5000');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return;
    create.mutate({ name: name.trim(), phone, creditLimit: readAmount(limit) }, { onSuccess: onCreated });
  };
  return (
    <form onSubmit={submit} className="space-y-4 p-4 rounded-2xl bg-card border-2 border-sabz-mid">
      <p className="text-lg font-bold">{pick('New khata', 'Naya khata')}</p>
      <div className="space-y-1">
        <label htmlFor="nc-name" className="text-sm font-bold text-ink-soft">{pick('Name', 'Naam')}</label>
        <input id="nc-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="w-full min-h-[48px] px-4 rounded-xl border-2 border-line bg-paper outline-none focus:border-sabz text-lg" />
      </div>
      <div className="space-y-1">
        <label htmlFor="nc-phone" className="text-sm font-bold text-ink-soft">{pick('Phone (optional)', 'Phone (marzi se)')}</label>
        <input id="nc-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} placeholder="03xx-xxxxxxx" className="w-full min-h-[48px] px-4 rounded-xl border-2 border-line bg-paper outline-none focus:border-sabz text-lg" />
      </div>
      <div className="space-y-1">
        <label htmlFor="nc-limit" className="text-sm font-bold text-ink-soft">{pick('Credit limit', 'Udhaar ki had')}</label>
        <AmountInput id="nc-limit" value={limit} onChange={setLimit} size="md" />
        <p className="text-sm text-ink-muted">{pick('HisaabAI warns you before the khata goes above this.', 'Khata is se upar jaye to HisaabAI pehle bataye ga.')}</p>
      </div>
      {create.isError && <ErrorBox error={create.error} />}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onCancel}>{pick('Cancel', 'Rehne dein')}</Button>
        <Button type="submit" className="flex-1" disabled={name.trim().length < 2 || create.isPending}>
          {create.isPending ? pick('Saving', 'Save ho raha') : pick('Open khata', 'Khata kholein')}
        </Button>
      </div>
    </form>
  );
}

/** Who is at the counter? Most recently active customers first, so regulars are one tap away. */
export function CustomerPicker({ onPick, onlyWithBalance, allowNew = true }: { onPick: (c: CustomerItem) => void; onlyWithBalance?: boolean; allowNew?: boolean }) {
  const { pick } = useLanguage();
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const q = useCustomers(useDebounced(search.trim(), 250));
  const list = (q.data ?? []).filter((c) => !onlyWithBalance || c.balance_pkr > 0);

  if (adding) return <NewCustomer initialName={search} onCreated={onPick} onCancel={() => setAdding(false)} />;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" aria-hidden />
        <input
          type="search"
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={pick('Customer name or phone', 'Customer ka naam ya phone')}
          aria-label={pick('Find the customer', 'Customer dhoondein')}
          className="w-full min-h-[52px] pl-12 pr-4 rounded-2xl bg-card border-2 border-line focus:border-sabz outline-none text-lg"
        />
      </div>
      {allowNew && (
        <button onClick={() => setAdding(true)} className="w-full flex items-center gap-3 min-h-[56px] px-4 rounded-2xl border-2 border-dashed border-sabz-mid text-sabz-dark font-bold hover:bg-sabz-tint">
          <UserPlus className="w-6 h-6" />
          {search.trim() ? pick(`New khata for "${search.trim()}"`, `"${search.trim()}" ka naya khata`) : pick('New customer', 'Naya customer')}
        </button>
      )}
      {q.isError && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
      {!q.data && !q.isError && <Skeleton className="h-48" />}
      {q.data && (
        <ul className="bg-card rounded-2xl border border-line divide-y divide-line overflow-hidden">
          {list.map((c) => {
            const late = c.overdue_pkr > 0;
            return (
              <li key={c.customer_id}>
                <button onClick={() => onPick(c)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-paper min-h-[64px]">
                  <span className={cn('w-11 h-11 rounded-full flex items-center justify-center font-extrabold shrink-0', late ? 'bg-lal-tint text-lal-dark' : 'bg-sabz-tint text-sabz-dark')} aria-hidden>
                    {initials(c.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold leading-snug">{c.name}</span>
                    <span className={cn('block text-sm', late ? 'text-lal-dark font-bold' : 'text-ink-muted')}>
                      {late ? pick(`${formatPKR(c.overdue_pkr)} late`, `${formatPKR(c.overdue_pkr)} late`) : c.balance_pkr > 0 ? pick('Pays on time', 'Waqt par deta hai') : pick('Nothing owed', 'Koi baqaya nahi')}
                    </span>
                  </span>
                  <span className="font-extrabold tabular shrink-0">{formatPKR(c.balance_pkr)}</span>
                  <ChevronRight className="w-5 h-5 text-ink-faint shrink-0" />
                </button>
              </li>
            );
          })}
          {list.length === 0 && <li className="p-4 text-ink-muted">{pick('No customer found.', 'Koi customer nahi mila.')}</li>}
        </ul>
      )}
    </div>
  );
}
