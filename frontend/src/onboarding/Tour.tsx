import { motion } from 'framer-motion';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/i18n/LanguageContext';
import { useOnboarding } from './OnboardingContext';

interface Step {
  /** Candidate targets, first visible one wins (phone layout vs desktop sidebar). */
  targets: string[];
  en: [string, string];
  ur: [string, string];
}

const STEPS: Step[] = [
  {
    targets: ['first-job'],
    en: ["Today's jobs", 'The most important job is always at the top. Each one says why, with the numbers.'],
    ur: ['Aaj ke kaam', 'Sab se zaroori kaam hamesha sab se upar. Har kaam ke saath wajah aur numbers.'],
  },
  {
    targets: ['first-action'],
    en: ['One tap to act', 'Each job has one button that does the work: plan the order, fix the price or send a reminder.'],
    ur: ['Ek tap, kaam shuru', 'Har kaam ka ek button: order ka plan, qeemat theek karna ya yaad dihani bhejna.'],
  },
  {
    targets: ['numbers'],
    en: ['Your shop in 4 numbers', "Today's sale, cash in the drawer, late khata and items running low. Tap any of them for details."],
    ur: ['4 numbers mein dukaan', 'Aaj ki sale, galle ka cash, late udhaar aur kam maal. Tafseel ke liye kisi par bhi tap karein.'],
  },
  {
    targets: ['nav-buy', 'side-nav-buy'],
    en: ['Buying with a budget', 'Here you type your budget and get the order list for your distributors.'],
    ur: ['Budget se khareedari', 'Yahan budget likhein aur distributors ke liye order ki list lein.'],
  },
  {
    targets: ['nav-khata', 'side-nav-khata'],
    en: ['Khata', 'Who owes you, who is late, and a ready reminder message for each customer.'],
    ur: ['Khata', 'Kis ka udhaar hai, kaun late hai, aur har customer ke liye tayyar yaad dihani.'],
  },
  {
    targets: ['ask', 'ask-side'],
    en: ['Ask anything', 'Type a question in Roman Urdu or English. Answers come only from your records.'],
    ur: ['Kuch bhi poochein', 'Roman Urdu ya English mein sawal likhein. Jawab sirf aap ke records se.'],
  },
  {
    targets: ['help', 'help-side'],
    en: ['Help is always here', 'Tap this any time to see this tutorial again.'],
    ur: ['Madad hamesha yahan', 'Yeh tutorial dobara dekhna ho to kabhi bhi yeh dabayein.'],
  },
];

function findTarget(step: Step): HTMLElement | null {
  for (const name of step.targets) {
    const el = document.querySelector<HTMLElement>(`[data-tour="${name}"]`);
    if (el && el.getClientRects().length > 0 && el.offsetParent !== null) return el;
    if (el && getComputedStyle(el).position === 'fixed' && el.getClientRects().length > 0) return el;
  }
  return null;
}

/** Coach marks: dims the page and spotlights one real control at a time. */
export function Tour() {
  const { pick, language } = useLanguage();
  const { finish } = useOnboarding();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = STEPS[index];

  const measure = useCallback(() => {
    if (!step) return;
    const el = findTarget(step);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  // Wait for the target to exist (data may still be loading), then bring it into view.
  useLayoutEffect(() => {
    if (!step) return;
    let tries = 0;
    let timer = 0;
    const attempt = () => {
      const el = findTarget(step);
      if (el) {
        const tall = el.getBoundingClientRect().height > window.innerHeight * 0.55;
        el.scrollIntoView({ block: tall ? 'start' : 'center', behavior: 'smooth' });
        window.setTimeout(measure, 350);
      } else if (tries++ < 20) {
        timer = window.setTimeout(attempt, 150);
      } else {
        setIndex((i) => i + 1); // target never appeared: skip this step
      }
    };
    attempt();
    return () => window.clearTimeout(timer);
  }, [step, measure]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight') setIndex((i) => i + 1);
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [measure, finish]);

  useEffect(() => {
    if (index >= STEPS.length) finish();
  }, [index, finish]);

  if (!step) return null;
  const [title, body] = language === 'english' ? step.en : step.ur;
  const pad = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const TIP_SPACE = 240;
  const tipWidth = Math.min(380, vw - 32);
  // Place the tip where there is room: below the target, above it, or docked to the
  // bottom of the screen when the target fills the view.
  const visibleTop = rect ? Math.max(rect.top, 0) : 0;
  const visibleBottom = rect ? Math.min(rect.bottom, vh) : 0;
  const placement: 'below' | 'above' | 'dock' = !rect
    ? 'dock'
    : vh - visibleBottom >= TIP_SPACE
      ? 'below'
      : visibleTop >= TIP_SPACE
        ? 'above'
        : 'dock';
  const dockBottom = vw < 1024 ? 88 : 24;
  const tipLeft = rect && placement !== 'dock'
    ? Math.min(Math.max(16, rect.left + rect.width / 2 - tipWidth / 2), vw - tipWidth - 16)
    : (vw - tipWidth) / 2;
  const tipTop = placement === 'below' && rect ? visibleBottom + pad + 12 : undefined;
  const tipBottom = placement === 'above' ? vh - visibleTop + pad + 12 : placement === 'dock' ? dockBottom : undefined;
  const below = placement === 'below';

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={title}>
      {/* Dimmed page with a hole around the target. Clicks on the dim layer are swallowed. */}
      {rect ? (
        <motion.div
          className="absolute rounded-2xl ring-4 ring-haldi pointer-events-none"
          initial={false}
          animate={{
            left: rect.left - pad,
            top: Math.max(visibleTop, 8) - pad,
            width: rect.width + pad * 2,
            height: Math.max(24, Math.min(visibleBottom, vh - 8) - Math.max(visibleTop, 8)) + pad * 2,
          }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          style={{ boxShadow: '0 0 0 9999px rgba(23,32,27,0.62)' }}
        />
      ) : (
        <div className="absolute inset-0 bg-ink/60" />
      )}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      <motion.div
        key={index}
        initial={{ opacity: 0, y: below ? -6 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute bg-card rounded-2xl shadow-lift p-5"
        style={{ width: tipWidth, left: tipLeft, top: tipTop, bottom: tipBottom }}
      >
        <p className="text-sm font-bold text-sabz">
          {index + 1} / {STEPS.length}
        </p>
        <h2 className="text-xl font-extrabold text-ink mt-1">{title}</h2>
        <p className="text-base text-ink-soft mt-1.5">{body}</p>
        <div className="flex items-center gap-2 mt-4">
          <button onClick={finish} className="min-h-[44px] px-2 font-bold text-ink-muted hover:text-ink mr-auto">
            {pick('Skip tour', 'Tour chhorein')}
          </button>
          {index > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setIndex((i) => i - 1)}>
              {pick('Back', 'Wapas')}
            </Button>
          )}
          <Button size="sm" onClick={() => setIndex((i) => i + 1)}>
            {index === STEPS.length - 1 ? pick('Done', 'Ho gaya') : pick('Next', 'Agla')}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
