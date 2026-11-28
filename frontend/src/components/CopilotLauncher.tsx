import { motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import avatar from '@/assets/copilot-avatar.jpg';
import { useUi } from '@/app/UiContext';
import { useLanguage } from '@/i18n/LanguageContext';

export function CopilotLauncher() {
  const ui = useUi();
  const { pick } = useLanguage();
  const reduceMotion = useReducedMotion();
  const { pathname } = useLocation();

  return (
    <motion.button
      type="button"
      data-tour={pathname.startsWith('/app') ? 'ask' : undefined}
      onClick={() => ui.openCopilot()}
      aria-label={pick('Ask HisaabAI', 'HisaabAI se poochein')}
      animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
      transition={reduceMotion ? undefined : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      whileHover={reduceMotion ? undefined : { scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.97 }}
      className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-2 rounded-full border border-gold/45 bg-royal-950 py-1.5 pl-1.5 pr-4 text-ivory shadow-royal lg:bottom-6 lg:right-6 lg:py-2 lg:pr-5"
    >
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-gold-light/70 bg-royal-900">
        <img src={avatar} alt="" className="h-full w-full object-cover" />
        {!reduceMotion && <span className="absolute inset-0 rounded-full border border-gold-light/50 animate-pulse-ring" />}
      </span>
      <span className="hidden text-sm font-bold sm:inline">{pick('Ask', 'Poochein')}</span>
    </motion.button>
  );
}

export default CopilotLauncher;
