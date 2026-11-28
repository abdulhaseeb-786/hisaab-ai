import { CheckCircle2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useDayToday, usePaySupplier, useSuppliers } from '@/api/queries';
import type { PaymentMethod } from '@/api/types';
import { useUi } from '@/app/UiContext';
import { Button } from '@/components/ui/Button';
import { AmountInput, MethodPicker, readAmount } from '@/components/ui/Fields';
import { ErrorBox, Skeleton } from '@/components/ui/QueryState';
import { Sheet } from '@/components/ui/Sheet';
import { useLanguage } from '@/i18n/LanguageContext';
import { formatPKR } from '@/lib/format';

export function PaySupplierSheet() {
  const { pick } = useLanguage();
  const ui = useUi();
  const suppliers = useSuppliers();
  const day = useDayToday();
  const pay = usePaySupplier();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const s = suppliers.data?.suppliers.find((x) => x.supplier_id === ui.paySupplierId);
  const value = readAmount(amount);
  const cash = day.data?.cash_in_drawer_expected_pkr ?? 0;
  const owed = s?.total_payable_pkr ?? 0;
  const overOwed = value > owed + 0.01;
  const overCash = method === 'cash' && value > cash + 0.01;

  useEffect(() => {
    if (ui.paySupplierId === null) {
      setAmount('');
      setMethod('cash');
      pay.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.paySupplierId]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!s || value <= 0 || overOwed || overCash) return;
    pay.mutate({ supplierId: s.supplier_id, amount: value, method });
  };

  return (
    <Sheet open={ui.paySupplierId !== null} onClose={ui.closePaySupplier} title={s ? pick(`Pay ${s.name}`, `${s.name} ko payment`) : '...'} description={s ? pick(`You owe ${formatPKR(owed)}`, `Dene hain ${formatPKR(owed)}`) : undefined}>
      {!s && <Skeleton className="h-56" />}
      {s && pay.isSuccess && (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-2xl font-extrabold text-sabz-dark">
            <CheckCircle2 className="w-7 h-7" /> {pick('Payment written in the book.', 'Payment kitaab mein likh di.')}
          </p>
          <p className="text-lg">
            {pick(`Paid ${formatPKR(pay.data.amount_paid_pkr)}. Still owed: ${formatPKR(pay.data.remaining_payable_pkr)}. Galla now ${formatPKR(pay.data.cash_in_drawer_pkr)}.`, `${formatPKR(pay.data.amount_paid_pkr)} diye. Ab baqi: ${formatPKR(pay.data.remaining_payable_pkr)}. Galle mein ab ${formatPKR(pay.data.cash_in_drawer_pkr)}.`)}
          </p>
          <p className="text-sm text-ink-muted">{pick('The oldest bills are cleared first.', 'Sab se purane bill pehle saaf hote hain.')}</p>
          <Button block onClick={ui.closePaySupplier}>{pick('Done', 'Theek hai')}</Button>
        </div>
      )}
      {s && !pay.isSuccess && (
        <form onSubmit={submit} className="space-y-4">
          <label htmlFor="pay-sup" className="block text-lg font-bold">{pick('How much are you paying?', 'Kitne de rahe hain?')}</label>
          <AmountInput id="pay-sup" value={amount} onChange={setAmount} invalid={overOwed || overCash} autoFocus />
          <div className="flex flex-wrap gap-2">
            {s.overdue_pkr > 0 && (
              <button type="button" onClick={() => setAmount(String(Math.round(s.overdue_pkr)))} className="min-h-[40px] px-3 rounded-full border-2 border-line text-sm font-bold hover:border-ink-muted">
                {pick('Late bills', 'Late bill')} {formatPKR(s.overdue_pkr)}
              </button>
            )}
            {s.due_within_7_days_pkr > 0 && s.due_within_7_days_pkr !== s.overdue_pkr && (
              <button type="button" onClick={() => setAmount(String(Math.round(s.due_within_7_days_pkr)))} className="min-h-[40px] px-3 rounded-full border-2 border-line text-sm font-bold hover:border-ink-muted">
                {pick('Due this week', 'Is hafte ke')} {formatPKR(s.due_within_7_days_pkr)}
              </button>
            )}
            <button type="button" onClick={() => setAmount(String(Math.round(owed)))} className="min-h-[40px] px-3 rounded-full border-2 border-line text-sm font-bold hover:border-ink-muted">
              {pick('Everything', 'Poora')} {formatPKR(owed)}
            </button>
          </div>
          {overOwed && <p className="text-sm font-bold text-lal-dark">{pick(`You owe only ${formatPKR(owed)}.`, `Sirf ${formatPKR(owed)} dene hain.`)}</p>}
          {overCash && !overOwed && <p className="text-sm font-bold text-lal-dark">{pick(`Only ${formatPKR(cash)} is in the galla.`, `Galle mein sirf ${formatPKR(cash)} hain.`)}</p>}
          <MethodPicker value={method} onChange={setMethod} direction="out" />
          {pay.isError && <ErrorBox error={pay.error} />}
          <Button type="submit" size="lg" block disabled={value <= 0 || overOwed || overCash || pay.isPending}>
            {pay.isPending ? pick('Saving', 'Save ho raha') : pick('Save payment', 'Payment save karein')}
          </Button>
        </form>
      )}
    </Sheet>
  );
}

export default PaySupplierSheet;
