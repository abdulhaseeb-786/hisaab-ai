import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BookOpenText, MessageCircleQuestion, ShoppingCart, Sun } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useDashboard, useReorderPlan, useStore, useTodayActions } from '@/api/queries';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/Logo';
import { useLanguage, type Language } from '@/i18n/LanguageContext';
import { cn, formatPKR } from '@/lib/format';
import { useOnboarding } from './OnboardingContext';

/** A small preview built from the shop's real data, so the tutorial shows *this* shop. */
function Preview({ children }: { children: ReactNode }) {
  return <div className="parchi rounded-2xl border border-line shadow-slip pl-16 pr-5 py-5 min-h-[8.5rem] flex flex-col justify-center">{children}</div>;
}

function useSlides() {
  const { pick } = useLanguage();
  const actions = useTodayActions();
  const plan = useReorderPlan(50_000);
  const kpis = useDashboard('30d');
  const top = actions.data?.actions[0];

  return [
    {
      icon: Sun,
      title: pick('Every morning, 3 jobs', 'Har subah, 3 kaam'),
      body: pick(
        'HisaabAI reads your sales, stock and khata, and puts the 3 most important jobs for today at the top.',
        'HisaabAI aap ki sale, stock aur khata parh kar aaj ke 3 sab se zaroori kaam sab se upar rakhta hai.',
      ),
      preview: (
        <Preview>
          <p className="text-sm text-ink-muted">{pick('Today, job 1', 'Aaj ka pehla kaam')}</p>
          <p className="text-lg font-extrabold text-ink leading-snug">{top ? pick(top.title, top.title_ur) : '...'}</p>
        </Preview>
      ),
    },
    {
      icon: ShoppingCart,
      title: pick('Tell it your budget, get a list', 'Budget batayein, list lein'),
      body: pick(
        'Type how much you can spend. You get a list in whole cartons, most urgent first, never over budget. Send it to your distributor on WhatsApp.',
        'Likhein kitna kharch kar sakte hain. Poore carton ki list milti hai, zaroori maal pehle, budget se zyada kabhi nahi. WhatsApp par distributor ko bhej dein.',
      ),
      preview: (
        <Preview>
          <p className="text-sm text-ink-muted">{pick('Budget Rs 50,000', 'Budget Rs 50,000')}</p>
          <p className="text-lg font-extrabold text-ink">
            {plan.data
              ? pick(`${plan.data.total_skus_recommended} items for ${formatPKR(plan.data.total_allocated_spend_pkr)}`, `${plan.data.total_skus_recommended} items, ${formatPKR(plan.data.total_allocated_spend_pkr)} mein`)
              : '...'}
          </p>
        </Preview>
      ),
    },
    {
      icon: BookOpenText,
      title: pick('Khata and cash, clearly', 'Khata aur cash, saaf saaf'),
      body: pick(
        'See who is late with payment, send a polite reminder, and check that you will have enough cash for the week.',
        'Dekhein kis ka udhaar late hai, narmi se yaad dihani bhejein, aur dekhein hafte bhar ka cash kaafi hai ya nahi.',
      ),
      preview: (
        <Preview>
          <p className="text-sm text-ink-muted">{pick('Late khata', 'Late udhaar')}</p>
          <p className="text-lg font-extrabold text-lal-dark">
            {kpis.data ? `${formatPKR(kpis.data.overdue_receivables_pkr)} · ${kpis.data.overdue_customers_count} ${pick('customers', 'customers')}` : '...'}
          </p>
        </Preview>
      ),
    },
    {
      icon: MessageCircleQuestion,
      title: pick('Ask in your own words', 'Apni zabaan mein poochein'),
      body: pick(
        'Ask anything about your shop. Every answer comes from your own records. If the records do not have it, HisaabAI says so instead of guessing.',
        'Dukaan ke baare mein kuch bhi poochein. Har jawab aap ke apne records se aata hai. Agar records mein nahi, to HisaabAI saaf bata deta hai, andaza nahi lagata.',
      ),
      preview: (
        <Preview>
          <p className="self-end max-w-[85%] rounded-2xl rounded-br-md bg-sabz text-white px-4 py-2 font-bold">
            {pick('How much Dalda oil is left?', 'Dalda kitna bacha hai?')}
          </p>
        </Preview>
      ),
    },
  ];
}

export function Welcome() {
  const { pick, language, setLanguage } = useLanguage();
  const { finish, startTour } = useOnboarding();
  const store = useStore();
  const slides = useSlides();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0); // 0 = language, 1..4 = slides

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && finish();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  const choose = (lang: Language) => {
    setLanguage(lang);
    setStep(1);
  };

  const slide = step > 0 ? slides[step - 1] : undefined;
  const last = step === slides.length;

  return (
    <div className="fixed inset-0 z-[60] bg-paper overflow-y-auto" role="dialog" aria-modal="true" aria-label={pick('Welcome to HisaabAI', 'HisaabAI mein khush aamdeed')}>
      <div className="min-h-full max-w-lg mx-auto px-6 py-6 flex flex-col">
        <div className="flex items-center justify-between">
          <Logo />
          {step > 0 && (
            <button onClick={finish} className="min-h-[44px] px-3 font-bold text-ink-muted hover:text-ink">
              {pick('Skip', 'Chhorein')}
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
            className="flex-1 flex flex-col justify-center py-8"
          >
            {step === 0 ? (
              <div className="space-y-6">
                <div>
                  <p className="font-urdu text-3xl text-sabz leading-[2.2]" lang="ur" dir="rtl">
                    خوش آمدید
                  </p>
                  <h1 className="text-3xl font-extrabold text-ink mt-2">Khush aamdeed. Welcome.</h1>
                  <p className="text-lg text-ink-muted mt-2">
                    {store.data ? `${store.data.name}` : 'HisaabAI'}
                  </p>
                </div>
                <p className="text-lg font-bold text-ink">Apni zabaan chunein / Choose your language</p>
                <div className="grid gap-3">
                  <button onClick={() => choose('roman_urdu')} className={cn('text-left p-5 rounded-2xl border-2 bg-card hover:border-sabz', language === 'roman_urdu' ? 'border-sabz' : 'border-line')}>
                    <span className="block text-xl font-extrabold">Roman Urdu</span>
                    <span className="block text-ink-muted">Aaj kya khareedun? Kis se wasooli karun?</span>
                  </button>
                  <button onClick={() => choose('english')} className={cn('text-left p-5 rounded-2xl border-2 bg-card hover:border-sabz', language === 'english' ? 'border-sabz' : 'border-line')}>
                    <span className="block text-xl font-extrabold">English</span>
                    <span className="block text-ink-muted">What should I buy today? Who should I collect from?</span>
                  </button>
                </div>
                <p className="text-sm text-ink-muted">{pick('You can change this any time from the top bar.', 'Yeh baad mein bhi upar se badal sakte hain.')}</p>
              </div>
            ) : (
              slide && (
                <div className="space-y-6">
                  <div className="w-14 h-14 rounded-2xl bg-sabz-tint text-sabz flex items-center justify-center">
                    <slide.icon className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-extrabold text-ink leading-tight">{slide.title}</h2>
                    <p className="text-lg text-ink-soft mt-3">{slide.body}</p>
                  </div>
                  {slide.preview}
                </div>
              )
            )}
          </motion.div>
        </AnimatePresence>

        {step > 0 && (
          <div className="space-y-4 pb-[env(safe-area-inset-bottom)]">
            <div className="flex justify-center gap-2" aria-label={pick(`Step ${step} of ${slides.length}`, `${slides.length} mein se ${step}`)}>
              {slides.map((_, i) => (
                <span key={i} className={cn('h-2 rounded-full transition-all', i + 1 === step ? 'w-6 bg-sabz' : 'w-2 bg-line-strong')} />
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" size="lg" onClick={() => setStep((s) => s - 1)} className="flex-1">
                {pick('Back', 'Wapas')}
              </Button>
              <Button size="lg" onClick={() => (last ? startTour() : setStep((s) => s + 1))} className="flex-[2]">
                {last ? pick('Show me around', 'Dukaan dikhayein') : pick('Next', 'Agla')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
