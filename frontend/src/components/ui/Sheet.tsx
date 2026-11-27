import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/lib/format';

/**
 * One dialog pattern for the whole app: a bottom sheet on phones (thumb reach), a side
 * panel on larger screens. Escape and the backdrop close it, the page behind does not
 * scroll, and focus returns to where it was.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  width = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  width?: 'md' | 'lg';
}) {
  const { pick } = useLanguage();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    window.setTimeout(() => panelRef.current?.focus(), 30);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);

  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
  const motionProps = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : isDesktop
      ? { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } }
      : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end bg-ink/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            {...motionProps}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'bg-paper w-full flex flex-col outline-none shadow-lift',
              'max-h-[92vh] rounded-t-sheet md:max-h-none md:h-full md:rounded-none md:rounded-l-sheet',
              width === 'lg' ? 'md:w-[640px]' : 'md:w-[520px]',
            )}
          >
            <div className="md:hidden mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-line-strong" aria-hidden />
            <header className="flex items-start gap-3 px-5 pt-4 pb-3 md:pt-6 border-b border-line bg-paper">
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="text-xl font-extrabold text-ink leading-tight">
                  {title}
                </h2>
                {description && <div className="text-sm text-ink-muted mt-1">{description}</div>}
              </div>
              <button
                onClick={onClose}
                className="shrink-0 -mr-2 -mt-1 w-11 h-11 rounded-full flex items-center justify-center text-ink-muted hover:bg-ink/5"
                aria-label={pick('Close', 'Band karein')}
              >
                <X className="w-6 h-6" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
            {footer && <footer className="border-t border-line bg-card px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</footer>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
