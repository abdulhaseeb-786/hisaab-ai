import { useReducedMotion } from 'framer-motion';
import { ShoppingBasket } from 'lucide-react';
import basketMp4 from '@/assets/motion/shopping-cart-fill-white.mp4';
import basketWebm from '@/assets/motion/shopping-cart-fill-transparent.webm';
import { cn } from '@/lib/format';

interface BasketAnimationProps {
  active?: boolean;
  compact?: boolean;
  className?: string;
}

export function BasketAnimation({ active = true, compact = false, className }: BasketAnimationProps) {
  const reduceMotion = useReducedMotion();
  if (!active) return null;

  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-gold/35 bg-royal-tint',
        compact ? 'h-11 w-11' : 'h-16 w-16',
        className,
      )}
    >
      <ShoppingBasket className={cn('absolute text-royal/25', compact ? 'h-5 w-5' : 'h-7 w-7')} />
      {!reduceMotion && (
        <video autoPlay loop muted playsInline preload="metadata" disablePictureInPicture className="relative h-full w-full object-contain">
          <source src={basketWebm} type="video/webm" />
          <source src={basketMp4} type="video/mp4" />
        </video>
      )}
    </span>
  );
}

export default BasketAnimation;
