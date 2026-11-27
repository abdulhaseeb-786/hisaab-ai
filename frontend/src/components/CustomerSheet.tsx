import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Copy, Send } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useCustomerLedger, useRecordPayment, useStore } from '@/api/queries';
import type { CustomerLedger, StoreProfile } from '@/api/types';
import { useLanguage, type Language } from '@/i18n/LanguageContext';
import { cn, formatDate, formatPKR } from '@/lib/format';
import { copyText, whatsappShareUrl } from '@/lib/whatsapp';
import { Button, ButtonLink } from './ui/Button';
import { ErrorBox, Skeleton } from './ui/QueryState';
import { Sheet } from './ui/Sheet';
import { Pill } from './ui/Status';

function reminder(l: CustomerLedger, store: StoreProfile | undefined, lang: Language): string {
  const s = l.summary;
  if (!s) return '';
  const shop = store?.name ?? '';
  if (lang === 'english') {
    return `Assalam-o-Alaikum ${l.name},\nA friendly reminder from ${shop}. Your khata balance is ${formatPKR(s.total_balance_pkr)}, of which ${formatPKR(s.overdue_amount_pkr)} is past due.\nPlease pay at the counter or by Easypaisa / JazzCash when you can.\nThank you, ${store?.owner_name ?? ''}`;
  }
  return `Assalam-o-Alaikum ${l.name},\n${shop} se hisaab ki yaad dihani. Aap ka kul baqaya ${formatPKR(s.total_balance_pkr)} hai, jis mein ${formatPKR(s.overdue_amount_pkr)} ki muddat guzar chuki hai.\nBaraye meherbani dukaan par ya Easypaisa / JazzCash se ada kar dein.\nShukriya, ${store?.owner_name ?? ''}`;
}

function PaymentForm({ ledger }: { ledger: CustomerLedger }) {
  const { pick } = useLanguage();
  const pay = useRecordPayment();
  const reduce = useReducedMotion();
  const balance = ledger.summary?.total_balance_pkr ?? 0;
  const [amount, setAmount] = useState('');
  const [stamp, setStamp] = useState<number | null>(null);
  const value = Number(amount.replace(/\D/g, ''));
  const valid = value > 0 && value <= balance + 0.01;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    pay.mutate(
      { customerId: ledger.customer_id, amount: value },
      {
        onSuccess: () => {
          setAmount('');
          setStamp(value);
          window.setTimeout(() => setStamp(null), 2200);
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="pay" className="block text-lg font-bold">
        {pick('Money received', 'Raqam wasool hui')}
      </label>
      <div className="flex gap-2">
        <div className="flex-1 flex items-center rounded-xl border-2 border-line-strong bg-card px-3 focus-within:border-sabz">
          <span className="font-bold text-ink-muted">Rs</span>
          <input
            id="pay"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full min-h-[48px] bg-transparent outline-none px-2 text-xl font-bold tabular"
          />
        </div>
        <Button type="submit" disabled={!valid || pay.isPending}>
          {pay.isPending ? pick('Saving', 'Save ho raha') : pick('Save', 'Save karein')}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {ledger.summary && ledger.summary.overdue_amount_pkr > 0 && (
          <button type="button" onClick={() => setAmount(String(Math.round(ledger.summary!.overdue_amount_pkr)))} className="min-h-[40px] px-3 rounded-full border-2 border-line text-sm font-bold hover:border-ink-muted">
            {pick('Late amount', 'Late raqam')} {formatPKR(ledger.summary.overdue_amount_pkr)}
          </button>
        )}
        <button type="button" onClick={() => setAmount(String(Math.round(balance)))} className="min-h-[40px] px-3 rounded-full border-2 border-line text-sm font-bold hover:border-ink-muted">
          {pick('Full balance', 'Poora baqaya')} {formatPKR(balance)}
        </button>
      </div>
      {amount && !valid && <p className="text-sm font-bold text-lal-dark">{pick(`Enter up to ${formatPKR(balance)}.`, `${formatPKR(balance)} tak likhein.`)}</p>}
      {pay.isError && <p className="text-sm font-bold text-lal-dark">{pay.error.message}</p>}
      {pay.isSuccess && (
        <div className="flex items-center justify-between gap-3 min-h-[4.5rem]">
          <p className="flex items-center gap-2 text-base font-bold text-sabz-dark">
            <Check className="w-5 h-5 shrink-0" />
            {pick(`Saved. Balance now ${formatPKR(pay.data.new_balance)}.`, `Save ho gaya. Ab baqaya ${formatPKR(pay.data.new_balance)}.`)}
          </p>
          <div className="relative w-28 h-16 shrink-0">
      {/* The shopkeeper's "wasool" stamp lands on the page when a payment is saved. */}
            <AnimatePresence>
              {stamp !== null && (
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-xl border-[3px] border-lal text-lal px-4 py-1 text-center bg-[#FFFDF6]/80"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 2.4, rotate: -4 }}
                  animate={{ opacity: 0.92, scale: 1, rotate: -11 }}
                  exit={{ opacity: 0, transition: { duration: 0.5 } }}
                  transition={{ type: 'spring', stiffness: 520, damping: 22 }}
                >
                  <span className="block font-urdu text-3xl leading-[1.9]" lang="ur">وصول</span>
                  <span className="block text-sm font-extrabold tabular -mt-1">{formatPKR(stamp)}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </form>
  );
}

export function CustomerSheet({ customerId, onClose }: { customerId: number | null; onClose: () => void }) {
  const { pick, language } = useLanguage();
  const ledger = useCustomerLedger(customerId);
  const store = useStore();
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const l = ledger.data;
  const s = l?.summary;

  useEffect(() => {
    if (l) setMessage(reminder(l, store.data, language));
  }, [l, store.data, language]);

  return (
    <Sheet
      open={customerId !== null}
      onClose={onClose}
      title={l?.name ?? '...'}
      description={s ? pick(`Owes ${formatPKR(s.total_balance_pkr)}`, `Baqaya ${formatPKR(s.total_balance_pkr)}`) : undefined}
      footer={
        s && s.overdue_amount_pkr > 0 ? (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon={copied ? <Check className="w-5 h-5 text-sabz" /> : <Copy className="w-5 h-5" />}
              onClick={async () => {
                if (await copyText(message)) {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                }
              }}
            >
              {copied ? pick('Copied', 'Copy ho gaya') : pick('Copy', 'Copy')}
            </Button>
            <ButtonLink href={whatsappShareUrl(message, l?.phone)} target="_blank" rel="noreferrer" icon={<Send className="w-5 h-5" />} className="flex-1">
              {pick('Send reminder on WhatsApp', 'WhatsApp par yaad dihani')}
            </ButtonLink>
          </div>
        ) : undefined
      }
    >
      {ledger.isError && <ErrorBox error={ledger.error} onRetry={() => ledger.refetch()} />}
      {!l && !ledger.isError && <Skeleton className="h-64" />}
      {l && !s && <p className="text-lg font-bold text-sabz-dark">{pick('Nothing owed. All clear.', 'Koi baqaya nahi. Hisaab saaf.')}</p>}
      {l && s && (
        <div className="space-y-6">
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

          <PaymentForm ledger={l} />

          {s.overdue_amount_pkr > 0 && (
            <div className="space-y-2">
              <label htmlFor="msg" className="block text-lg font-bold">
                {pick('Reminder message', 'Yaad dihani ka paighaam')}
              </label>
              <textarea id="msg" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full p-4 rounded-xl border-2 border-line bg-card text-base leading-relaxed focus:border-sabz outline-none" />
              <p className="text-sm text-ink-muted">{pick('Demo phone numbers are made up, so WhatsApp will ask you to pick a chat.', 'Demo phone number farzi hain, is liye WhatsApp chat chunne ko kahe ga.')}</p>
            </div>
          )}

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

          <div className="space-y-2">
            <h3 className="text-lg font-bold">{pick('Khata history', 'Khata ki tareekh')}</h3>
            <ul className="bg-card rounded-2xl border border-line divide-y divide-line">
              {l.entries.slice(0, 20).map((e) => (
                <li key={e.entry_id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-sm text-ink-muted w-16 shrink-0">{formatDate(e.timestamp)}</span>
                  <span className="flex-1 text-base">{e.kind === 'payment' ? pick('Paid', 'Wasooli') : pick('Bought on khata', 'Udhaar par saman')}</span>
                  <span className={cn('font-bold tabular', e.kind === 'payment' ? 'text-sabz-dark' : 'text-ink')}>
                    {e.kind === 'payment' ? '−' : '+'}
                    {formatPKR(e.amount_pkr)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Sheet>
  );
}

export default CustomerSheet;
