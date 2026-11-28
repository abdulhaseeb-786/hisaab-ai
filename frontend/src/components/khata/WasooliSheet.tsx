import { useEffect, useState } from 'react';
import { useCustomers } from '@/api/queries';
import type { CustomerItem, PaymentResult } from '@/api/types';
import { useUi } from '@/app/UiContext';
import { Sheet } from '@/components/ui/Sheet';
import { useLanguage } from '@/i18n/LanguageContext';
import { formatPKR } from '@/lib/format';
import { CustomerPicker, initials } from './CustomerPicker';
import { WasooliDone, WasooliForm } from './WasooliForm';

export function WasooliSheet() {
  const { pick } = useLanguage();
  const ui = useUi();
  const customers = useCustomers('');
  const [customer, setCustomer] = useState<CustomerItem | null>(null);
  const [done, setDone] = useState<PaymentResult | null>(null);
  const open = ui.wasooli.open;

  useEffect(() => {
    if (!open) {
      setCustomer(null);
      setDone(null);
      return;
    }
    if (ui.wasooli.customerId && customers.data && !customer) {
      setCustomer(customers.data.find((c) => c.customer_id === ui.wasooli.customerId) ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ui.wasooli.customerId, customers.data]);

  return (
    <Sheet open={open} onClose={ui.closeWasooli} title={pick('Wasooli: money received', 'Wasooli: raqam aayi')} description={customer ? undefined : pick('Who is paying?', 'Kaun de raha hai?')}>
      {done ? (
        <WasooliDone r={done} onDone={ui.closeWasooli} />
      ) : !customer ? (
        <CustomerPicker onPick={setCustomer} onlyWithBalance allowNew={false} />
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-line">
            <span className="w-11 h-11 rounded-full bg-sabz-tint text-sabz-dark flex items-center justify-center font-extrabold shrink-0" aria-hidden>
              {initials(customer.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold leading-snug">{customer.name}</p>
              <p className="text-sm text-ink-muted">{pick(`Owes ${formatPKR(customer.balance_pkr)}`, `Baqaya ${formatPKR(customer.balance_pkr)}`)}</p>
            </div>
            <button onClick={() => setCustomer(null)} className="min-h-[44px] px-3 rounded-xl text-sm font-bold text-ink-muted hover:bg-ink/5">
              {pick('Change', 'Badlein')}
            </button>
          </div>
          <WasooliForm customerId={customer.customer_id} balance={customer.balance_pkr} overdue={customer.overdue_pkr} onSaved={setDone} />
        </div>
      )}
    </Sheet>
  );
}

export default WasooliSheet;
