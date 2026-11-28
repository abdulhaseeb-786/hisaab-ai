import { motion, useReducedMotion } from 'framer-motion';
import { useState, type FormEvent } from 'react';
import { useRecordPayment } from '@/api/queries';
import type { PaymentMethod, PaymentResult } from '@/api/types';
import { MessageDraft } from '@/components/MessageDraft';
import { Button } from '@/components/ui/Button';
import { AmountInput, MethodPicker, readAmount, Stamp } from '@/components/ui/Fields';
import { ErrorBox } from '@/components/ui/QueryState';
import { useLanguage } from '@/i18n/LanguageContext';
import { formatPKR } from '@/lib/format';

const METHOD_LABEL: Record<PaymentMethod, string> = { cash: 'Cash', easypaisa: 'Easypaisa', jazzcash: 'JazzCash', bank: 'Bank' };

export function WasooliDone({ r, onDone }: { r: PaymentResult; onDone?: () => void }) {
  const { pick } = useLanguage();
  const reduce = useReducedMotion();
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-2xl font-extrabold text-sabz-dark">{pick('Payment saved.', 'Wasooli save ho gayi.')}</p>
          <p className="text-base text-ink-soft mt-1">
            {pick(`${formatPKR(r.amount_received)} by ${METHOD_LABEL[r.method]}. ${r.name} now owes ${formatPKR(r.new_balance)}.`, `${formatPKR(r.amount_received)} ${METHOD_LABEL[r.method]} se. ${r.name} ka baqaya ab ${formatPKR(r.new_balance)}.`)}
          </p>
        </div>
        <motion.div initial={reduce ? false : { scale: 2.3, opacity: 0, rotate: -6 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 480, damping: 22 }}>
          <Stamp urdu="وصول" line={formatPKR(r.amount_received)} />
        </motion.div>
      </div>
      <MessageDraft draft={r.receipt} title={pick('Receipt for the customer', 'Customer ki raseed')} />
      {onDone && (
        <Button block onClick={onDone}>
          {pick('Done', 'Theek hai')}
        </Button>
      )}
    </div>
  );
}

/** Money received against the khata, and how it came in. */
export function WasooliForm({
  customerId,
  balance,
  overdue,
  onSaved,
}: {
  customerId: number;
  balance: number;
  overdue: number;
  onSaved: (r: PaymentResult) => void;
}) {
  const { pick } = useLanguage();
  const pay = useRecordPayment();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const value = readAmount(amount);
  const valid = value > 0 && value <= balance + 0.01;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    pay.mutate({ customerId, amount: value, method }, { onSuccess: onSaved });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <label htmlFor={`pay-${customerId}`} className="block text-lg font-bold">
        {pick('Money received', 'Raqam wasool hui')}
      </label>
      <AmountInput id={`pay-${customerId}`} value={amount} onChange={setAmount} invalid={!!amount && !valid} />
      <div className="flex flex-wrap gap-2">
        {overdue > 0 && overdue < balance && (
          <button type="button" onClick={() => setAmount(String(Math.round(overdue)))} className="min-h-[40px] px-3 rounded-full border-2 border-line text-sm font-bold hover:border-ink-muted">
            {pick('Late amount', 'Late raqam')} {formatPKR(overdue)}
          </button>
        )}
        <button type="button" onClick={() => setAmount(String(Math.round(balance)))} className="min-h-[40px] px-3 rounded-full border-2 border-line text-sm font-bold hover:border-ink-muted">
          {pick('Full balance', 'Poora baqaya')} {formatPKR(balance)}
        </button>
      </div>
      {amount && !valid && <p className="text-sm font-bold text-lal-dark">{pick(`Enter up to ${formatPKR(balance)}.`, `${formatPKR(balance)} tak likhein.`)}</p>}
      <MethodPicker value={method} onChange={setMethod} direction="in" />
      {pay.isError && <ErrorBox error={pay.error} />}
      <Button type="submit" size="lg" block disabled={!valid || pay.isPending}>
        {pay.isPending ? pick('Saving', 'Save ho raha') : pick('Save payment', 'Wasooli save karein')}
      </Button>
    </form>
  );
}
