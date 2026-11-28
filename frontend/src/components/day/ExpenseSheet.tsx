import { Bike, Building, CheckCircle2, Home, Landmark, Lightbulb, Receipt, UserRound } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useAddExpense, useDayToday } from '@/api/queries';
import type { ExpenseCategory } from '@/api/types';
import { useUi } from '@/app/UiContext';
import { Button } from '@/components/ui/Button';
import { AmountInput, readAmount } from '@/components/ui/Fields';
import { ErrorBox } from '@/components/ui/QueryState';
import { Sheet } from '@/components/ui/Sheet';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn, formatPKR } from '@/lib/format';

export const KINDS: { value: ExpenseCategory; en: string; ur: string; icon: ReactNode; cost: boolean }[] = [
  { value: 'electricity', en: 'Electricity', ur: 'Bijli', icon: <Lightbulb className="w-6 h-6" />, cost: true },
  { value: 'rent', en: 'Rent', ur: 'Kiraya', icon: <Building className="w-6 h-6" />, cost: true },
  { value: 'salaries', en: 'Salary', ur: 'Tankhwah', icon: <UserRound className="w-6 h-6" />, cost: true },
  { value: 'transport', en: 'Transport', ur: 'Kiraya / rickshaw', icon: <Bike className="w-6 h-6" />, cost: true },
  { value: 'general', en: 'Other', ur: 'Doosra kharcha', icon: <Receipt className="w-6 h-6" />, cost: true },
  { value: 'owner_drawings', en: 'Took home', ur: 'Ghar le gaye', icon: <Home className="w-6 h-6" />, cost: false },
  { value: 'bank_deposit', en: 'Banked', ur: 'Bank mein jama', icon: <Landmark className="w-6 h-6" />, cost: false },
];

export function ExpenseSheet() {
  const { pick } = useLanguage();
  const ui = useUi();
  const day = useDayToday();
  const add = useAddExpense();
  const [kind, setKind] = useState<ExpenseCategory>('general');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const value = readAmount(amount);
  const cash = day.data?.cash_in_drawer_expected_pkr ?? 0;
  const tooMuch = value > cash + 0.01;
  const meta = KINDS.find((k) => k.value === kind)!;

  useEffect(() => {
    if (!ui.expenseOpen) {
      setAmount('');
      setNote('');
      setKind('general');
      add.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.expenseOpen]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value <= 0 || tooMuch) return;
    add.mutate({ category: kind, amount: value, note });
  };

  return (
    <Sheet open={ui.expenseOpen} onClose={ui.closeExpense} title={pick('Kharcha from the cash box', 'Cash box se kharcha')} description={pick(`In the cash box now: ${formatPKR(cash)}`, `Cash box mein abhi: ${formatPKR(cash)}`)}>
      {add.isSuccess ? (
        <div className="space-y-5">
          <p className="flex items-center gap-2 text-2xl font-extrabold text-sabz-dark">
            <CheckCircle2 className="w-7 h-7" /> {pick('Written in the book.', 'Kitaab mein likh diya.')}
          </p>
          <p className="text-lg">
            {pick(`${meta.en}: ${formatPKR(add.data.amount_pkr)}. Cash Box now ${formatPKR(add.data.cash_in_drawer_pkr)}.`, `${meta.ur}: ${formatPKR(add.data.amount_pkr)}. Cash box mein ab ${formatPKR(add.data.cash_in_drawer_pkr)}.`)}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { add.reset(); setAmount(''); setNote(''); }}>
              {pick('Add another', 'Aur likhein')}
            </Button>
            <Button className="flex-1" onClick={ui.closeExpense}>
              {pick('Done', 'Theek hai')}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div role="radiogroup" aria-label={pick('What was it for?', 'Kis cheez ka?')} className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {KINDS.map((k) => (
              <button
                type="button"
                key={k.value}
                role="radio"
                aria-checked={kind === k.value}
                onClick={() => setKind(k.value)}
                className={cn(
                  'min-h-[64px] px-3 rounded-2xl border-2 font-bold flex items-center gap-2 text-left',
                  kind === k.value ? 'bg-sabz-tint border-sabz text-sabz-dark' : 'bg-card border-line text-ink-soft hover:border-ink-muted',
                )}
              >
                {k.icon}
                <span className="leading-tight">{pick(k.en, k.ur)}</span>
              </button>
            ))}
          </div>
          {!meta.cost && (
            <p className="text-sm text-ink-muted">
              {pick('This leaves the cash box but is not a cost of the shop, so profit does not go down.', 'Yeh cash box se nikalta hai magar dukaan ka kharcha nahi, is liye munafa kam nahi hota.')}
            </p>
          )}
          <div className="space-y-2">
            <label htmlFor="exp-amount" className="block text-lg font-bold">
              {pick('How much?', 'Kitne?')}
            </label>
            <AmountInput id="exp-amount" value={amount} onChange={setAmount} invalid={tooMuch} autoFocus />
            {tooMuch && <p className="text-sm font-bold text-lal-dark">{pick(`Only ${formatPKR(cash)} is in the cash box.`, `Cash box mein sirf ${formatPKR(cash)} hain.`)}</p>}
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder={pick('Note (optional), e.g. K-Electric bill', 'Note (marzi se), maslan K-Electric bill')} aria-label={pick('Note', 'Note')} className="w-full min-h-[48px] px-4 rounded-xl border-2 border-line bg-card outline-none focus:border-sabz" />
          {add.isError && <ErrorBox error={add.error} />}
          <Button type="submit" size="lg" block disabled={value <= 0 || tooMuch || add.isPending}>
            {add.isPending ? pick('Saving', 'Save ho raha') : pick('Save kharcha', 'Kharcha save karein')}
          </Button>
        </form>
      )}
    </Sheet>
  );
}

export default ExpenseSheet;
