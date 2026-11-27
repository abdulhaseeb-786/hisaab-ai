import logoMark from '@/assets/logo-mark.svg';
import { cn } from '@/lib/format';

/** Wordmark: "HisaabAI" with the Urdu word حساب, so the name reads in both scripts. */
export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <img src={logoMark} alt="" className="w-9 h-9 shrink-0" />
      {!compact && (
        <div className="leading-none">
          <span className="block text-lg font-extrabold text-ink tracking-tight">
            Hisaab<span className="text-sabz">AI</span>
          </span>
          <span className="block font-urdu text-sm text-ink-muted mt-1.5 text-left" lang="ur">
            حساب
          </span>
        </div>
      )}
    </div>
  );
}

export default Logo;
