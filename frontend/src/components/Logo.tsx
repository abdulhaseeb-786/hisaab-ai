import logoMark from '@/assets/logo-mark.svg';
import { cn } from '@/lib/format';

/** Wordmark: "HisaabAI" paired with the mark. */
export function Logo({ compact = false, onBoard = false, className }: { compact?: boolean; onBoard?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <img src={logoMark} alt="" className="w-9 h-9 shrink-0 rounded-xl" />
      {!compact && (
        <span className={cn('text-xl font-extrabold tracking-tight leading-none', onBoard ? 'text-white' : 'text-ink')}>
          Hisaab<span className={onBoard ? 'text-haldi-300' : 'text-sabz'}>AI</span>
        </span>
      )}
    </div>
  );
}

export default Logo;
