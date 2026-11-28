import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { CheckCheck } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { api, unwrap } from '@/api/client';
import { useCreditSummary, useDashboard, useReorderPlan, useTodayActions } from '@/api/queries';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn, formatPKR } from '@/lib/format';

const STEPS: { time: [string, string]; title: [string, string]; body: [string, string] }[] = [
  {
    time: ['8:00 am', 'Subah 8 baje'],
    title: ['The cash box is counted, the day opens', 'Cash box gina, din shuru'],
    body: [
      'Before the first customer, the owner counts the drawer. HisaabAI checks it against the records and shows who is late, what is running low, and the three things to do first.',
      'Pehle customer se pehle maalik cash box ginta hai. HisaabAI records se milata hai aur batata hai kaun late hai, kya kam hai, aur sab se pehle kya karna hai.',
    ],
  },
  {
    time: ['11:00 am', 'Din 11 baje'],
    title: ['The order booker comes', 'Order booker aata hai'],
    body: [
      'HisaabAI knows how much the cash box can safely spend before this bill is due, and fills it with whole cartons, most urgent first. The order is on screen to read out.',
      'HisaabAI jaanta hai is bill se pehle cash box kitna kharch bardasht kar sakta hai, aur poore carton se list banata hai, zaroori maal pehle. Order screen par, parh kar suna dein.',
    ],
  },
  {
    time: ['6:00 pm', 'Shaam 6 baje'],
    title: ['Khata gets collected, politely', 'Khata ki wasooli, narmi se'],
    body: [
      'Every udhaar is written with the items and the due date. The most late customer gets a polite reminder on screen; when he pays, the khata is stamped and every screen updates.',
      'Har udhaar items aur wapsi ki tareekh ke saath likha jata hai. Sab se late customer ke liye screen par narm yaad dihani; payment aate hi khata par mohar aur har screen update.',
    ],
  },
  {
    time: ['Any time', 'Kabhi bhi'],
    title: ['Ask in your own words', 'Apni zabaan mein poochein'],
    body: [
      'A question in Roman Urdu gets a straight answer from the shop’s own records. No guessing, even without internet.',
      'Roman Urdu mein sawal, dukaan ke apne records se seedha jawab. Koi andaza nahi, internet ke baghair bhi.',
    ],
  },
];

function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto w-[17.5rem] sm:w-[19rem] h-[33rem] sm:h-[36rem] rounded-[2.6rem] bg-ink p-2.5 shadow-lift">
      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-5 rounded-full bg-black z-20" aria-hidden />
      <div className="relative h-full w-full rounded-[2.1rem] bg-paper overflow-hidden">{children}</div>
    </div>
  );
}

const item = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.15 + i * 0.12, duration: 0.35 } }),
};

function MorningScreen() {
  const { pick } = useLanguage();
  const k = useDashboard('today').data;
  const top = useTodayActions().data?.actions[0];
  const rows: [string, string, boolean][] = k
    ? [
        [pick('Today’s sale', 'Aaj ki sale'), formatPKR(k.revenue_pkr), false],
        [pick('Cash in drawer', 'Cash box mein'), formatPKR(k.cash_in_hand_pkr), false],
        [pick('Late khata', 'Late udhaar'), formatPKR(k.overdue_receivables_pkr), true],
        [pick('Running low', 'Kam maal'), `${k.products_at_risk_count} items`, true],
      ]
    : [];
  return (
    <div className="pt-12 px-4 space-y-3">
      <motion.div custom={0} variants={item} initial="hidden" animate="show" className="rounded-2xl bg-[#8E2A21] p-1.5">
        <div className="rounded-xl bg-[#FFFDF6] register-margin relative pl-9 pr-3 py-1">
          {rows.map(([label, value, red], i) => (
            <motion.div key={label} custom={i + 1} variants={item} initial="hidden" animate="show" className="flex items-end py-2 border-b border-[rgba(42,91,168,0.2)] last:border-0">
              <span className="text-xs text-ink-soft whitespace-nowrap">{label}</span>
              <span className="flex-1 border-b-2 border-dotted border-[#CFC6AE] mx-1.5 mb-1.5 min-w-[0.5rem]" />
              <span className={cn('text-sm font-extrabold tabular whitespace-nowrap', red ? 'text-lal' : 'text-[#1F3A7A]')}>{value}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
      {top && (
        <motion.div custom={5} variants={item} initial="hidden" animate="show" className="parchi rounded-xl border border-line shadow-slip pl-12 pr-3 py-3 relative">
          <span className="absolute left-0 w-10 text-center top-2.5 text-2xl font-extrabold text-lal/80">1</span>
          <p className="text-xs text-ink-muted">{pick('Job 1 today', 'Aaj ka pehla kaam')}</p>
          <p className="text-sm font-extrabold leading-snug">{pick(top.title, top.title_ur)}</p>
          <span className="inline-block mt-2 px-3 py-1.5 rounded-lg bg-sabz text-white text-xs font-bold">{pick('Make the order list', 'Order list banayein')}</span>
        </motion.div>
      )}
    </div>
  );
}

function OrderScreen() {
  const { pick } = useLanguage();
  const plan = useReorderPlan(50_000).data;
  const lines = plan?.recommendations.slice(0, 4) ?? [];
  return (
    <div className="pt-12 px-4 space-y-3">
      <motion.div custom={0} variants={item} initial="hidden" animate="show" className="rounded-xl border-2 border-sabz bg-card px-3 py-2">
        <p className="text-xs text-ink-muted">{pick('Budget', 'Budget')}</p>
        <p className="text-2xl font-extrabold tabular">Rs 50,000</p>
      </motion.div>
      <div className="rounded-xl bg-card border border-line divide-y divide-line">
        {lines.map((l, i) => (
          <motion.div key={l.product_id} custom={i + 1} variants={item} initial="hidden" animate="show" className="flex justify-between gap-2 px-3 py-2">
            <span className="text-xs font-bold leading-snug">{l.product_name}</span>
            <span className="text-xs font-extrabold shrink-0">
              {l.recommended_packs} {l.pack_unit}
            </span>
          </motion.div>
        ))}
      </div>
      {plan && (
        <motion.div custom={6} variants={item} initial="hidden" animate="show" className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[#DCF8C6] px-3 py-2 text-xs shadow-card">
          <p className="font-bold">*Order: {plan.total_skus_recommended} items*</p>
          <p className="tabular">Kul: {formatPKR(plan.total_allocated_spend_pkr)}</p>
          <p className="flex items-center justify-end gap-1 text-[10px] text-ink-muted mt-0.5">
            11:02 <CheckCheck className="w-3.5 h-3.5 text-[#34B7F1]" />
          </p>
        </motion.div>
      )}
    </div>
  );
}

function KhataScreen() {
  const { pick } = useLanguage();
  const reduce = useReducedMotion();
  const c = useCreditSummary().data?.top_defaulters[0];
  if (!c) return null;
  return (
    <div className="pt-12 px-4 space-y-3">
      <motion.div custom={0} variants={item} initial="hidden" animate="show" className="rounded-xl bg-card border border-line px-3 py-3">
        <p className="text-sm font-extrabold">{c.name}</p>
        <p className="text-xs font-bold text-lal-dark">
          {formatPKR(c.overdue_amount_pkr)} {pick(`late, ${c.days_overdue} days`, `late, ${c.days_overdue} din`)}
        </p>
      </motion.div>
      <motion.div custom={1} variants={item} initial="hidden" animate="show" className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-[#DCF8C6] px-3 py-2 text-xs shadow-card">
        Assalam-o-Alaikum {c.name.split(' ')[0]} bhai, hisaab ki yaad dihani: {formatPKR(c.overdue_amount_pkr)} ki muddat guzar chuki hai. Shukriya.
      </motion.div>
      <motion.div custom={2} variants={item} initial="hidden" animate="show" className="max-w-[70%] rounded-2xl rounded-bl-md bg-card border border-line px-3 py-2 text-xs">
        {pick('I will come this evening and pay it all.', 'Aaj shaam aa kar poora de deta hoon.')}
      </motion.div>
      <div className="relative h-24">
        <motion.div
          className="absolute right-6 top-2 rounded-xl border-[3px] border-lal text-lal px-4 py-0.5 text-center bg-[#FFFDF6]"
          initial={reduce ? false : { opacity: 0, scale: 2.4, rotate: -4 }}
          animate={{ opacity: 0.95, scale: 1, rotate: -11 }}
          transition={{ delay: reduce ? 0 : 1.1, type: 'spring', stiffness: 500, damping: 20 }}
        >
          <span className="block font-urdu text-3xl leading-[1.9]" lang="ur">وصول</span>
          <span className="block text-xs font-extrabold tabular -mt-1">{formatPKR(c.overdue_amount_pkr)}</span>
        </motion.div>
      </div>
    </div>
  );
}

function AskScreen() {
  const { pick, language } = useLanguage();
  const question = pick('How much Dalda oil is left?', 'Dalda kitna bacha hai?');
  const answer = useQuery({
    queryKey: ['landing-ask', language],
    queryFn: () => unwrap(api.POST('/api/copilot/chat', { body: { message: question, language, history: [], store_id: 1 } })),
    staleTime: 5 * 60_000,
  });
  const text = (answer.data?.response ?? '').replace(/\*\*/g, '');
  return (
    <div className="pt-12 px-4 space-y-3">
      <motion.div custom={0} variants={item} initial="hidden" animate="show" className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-sabz text-white px-3 py-2 text-sm font-bold">
        {question}
      </motion.div>
      <motion.div custom={2} variants={item} initial="hidden" animate="show" className="max-w-[92%] rounded-2xl rounded-bl-md bg-card border border-line px-3 py-2 text-xs leading-relaxed">
        {text ? text.slice(0, 260) + (text.length > 260 ? '…' : '') : '…'}
        {answer.data && (
          <p className="mt-2 pt-1.5 border-t border-line text-[10px] text-ink-muted">
            {pick('From the shop’s records', 'Dukaan ke records se')}: {answer.data.tool_calls.map((t) => t.tool_label).join(', ')}
          </p>
        )}
      </motion.div>
    </div>
  );
}

const SCREENS = [MorningScreen, OrderScreen, KhataScreen, AskScreen];

/**
 * A shopkeeper's day, told by scrolling: the phone stays pinned while the day moves
 * from the morning register to buying, collecting and asking. Each screen is live data.
 */
export function DayStory() {
  const { pick } = useLanguage();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const lineHeight = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);
  useMotionValueEvent(scrollYProgress, 'change', (v) => setStep(Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length * 0.999)))));
  const Screen = SCREENS[step]!;

  return (
    <section ref={ref} className="relative bg-card border-y border-line" style={{ height: `${STEPS.length * 90 + 30}vh` }} aria-label={pick('A day with HisaabAI', 'HisaabAI ke saath ek din')}>
      <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-hidden">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 grid lg:grid-cols-[1fr_auto] content-start lg:content-center gap-3 lg:gap-16 items-start lg:items-center">
          <div className="order-1 pt-6 lg:pt-0">
            <h2 className="hidden lg:block text-3xl md:text-4xl font-extrabold tracking-tight mb-10">{pick('A day at the shop, with HisaabAI', 'Dukaan ka ek din, HisaabAI ke saath')}</h2>
            <div className="relative pl-10">
              {/* The day's timeline: it fills as you scroll. */}
              <div className="absolute left-[0.6rem] top-1 bottom-1 w-1 rounded-full bg-line" aria-hidden />
              <motion.div className="absolute left-[0.6rem] top-1 w-1 rounded-full bg-sabz origin-top" style={{ height: reduce ? '100%' : lineHeight }} aria-hidden />
              <ol className="space-y-6 lg:space-y-8">
                {STEPS.map((s, i) => {
                  const active = i === step;
                  return (
                    <li key={s.time[0]} className={cn('relative transition-opacity duration-300', active ? 'opacity-100' : 'opacity-35 hidden lg:block')}>
                      <span className={cn('absolute -left-10 top-1 w-[1.45rem] h-[1.45rem] rounded-full border-4 border-card transition-colors', i <= step ? 'bg-sabz' : 'bg-line-strong')} aria-hidden />
                      <p className="text-sm font-bold text-sabz">{pick(...s.time)}</p>
                      <h3 className="text-xl lg:text-2xl font-extrabold leading-tight">{pick(...s.title)}</h3>
                      <p className={cn('text-sm lg:text-base text-ink-soft mt-1.5 max-w-md', !active && 'lg:hidden')}>{pick(...s.body)}</p>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
          <div className="order-2 scale-[0.74] sm:scale-90 lg:scale-100 origin-top lg:origin-center -mt-2 lg:mt-0">
            <Phone>
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  className="absolute inset-0"
                  initial={reduce ? false : { opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? undefined : { opacity: 0, x: -30 }}
                  transition={{ duration: 0.3 }}
                >
                  <Screen />
                </motion.div>
              </AnimatePresence>
            </Phone>
          </div>
        </div>
      </div>
    </section>
  );
}
