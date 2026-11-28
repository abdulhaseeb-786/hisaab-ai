import { Banknote, Building2, Minus, Plus, Smartphone } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PaymentMethod } from '@/api/types';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn, formatNumber } from '@/lib/format';

/** Digits only, as a number. "12,500" and "Rs 12500" both read as 12500. */
export function readAmount(text: string): number {
  const n = Number(text.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** A big rupee input: the amount is the most important thing on these screens. */
export function AmountInput({
  id,
  value,
  onChange,
  invalid,
  autoFocus,
  size = 'lg',
  label,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  autoFocus?: boolean;
  size?: 'md' | 'lg';
  label?: string;
}) {
  const amount = readAmount(value);
  return (
    <div className={cn('flex items-center rounded-2xl border-2 bg-card px-4 focus-within:border-sabz', invalid ? 'border-lal' : 'border-line-strong')}>
      <span className={cn('font-extrabold text-ink-muted', size === 'lg' ? 'text-2xl' : 'text-lg')}>Rs</span>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        aria-label={label}
        aria-invalid={invalid || undefined}
        value={value ? formatNumber(amount) : ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className={cn('w-full bg-transparent outline-none px-3 font-extrabold tabular', size === 'lg' ? 'py-3 text-3xl' : 'py-2 text-xl')}
      />
    </div>
  );
}

const METHODS: { value: PaymentMethod; en: string; ur: string; icon: ReactNode }[] = [
  { value: 'cash', en: 'Cash', ur: 'Cash', icon: <Banknote className="w-5 h-5" /> },
  { value: 'easypaisa', en: 'Easypaisa', ur: 'Easypaisa', icon: <Smartphone className="w-5 h-5" /> },
  { value: 'jazzcash', en: 'JazzCash', ur: 'JazzCash', icon: <Smartphone className="w-5 h-5" /> },
  { value: 'bank', en: 'Bank', ur: 'Bank', icon: <Building2 className="w-5 h-5" /> },
];

/** How the money moved. Only cash goes in (or out of) the galla, and the hint says so. */
export function MethodPicker({ value, onChange, direction }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void; direction: 'in' | 'out' }) {
  const { pick } = useLanguage();
  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label={pick('How was it paid?', 'Kaise ada hua?')} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {METHODS.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={value === m.value}
            onClick={() => onChange(m.value)}
            className={cn(
              'min-h-[48px] px-3 rounded-xl border-2 font-bold inline-flex items-center justify-center gap-2',
              value === m.value ? 'bg-sabz-tint border-sabz text-sabz-dark' : 'bg-card border-line text-ink-soft hover:border-ink-muted',
            )}
          >
            {m.icon}
            {pick(m.en, m.ur)}
          </button>
        ))}
      </div>
      <p className="text-sm text-ink-muted">
        {value === 'cash'
          ? direction === 'in'
            ? pick('Goes into the galla.', 'Galle mein jaye ga.')
            : pick('Comes out of the galla.', 'Galle se nikle ga.')
          : direction === 'in'
            ? pick('Goes to your account, not the galla.', 'Account mein jaye ga, galle mein nahi.')
            : pick('Paid from your account, not the galla.', 'Account se jaye ga, galle se nahi.')}
      </p>
    </div>
  );
}

/** − 3 + for quantities, with a typed value allowed. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  label,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  className?: string;
}) {
  const clamp = (v: number) => Math.max(min, max === undefined ? v : Math.min(max, v));
  return (
    <div className={cn('inline-flex items-center rounded-xl border-2 border-line bg-card', className)} role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(clamp(value - step))} disabled={value <= min} className="w-11 h-11 flex items-center justify-center text-ink-soft disabled:opacity-40" aria-label={`${label} −`}>
        <Minus className="w-5 h-5" />
      </button>
      <input
        inputMode="decimal"
        value={Number.isFinite(value) ? String(value) : ''}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/[^\d.]/g, ''));
          if (Number.isFinite(n)) onChange(clamp(n));
        }}
        aria-label={label}
        className="w-11 text-center bg-transparent outline-none font-extrabold text-lg tabular"
      />
      <button type="button" onClick={() => onChange(clamp(value + step))} disabled={max !== undefined && value >= max} className="w-11 h-11 flex items-center justify-center text-ink-soft disabled:opacity-40" aria-label={`${label} +`}>
        <Plus className="w-5 h-5" />
      </button>
    </div>
  );
}

/** The red "وصول" style stamp, for any saved money event. */
export function Stamp({ urdu, line, tone = 'lal' }: { urdu: string; line: string; tone?: 'lal' | 'sabz' }) {
  return (
    <div
      aria-hidden
      className={cn(
        'inline-block rounded-xl border-[3px] px-4 py-1 text-center bg-[#FFFDF6]/80 -rotate-[11deg]',
        tone === 'lal' ? 'border-lal text-lal' : 'border-sabz text-sabz',
      )}
    >
      <span className="block font-urdu text-3xl leading-[1.9]" lang="ur">
        {urdu}
      </span>
      <span className="block text-sm font-extrabold tabular -mt-1">{line}</span>
    </div>
  );
}
