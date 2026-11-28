import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import logoMark from '@/assets/logo-mark.svg';
import hoverLoop from '@/assets/motion/hisaab_ai_hover_loop.mp4';
import rockLoop from '@/assets/motion/hisaab_ai_rock_loop.mp4';
import { cn } from '@/lib/format';

function LogoMark({ animated }: { animated: boolean }) {
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);

  const moving = animated && !reduceMotion;

  return (
    <motion.span
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      animate={moving ? { rotate: [0, 2, 0, -2, 0], rotateY: [0, 24, 0, -24, 0] } : undefined}
      transition={moving ? { duration: 4.2, repeat: Infinity, ease: 'easeInOut' } : undefined}
      whileHover={moving ? { scale: 1.08 } : undefined}
      style={{ transformStyle: 'preserve-3d' }}
      className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-gold/40 bg-royal-950 shadow-gold"
    >
      {!moving ? (
        <img src={logoMark} alt="" className="h-full w-full object-contain p-0.5" />
      ) : (
        <video
          key={hovered ? 'hover' : 'rock'}
          src={hovered ? hoverLoop : rockLoop}
          poster={logoMark}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          disablePictureInPicture
          aria-hidden="true"
          className="h-full w-full object-contain"
        />
      )}
    </motion.span>
  );
}

/** Wordmark: "HisaabAI" with the Urdu word حساب, so the name reads in both scripts. */
export function Logo({ compact = false, inverse = false, animated = false, className }: { compact?: boolean; inverse?: boolean; animated?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark animated={animated} />
      {!compact && (
        <div className="leading-none">
          <span className={cn('block text-lg font-extrabold tracking-tight', inverse ? 'text-ivory' : 'text-ink')}>
            Hisaab<span className={inverse ? 'text-gold-light' : 'text-sabz'}>AI</span>
          </span>
          <span className={cn('mt-1.5 block text-left font-urdu text-sm', inverse ? 'text-ivory/70' : 'text-ink-muted')} lang="ur">
            حساب
          </span>
        </div>
      )}
    </div>
  );
}

export default Logo;
