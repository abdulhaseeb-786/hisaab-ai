import { motion, useReducedMotion } from 'framer-motion';
import { Mic, Square } from 'lucide-react';
import { useRef } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/lib/format';
import type { RecorderState } from './recorder';

const HOLD_MS = 350;

/**
 * Press and hold to talk, like a WhatsApp voice note: let go and HisaabAI listens.
 * A short tap works too: tap to start, tap again to finish (easier for some hands, and
 * the only way with a keyboard).
 */
export function MicButton({
  state,
  level,
  elapsed,
  maxSeconds,
  onStart,
  onStop,
}: {
  state: RecorderState;
  level: number;
  elapsed: number;
  maxSeconds: number;
  onStart: () => void;
  onStop: () => void;
}) {
  const { pick } = useLanguage();
  const reduce = useReducedMotion();
  const downAt = useRef(0);
  const holding = useRef(false);
  const recording = state === 'recording' || state === 'starting';

  const down = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    if (recording) {
      holding.current = false;
      onStop();
      return;
    }
    downAt.current = performance.now();
    holding.current = true;
    onStart();
  };

  const up = () => {
    if (!holding.current) return;
    holding.current = false;
    // A long press ends when the finger lifts; a short tap keeps listening until the next tap.
    if (performance.now() - downAt.current >= HOLD_MS) onStop();
  };

  const left = Math.max(0, Math.ceil(maxSeconds - elapsed));
  const ring = 1 + (reduce ? 0 : level * 0.55);

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <div className="relative w-40 h-40 flex items-center justify-center">
        {recording && (
          <>
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full bg-sabz/15"
              animate={{ scale: ring }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            />
            <motion.span
              aria-hidden
              className="absolute inset-3 rounded-full bg-sabz/20"
              animate={{ scale: 1 + (reduce ? 0 : level * 0.3) }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            />
          </>
        )}
        <button
          type="button"
          onPointerDown={down}
          onPointerUp={up}
          onPointerCancel={up}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              if (recording) onStop();
              else onStart();
            }
          }}
          onContextMenu={(e) => e.preventDefault()}
          disabled={state === 'finishing'}
          aria-pressed={recording}
          aria-label={recording ? pick('Stop and understand', 'Bas, samjho') : pick('Hold to speak', 'Daba kar bolein')}
          className={cn(
            'relative z-10 w-28 h-28 rounded-full flex items-center justify-center text-white shadow-lift touch-none transition-colors',
            recording ? 'bg-lal hover:bg-lal-dark' : 'bg-sabz hover:bg-sabz-dark',
            state === 'finishing' && 'opacity-60',
          )}
        >
          {recording ? <Square className="w-10 h-10" fill="currentColor" /> : <Mic className="w-12 h-12" />}
        </button>
      </div>
      <p className="text-center text-lg font-bold min-h-[3.5rem]" aria-live="polite">
        {state === 'starting'
          ? pick('Starting the mic...', 'Mic khul raha hai...')
          : state === 'recording'
            ? pick(`Listening... let go or tap when done (${left}s)`, `Sun raha hoon... bol kar chhor dein ya dabayein (${left}s)`)
            : state === 'finishing'
              ? pick('Got it', 'Sun liya')
              : pick('Hold the button and speak', 'Button daba kar rakhein aur bolein')}
      </p>
    </div>
  );
}
