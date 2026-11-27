import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/format';

export interface RegisterLine {
  label: string;
  value: string;
  note?: string;
  tone?: 'ink' | 'red';
  to?: string;
}

const SESSION_KEY = 'hisaab_register_opened';

/**
 * The shop's bahi khata. While data loads the red cloth register stays shut (that *is*
 * the loading state); when the numbers arrive the cover swings open and each figure is
 * written in, line by line. Plays once per session; still for reduced-motion users.
 */
export function RegisterBook({
  ready,
  storeName,
  heading,
  lines,
  footnote,
  size = 'app',
  replay = false,
}: {
  ready: boolean;
  storeName: string;
  heading: ReactNode;
  lines: RegisterLine[];
  footnote?: ReactNode;
  size?: 'app' | 'hero';
  replay?: boolean;
}) {
  const reduce = useReducedMotion();
  const [alreadyOpened] = useState(() => {
    if (replay) return false;
    try {
      return sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      return false;
    }
  });
  const animate = ready && !reduce && !alreadyOpened;
  const open = ready;

  useEffect(() => {
    if (ready && !replay) {
      try {
        sessionStorage.setItem(SESSION_KEY, '1');
      } catch {
        // ignore
      }
    }
  }, [ready, replay]);

  const coverDuration = 0.9;
  const lineDelay = (i: number) => (animate ? coverDuration + 0.15 + i * 0.22 : 0);

  return (
    <div className={cn('relative', size === 'hero' ? 'p-2.5 sm:p-3.5' : 'p-2 sm:p-2.5')} style={{ perspective: 1800 }}>
      {/* Book boards: the red cloth showing around the pages. */}
      <div className="absolute inset-0 rounded-[1.4rem] bg-[#8E2A21] khata-cloth shadow-lift" aria-hidden />

      <div
        className={cn(
          'relative rounded-2xl overflow-hidden bg-[#FFFDF6] grid',
          size === 'hero' ? 'sm:grid-cols-[0.72fr_1.28fr] min-h-[22rem]' : 'md:grid-cols-[0.8fr_1.2fr] min-h-[14rem]',
        )}
      >
        {/* Left page: the day. */}
        <div className="relative px-5 sm:px-6 pt-4 pb-2 md:py-7 md:border-r md:border-[#E7DFC9]">
          <div className="relative">{heading}</div>
        </div>

        {/* Right page: today's figures, written in. */}
        <div className="relative register-margin pl-12 sm:pl-14 pr-3 sm:pr-5 pt-1 pb-3 md:py-5">
          <ul className="relative">
            {lines.map((l, i) => {
              const content = (
                <span className="flex-1 min-w-0">
                  <span className="flex items-end">
                    <span className="text-base text-ink-soft shrink-0">{l.label}</span>
                    <span className="flex-1 border-b-2 border-dotted border-[#CFC6AE] mx-2 mb-2 min-w-[0.75rem]" aria-hidden />
                    <motion.span
                      className={cn('shrink-0 text-xl font-extrabold tabular whitespace-nowrap', size === 'app' && 'lg:text-2xl', l.tone === 'red' ? 'text-lal' : 'text-[#1F3A7A]')}
                      initial={animate ? { clipPath: 'inset(0 100% 0 0)' } : false}
                      animate={open ? { clipPath: 'inset(0 0% 0 0)' } : undefined}
                      transition={{ delay: lineDelay(i), duration: 0.45, ease: 'easeOut' }}
                    >
                      {open ? l.value : ' '}
                    </motion.span>
                  </span>
                  {l.note && (
                    <motion.span
                      className="block text-right text-xs text-ink-muted mt-0.5"
                      initial={animate ? { opacity: 0 } : false}
                      animate={{ opacity: 1 }}
                      transition={{ delay: lineDelay(i) + 0.3 }}
                    >
                      {open ? l.note : ' '}
                    </motion.span>
                  )}
                </span>
              );
              return (
                <li key={i} className="border-b border-[rgba(42,91,168,0.2)] last:border-b-0">
                  {l.to ? (
                    <Link to={l.to} className="group flex items-center min-h-[3.25rem] py-1.5 rounded-lg hover:bg-[#F6EFD9]/70 -mx-2 px-2">
                      {content}
                      <ChevronRight className="w-4 h-4 text-ink-faint ml-1 shrink-0 group-hover:text-ink" />
                    </Link>
                  ) : (
                    <div className="flex items-center min-h-[3.25rem] py-1.5">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
          {footnote && <div className="relative mt-2 text-sm text-ink-muted">{footnote}</div>}
        </div>

        {/* The cover: shut while loading, swings open when the numbers are ready. */}
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-2xl bg-[#8E2A21] khata-cloth flex flex-col items-center justify-center text-center origin-left z-10"
          style={{ backfaceVisibility: 'hidden', transformStyle: 'preserve-3d' }}
          initial={false}
          animate={open ? { rotateY: -100, opacity: 0 } : { rotateY: 0, opacity: 1 }}
          transition={animate ? { duration: coverDuration, ease: [0.6, 0.02, 0.3, 1], opacity: { delay: coverDuration * 0.7, duration: 0.25 } } : { duration: 0 }}
        >
          <span className="absolute left-0 top-0 h-full w-5 bg-black/15" />
          <span className="absolute right-0 top-0 w-10 h-10 bg-black/20 [clip-path:polygon(100%_0,0_0,100%_100%)]" />
          <span className="absolute right-0 bottom-0 w-10 h-10 bg-black/20 [clip-path:polygon(100%_100%,0_100%,100%_0)]" />
          <span className="font-urdu text-5xl sm:text-6xl text-[#E9C46A] leading-[1.9] drop-shadow" lang="ur">
            حساب
          </span>
          <span className="mt-5 text-sm font-bold tracking-wide text-[#F3DFA2]/90">{storeName}</span>
        </motion.div>
      </div>
    </div>
  );
}
