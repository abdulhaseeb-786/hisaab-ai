import { motion, useReducedMotion } from 'framer-motion';
import { Compass } from 'lucide-react';
import { useEffect } from 'react';
import { useStore } from '@/api/queries';
import { Logo } from '@/components/Logo';
import { useLanguage, type Language } from '@/i18n/LanguageContext';
import { cn } from '@/lib/format';
import { useOnboarding } from './OnboardingContext';

/**
 * One tap and you are in the shop. The landing page already told the story, so there
 * are no slides here: pick a language and start. The short tour is optional, and the
 * help button brings it back any time.
 */
export function Welcome() {
  const { pick, language, setLanguage } = useLanguage();
  const { finish, startTour } = useOnboarding();
  const store = useStore();
  const reduce = useReducedMotion();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && finish();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  const enter = (lang: Language) => {
    setLanguage(lang);
    finish();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-paper overflow-y-auto" role="dialog" aria-modal="true" aria-label={pick('Welcome to HisaabAI', 'HisaabAI mein khush aamdeed')}>
      <div className="min-h-full max-w-lg mx-auto px-6 py-6 flex flex-col">
        <Logo />
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex-1 flex flex-col justify-center py-8 space-y-6"
        >
          <div>
            <p className="font-urdu text-3xl text-sabz leading-[2.2]" lang="ur" dir="rtl">
              خوش آمدید
            </p>
            <h1 className="text-3xl font-extrabold text-ink mt-2">Khush aamdeed. Welcome.</h1>
            <p className="text-lg text-ink-muted mt-2">{store.data ? store.data.name : 'HisaabAI'}</p>
          </div>
          <p className="text-lg font-bold text-ink">Apni zabaan chunein / Choose your language</p>
          <div className="grid gap-3">
            <button onClick={() => enter('roman_urdu')} className={cn('text-left p-5 rounded-2xl border-2 bg-card hover:border-sabz', language === 'roman_urdu' ? 'border-sabz' : 'border-line')}>
              <span className="block text-xl font-extrabold">Roman Urdu</span>
              <span className="block text-ink-muted">Dukaan kholein</span>
            </button>
            <button onClick={() => enter('english')} className={cn('text-left p-5 rounded-2xl border-2 bg-card hover:border-sabz', language === 'english' ? 'border-sabz' : 'border-line')}>
              <span className="block text-xl font-extrabold">English</span>
              <span className="block text-ink-muted">Open the shop</span>
            </button>
          </div>
          <button onClick={startTour} className="inline-flex items-center gap-2 min-h-[44px] self-start font-bold text-sabz-dark hover:underline">
            <Compass className="w-5 h-5" />
            {pick('First show me around (4 steps)', 'Pehle dukaan dikhayein (4 qadam)')}
          </button>
          <p className="text-sm text-ink-muted">{pick('Change the language any time from the top bar. The ? button shows the tour again.', 'Zabaan baad mein upar se badal sakte hain. ? ka button tour dobara dikhata hai.')}</p>
        </motion.div>
      </div>
    </div>
  );
}
