import type { ReactNode } from 'react';
import { cn } from '@/lib/format';

/** A titled block of a page. The title says what the block is; the action is optional. */
export function Section({
  title,
  action,
  hint,
  children,
  className,
  id,
}: {
  title: ReactNode;
  action?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={cn('space-y-3', className)} id={id} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <div>
          <h2 id={id ? `${id}-title` : undefined} className="text-xl font-extrabold text-ink">
            {title}
          </h2>
          {hint && <p className="text-sm text-ink-muted mt-0.5">{hint}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className, as: As = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'li' | 'article' }) {
  return <As className={cn('bg-card rounded-2xl border border-line shadow-card', className)}>{children}</As>;
}

export function PageTitle({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="text-base text-ink-muted mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
