import { HandCoins, NotebookPen, Smartphone } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useCustomerLedger, useStore } from '@/api/queries';
import type { CustomerLedger, LedgerLine, PaymentResult, StoreProfile } from '@/api/types';
import { useUi } from '@/app/UiContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn, formatDate, formatDateTime, formatNumber, formatPKR } from '@/lib/format';
import { WasooliDone, WasooliForm } from './khata/WasooliForm';
import { MessageDraft, type Draft } from './MessageDraft';
import { Button } from './ui/Button';
import { ErrorBox, Skeleton } from './ui/QueryState';
import { Sheet } from './ui/Sheet';
import { Pill } from './ui/Status';

function reminder(l: CustomerLedger, store: StoreProfile | undefined): Draft {
  const s = l.summary;
  const shop = store?.name ?? '';
  const owner = store?.owner_name ?? '';
  if (!s) return { roman_urdu: '', english: '' };
  return {
    english: `Assalam-o-Alaikum ${l.name},\nA friendly reminder from *${shop}*. Your khata balance is ${formatPKR(s.total_balance_pkr)}, of which ${formatPKR(s.overdue_amount_pkr)} is past due.\nPlease pay at the counter, or by Easypaisa / JazzCash, when you can.\nThank you, ${owner}`,
    roman_urdu: `Assalam-o-Alaikum ${l.name},\n*${shop}* se hisaab ki yaad dihani. Aap ka kul baqaya ${formatPKR(s.total_balance_pkr)} hai, jis mein ${formatPKR(s.overdue_amount_pkr)} ki muddat guzar chuki hai.\nBaraye meherbani dukaan par, ya Easypaisa / JazzCash se, ada kar dein.\nShukriya, ${owner}`,
  };
}

const METHOD: Record<string, string> = { cash: 'Cash', easypaisa: 'Easypaisa', jazzcash: 'JazzCash', bank: 'Bank' };

function HistoryLine({ e }: { e: LedgerLine }) {
  const { pick } = useLanguage();
  const pay = e.kind === 'payment';
  const items = e.items ?? [];
  return (
    <li className="px-4 py-3 space-y-1">
      <div className="flex items-start gap-3">
        <span className="text-sm text-ink-muted w-20 shrink-0 pt-0.5">{formatDateTime(e.timestamp)}</span>
        <span className="flex-1 min-w-0">
          <span className="font-bold">{pay ? pick('Paid', 'Wasooli') : pick('Udhaar', 'Udhaar')}</span>
          {pay && e.method && (
            <span className="ml-2 inline-flex items-center gap-1 text-sm text-ink-muted">
              {e.method !== 'cash' && <Smartphone className="w-4 h-4" />}
              {METHOD[e.method]}
            </span>
          )}
          {!pay && e.due_date && <span className="block text-sm text-ink-muted">{pick(`due ${formatDate(e.due_date)}`, `wapsi ${formatDate(e.due_date)}`)}</span>}
        </span>
        <span className={cn('font-extrabold tabular shrink-0', pay ? 'text-sabz-dark' : 'text-ink')}>
          {pay ? '−' : '+'}
          {formatPKR(e.amount_pkr)}
        </span>
      </div>
      {!pay && items.length > 0 && (
        <ul className="ml-[5.75rem] text-sm text-ink-soft space-y-0.5">
          {items.map((i) => (
            <li key={i.product_id} className="flex justify-between gap-3">
              <span className="truncate">
                {i.name} <span className="text-ink-muted">× {formatNumber(i.qty, 2)}</span>
              </span>
              <span className="tabular shrink-0">{formatPKR(i.line_total)}</span>
            </li>
          ))}
        </ul>
      )}
      {!pay && items.length === 0 && e.description && <p className="ml-[5.75rem] text-sm text-ink-muted">{e.description}</p>}
    </li>
  );
}

export function CustomerSheet({ customerId, onClose }: { customerId: number | null; onClose: () => void }) {
  const { pick } = useLanguage();
  const ui = useUi();
  const ledger = useCustomerLedger(customerId);
  const store = useStore();
  const [paid, setPaid] = useState<PaymentResult | null>(null);
  const [paying, setPaying] = useState(false);
  const l = ledger.data && ledger.data.customer_id === customerId ? ledger.data : undefined;
  const s = l?.summary;
  const draft = useMemo(() => (l ? reminder(l, store.data) : null), [l, store.data]);

  useEffect(() => {
    setPaid(null);
    setPaying(false);
  }, [customerId]);

  const close = () => {
    setPaid(null);
    setPaying(false);
    onClose();
  };

  return (
    <Sheet
      open={customerId !== null}
      onClose={close}
      title={l?.name ?? '...'}
      description={s ? pick(`Owes ${formatPKR(s.total_balance_pkr)}`, `Baqaya ${formatPKR(s.total_balance_pkr)}`) : l ? pick('Nothing owed', 'Koi baqaya nahi') : undefined}
    >
      {ledger.isError && <ErrorBox error={ledger.error} onRetry={() => ledger.refetch()} />}
      {!l && !ledger.isError && <Skeleton className="h-64" />}
      {l && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" icon={<NotebookPen className="w-5 h-5" />} onClick={() => ui.openUdhaar(l.customer_id)}>
              {pick('+ Udhaar', '+ Udhaar')}
            </Button>
            <Button icon={<HandCoins className="w-5 h-5" />} onClick={() => { setPaid(null); setPaying(true); }} disabled={!s}>
              {pick('+ Wasooli', '+ Wasooli')}
            </Button>
          </div>

          {paid && <WasooliDone r={paid} />}
          {/* No `s` check: paying the full balance clears the summary while saving. */}
          {paying && !paid && (
            <div className="p-4 rounded-2xl bg-card border-2 border-sabz-mid">
              <WasooliForm customerId={l.customer_id} balance={s?.total_balance_pkr ?? 0} overdue={s?.overdue_amount_pkr ?? 0} onSaved={(r) => { setPaid(r); setPaying(false); }} />
            </div>
          )}

          {!s && <p className="text-lg font-bold text-sabz-dark">{pick('Nothing owed. All clear.', 'Koi baqaya nahi. Hisaab saaf.')}</p>}
          {s && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-card border border-line">
                <p className="text-sm text-ink-muted">{pick('Late', 'Late')}</p>
                <p className={cn('text-xl font-extrabold tabular', s.overdue_amount_pkr > 0 ? 'text-lal-dark' : 'text-ink')}>{formatPKR(s.overdue_amount_pkr)}</p>
                <p className="text-sm text-ink-muted">{s.days_overdue > 0 ? pick(`oldest bill ${s.days_overdue} days`, `purana bill ${s.days_overdue} din`) : pick('nothing late', 'kuch late nahi')}</p>
              </div>
              <div className="p-4 rounded-2xl bg-card border border-line">
                <p className="text-sm text-ink-muted">{pick('Last payment', 'Aakhri payment')}</p>
                <p className="text-xl font-extrabold">{s.last_payment_date ? formatDate(s.last_payment_date) : pick('Never', 'Kabhi nahi')}</p>
                <p className="text-sm text-ink-muted">{pick(`Limit ${formatPKR(s.credit_limit_pkr)}`, `Had ${formatPKR(s.credit_limit_pkr)}`)}</p>
              </div>
            </div>
          )}

          {s && s.overdue_amount_pkr > 0 && draft && <MessageDraft draft={draft} title={pick('Reminder message', 'Yaad dihani ka paighaam')} editable />}

          {s && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">Safe Mark</h3>
                <Pill tone={s.risk_level === 'high' ? 'urgent' : s.risk_level === 'medium' ? 'watch' : 'ok'}>
                  {s.safe_mark_score} / 100
                </Pill>
              </div>
              <p className="text-sm text-ink-muted">{pick('A simple trust score. It starts at 100 and drops for these reasons:', 'Aitbaar ka asaan score. 100 se shuru hota hai aur in wajah se kam hota hai:')}</p>
              {s.score_factors.length ? (
                <ul className="space-y-1">
                  {s.score_factors.map((f) => (
                    <li key={f.reason} className="flex justify-between gap-3 text-base">
                      <span>{f.reason}</span>
                      <span className="font-bold text-lal-dark tabular shrink-0">{f.points}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-base">{pick('No deductions.', 'Koi kami nahi.')}</p>
              )}
            </div>
          )}

          {l.entries.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-lg font-bold">{pick('Khata history', 'Khata ki tareekh')}</h3>
              <p className="text-sm text-ink-muted">{pick('Who took what, when, and how it was paid back.', 'Kis ne kya liya, kab, aur kaise wapas kiya.')}</p>
              <ul className="bg-card rounded-2xl border border-line divide-y divide-line">
                {l.entries.slice(0, 25).map((e) => (
                  <HistoryLine key={e.entry_id} e={e} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

export default CustomerSheet;
