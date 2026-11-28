import { AlertTriangle, CheckCircle2, OctagonX } from 'lucide-react';
import type { CreditCheck } from '@/api/types';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn, formatPKR } from '@/lib/format';

const LOOK = {
  yes: { cls: 'bg-sabz-tint border-sabz-mid text-sabz-dark', Icon: CheckCircle2, en: 'Yes, you can give udhaar', ur: 'Haan, udhaar de sakte hain' },
  careful: { cls: 'bg-haldi-tint border-haldi/50 text-haldi-dark', Icon: AlertTriangle, en: 'Careful', ur: 'Soch kar dein' },
  no: { cls: 'bg-lal-tint border-lal/40 text-lal-dark', Icon: OctagonX, en: 'Better not', ur: 'Udhaar na dein' },
} as const;

/** "Udhaar dun?" The answer and the reasons, before the khata is written. */
export function CreditVerdict({ check, stale }: { check: CreditCheck; stale?: boolean }) {
  const { pick } = useLanguage();
  const look = LOOK[check.decision];
  return (
    <div className={cn('rounded-2xl border-2 p-4 transition-opacity', look.cls, stale && 'opacity-60')} role="status" aria-live="polite">
      <p className="flex items-center gap-2 text-lg font-extrabold">
        <look.Icon className="w-6 h-6 shrink-0" />
        {pick('Udhaar dun?', 'Udhaar dun?')} {pick(look.en, look.ur)}
      </p>
      <ul className="mt-2 space-y-1 text-base text-ink">
        {check.reasons.map((r) => (
          <li key={r.en}>{pick(r.en, r.ur)}</li>
        ))}
      </ul>
      {check.decision !== 'yes' && (
        <p className="mt-2 text-sm font-bold text-ink-soft">
          {check.safe_amount_pkr > 0
            ? pick(`Up to ${formatPKR(check.safe_amount_pkr)} stays within the limit.`, `${formatPKR(check.safe_amount_pkr)} tak had ke andar hai.`)
            : pick('Ask for some of the old amount first.', 'Pehle purani raqam mein se kuch lein.')}
        </p>
      )}
    </div>
  );
}
