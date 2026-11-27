import type { UseQueryResult } from '@tanstack/react-query';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/lib/format';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-ink/[0.06]', className)} aria-hidden />;
}

export function ErrorBox({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const { pick } = useLanguage();
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div role="alert" className={cn('flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl bg-lal-tint text-lal-dark', className)}>
      <AlertTriangle className="w-6 h-6 shrink-0" />
      <div className="flex-1">
        <p className="font-bold">{pick('This could not load.', 'Yeh load nahi hua.')}</p>
        <p className="text-sm">{message}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-xl bg-card font-bold text-ink">
          <RotateCcw className="w-4 h-4" />
          {pick('Try again', 'Dobara koshish')}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-10 gap-2">
      <div className="w-14 h-14 rounded-full bg-sabz-tint text-sabz flex items-center justify-center">{icon}</div>
      <p className="text-lg font-bold">{title}</p>
      {children && <div className="text-ink-muted max-w-sm">{children}</div>}
    </div>
  );
}

/** Loading, error and data states in one place, so a screen never shows guessed numbers. */
export function QueryState<T>({ query, loading, children }: { query: UseQueryResult<T>; loading?: ReactNode; children: (data: T) => ReactNode }) {
  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.isError) return <ErrorBox error={query.error} onRetry={() => query.refetch()} />;
  return <>{loading ?? <Skeleton className="h-40" />}</>;
}
