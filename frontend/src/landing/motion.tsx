import { animate, motion, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/format';

/** Content that rises into place the first time it scrolls into view. */
export function Reveal({ children, delay = 0, className, y = 28 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/**
 * An arrow that draws itself when it scrolls into view: it links a problem to its fix,
 * so the eye follows the cause to the effect.
 */
export function DrawArrow({
  direction = 'down',
  delay = 0,
  className,
  color = '#0E6B3F',
}: {
  direction?: 'down' | 'right';
  delay?: number;
  className?: string;
  color?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -15% 0px' });
  const shown = reduce || inView;
  const d = direction === 'down' ? 'M20 2 C 26 18, 14 30, 20 48' : 'M2 20 C 18 12, 32 28, 52 20';
  const head = direction === 'down' ? 'M11 39 L20 50 L29 39' : 'M42 11 L54 20 L42 29';
  const box = direction === 'down' ? '0 0 40 54' : '0 0 58 40';
  return (
    <svg ref={ref} viewBox={box} className={cn(direction === 'down' ? 'w-8 h-12' : 'w-14 h-10', className)} fill="none" aria-hidden>
      <motion.path
        d={d}
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1 1"
        initial={false}
        animate={{ strokeDashoffset: shown ? 0 : 1 }}
        transition={{ duration: reduce ? 0 : 0.7, delay: reduce ? 0 : delay, ease: 'easeInOut' }}
      />
      <motion.path
        d={head}
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={{ opacity: shown ? 1 : 0 }}
        transition={{ duration: 0.2, delay: reduce ? 0 : delay + 0.6 }}
      />
    </svg>
  );
}

/** A number that counts up once it is on screen. */
export function CountUp({ value, format, className }: { value: number; format: (v: number) => string; className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setShown(value);
      return;
    }
    const c = animate(0, value, { duration: 1.1, ease: 'easeOut', onUpdate: setShown });
    return () => c.stop();
  }, [inView, value, reduce]);
  return (
    <span ref={ref} className={className}>
      {format(shown)}
    </span>
  );
}
