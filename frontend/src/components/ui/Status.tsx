import { AlertTriangle, CheckCircle2, CircleHelp, Clock, PackageX } from 'lucide-react';
import type { ReactNode } from 'react';
import type { RiskLevel } from '@/api/types';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/lib/format';

export type Tone = 'urgent' | 'watch' | 'ok' | 'neutral' | 'info';

export const TONE_CLASS: Record<Tone, string> = {
  urgent: 'bg-lal-tint text-lal-dark',
  watch: 'bg-haldi-tint text-haldi-dark',
  ok: 'bg-sabz-tint text-sabz-dark',
  neutral: 'bg-ink/5 text-ink-soft',
  info: 'bg-neela-tint text-neela',
};

/** A status is never color alone: it always has an icon and words. */
export function Pill({ tone, children, className, icon }: { tone: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-bold whitespace-nowrap', TONE_CLASS[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

const RISK: Record<RiskLevel, { tone: Tone; en: string; ur: string; Icon: typeof AlertTriangle }> = {
  critical: { tone: 'urgent', en: 'Will run out', ur: 'Khatam hone wala', Icon: AlertTriangle },
  high: { tone: 'watch', en: 'Running low', ur: 'Kam hai', Icon: Clock },
  medium: { tone: 'watch', en: 'Order soon', ur: 'Jald mangwayein', Icon: Clock },
  ok: { tone: 'ok', en: 'Enough', ur: 'Kaafi hai', Icon: CheckCircle2 },
  unknown: { tone: 'neutral', en: 'Too little sale data', ur: 'Sale ka data kam', Icon: CircleHelp },
};

export function StockStatus({ risk, dead, className }: { risk: RiskLevel; dead?: boolean; className?: string }) {
  const { pick } = useLanguage();
  if (dead) {
    return (
      <Pill tone="neutral" className={className} icon={<PackageX className="w-4 h-4" />}>
        {pick('Not selling', 'Nahi bik raha')}
      </Pill>
    );
  }
  const r = RISK[risk];
  return (
    <Pill tone={r.tone} className={className} icon={<r.Icon className="w-4 h-4" />}>
      {pick(r.en, r.ur)}
    </Pill>
  );
}
