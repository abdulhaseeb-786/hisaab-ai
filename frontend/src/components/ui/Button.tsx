import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'haldi';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-sabz text-white hover:bg-sabz-dark active:bg-sabz-dark disabled:bg-ink-faint',
  secondary: 'bg-card text-ink border border-line-strong hover:border-ink-muted hover:bg-paper',
  ghost: 'text-ink-soft hover:bg-ink/5',
  danger: 'bg-lal text-white hover:bg-lal-dark',
  haldi: 'bg-haldi text-ink hover:brightness-95',
};

// Every size keeps at least a 44px touch target.
const SIZE: Record<Size, string> = {
  sm: 'min-h-[44px] px-3.5 text-sm gap-1.5 rounded-xl',
  md: 'min-h-[48px] px-5 text-base gap-2 rounded-xl',
  lg: 'min-h-[56px] px-6 text-lg gap-2.5 rounded-2xl',
};

const base =
  'inline-flex items-center justify-center font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 select-none';

interface Common {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & Common>(function Button(
  { variant = 'primary', size = 'md', icon, block, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cn(base, VARIANT[variant], SIZE[size], block && 'w-full', className)} {...rest}>
      {icon}
      {children}
    </button>
  );
});

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  icon,
  block,
  className,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & Common) {
  return (
    <a className={cn(base, VARIANT[variant], SIZE[size], block && 'w-full', className)} {...rest}>
      {icon}
      {children}
    </a>
  );
}
