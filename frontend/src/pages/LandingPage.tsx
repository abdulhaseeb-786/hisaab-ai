import { animate, motion, useInView, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from 'framer-motion';
import { ArrowDown, BookOpenText, Languages, MessageCircleQuestion, PackageX, Send, ShieldCheck, TrendingDown, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useDashboard, useForecast, useReorderPlan, useStore, useTodayActions } from '@/api/queries';
import type { TodayAction } from '@/api/types';
import { Logo } from '@/components/Logo';
import { RegisterBook } from '@/components/RegisterBook';
import { ProductImage } from '@/components/ui/ProductImage';
import { Skeleton } from '@/components/ui/QueryState';
import { useLanguage } from '@/i18n/LanguageContext';
import { DayStory } from '@/landing/DayStory';
import { CountUp, DrawArrow, Reveal } from '@/landing/motion';
import { formatNumber, formatPct, formatPKR } from '@/lib/format';
import { useDebounced } from '@/lib/useDebounced';

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 40 });
  return <motion.div className="fixed top-0 inset-x-0 h-1 bg-sabz origin-left z-40" style={{ scaleX }} aria-hidden />;
}

function TopBar() {
  const { pick, language, toggleLanguage } = useLanguage();
  return (
    <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur border-b border-line">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
        <Logo />
        <nav className="hidden md:flex items-center gap-6 ml-8 text-base font-bold text-ink-soft" aria-label={pick('Page', 'Page')}>
          <a href="#problem" className="hover:text-ink">{pick('Why', 'Kyun')}</a>
          <a href="#day" className="hover:text-ink">{pick('A day with it', 'Ek din')}</a>
          <a href="#demo" className="hover:text-ink">{pick('Try it', 'Aazmayein')}</a>
          <a href="#how" className="hover:text-ink">{pick('How it works', 'Kaise kaam karta hai')}</a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={toggleLanguage} className="min-h-[44px] px-3 rounded-xl font-bold text-sm text-ink-soft hover:bg-ink/5">
            {language === 'roman_urdu' ? 'English' : 'Roman Urdu'}
          </button>
          <Link to="/app" className="hidden sm:inline-flex items-center min-h-[44px] px-4 rounded-xl bg-sabz text-white font-bold hover:bg-sabz-dark">
            {pick('Open the demo shop', 'Demo dukaan kholein')}
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const { pick } = useLanguage();
  const store = useStore();
  const today = useDashboard('today');
  const actions = useTodayActions();
  const reduce = useReducedMotion();
  const k = today.data;
  const top = actions.data?.actions[0];
  const ref = useRef<HTMLElement>(null);
  // As the reader scrolls on, the register settles back: the page hands over to the story.
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const bookY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 80]);
  const bookScale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 0.94]);

  return (
    <section ref={ref} className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-10 md:pt-16 pb-28 grid lg:grid-cols-[0.95fr_1.15fr] gap-10 lg:gap-12 items-center lg:min-h-[calc(100vh-4rem)]">
      <div>
        <motion.h1
          className="text-4xl md:text-5xl font-extrabold tracking-tight text-ink leading-[1.08]"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {pick('Every morning, your shop’s three most important jobs.', 'Har subah, dukaan ke teen sab se zaroori kaam.')}
        </motion.h1>
        <motion.p
          className="text-lg md:text-xl text-ink-soft mt-6 max-w-xl"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12 }}
        >
          {pick(
            'HisaabAI reads a general store’s sales, stock, khata and supplier bills, and tells the owner what to do today: what to buy, which price to fix, and whom to collect from. In Roman Urdu or English. Every number is worked out, never guessed.',
            'HisaabAI karyana store ki sale, stock, khata aur supplier bills parhta hai, aur maalik ko batata hai ke aaj kya karna hai: kya khareedna hai, kis cheez ki qeemat theek karni hai, aur kis se wasooli karni hai. Roman Urdu ya English mein. Har number hisaab se, andaze se nahi.',
          )}
        </motion.p>
        <motion.div className="flex flex-wrap gap-3 mt-8" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
          <Link to="/app" className="inline-flex items-center min-h-[56px] px-6 rounded-2xl bg-sabz text-white text-lg font-bold hover:bg-sabz-dark">
            {pick('Open the demo shop', 'Demo dukaan kholein')}
          </Link>
          <a href="#demo" className="inline-flex items-center gap-2 min-h-[56px] px-6 rounded-2xl border-2 border-line-strong bg-card text-lg font-bold hover:border-ink-muted">
            {pick('Try the budget planner', 'Budget planner aazmayein')}
          </a>
        </motion.div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 mt-8 text-base text-ink-soft">
          <li className="flex items-center gap-2"><Languages className="w-5 h-5 text-sabz" />{pick('Roman Urdu and English', 'Roman Urdu aur English')}</li>
          <li className="flex items-center gap-2"><WifiOff className="w-5 h-5 text-sabz" />{pick('Works without internet', 'Bina internet bhi')}</li>
          <li className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-sabz" />{pick('Never over your budget', 'Budget se zyada kabhi nahi')}</li>
        </ul>
      </div>

      <motion.div className="relative pb-24 sm:pb-16" style={{ y: bookY, scale: bookScale }}>
        <RegisterBook
          replay
          size="hero"
          ready={!!k && !!store.data}
          storeName={store.data?.name ?? ''}
          heading={
            <>
              <p className="text-base text-ink-muted">{store.data?.name}</p>
              <p className="text-2xl font-extrabold mt-1 leading-tight">{pick('Today’s register', 'Aaj ka register')}</p>
              <p className="text-base text-ink-soft mt-3">
                {k ? pick(`${formatNumber(k.sales_count)} bills so far today.`, `Aaj ab tak ${formatNumber(k.sales_count)} bill.`) : ' '}
              </p>
              <p className="text-sm text-ink-faint mt-6">{pick('Live from the demo shop', 'Demo dukaan se, abhi')}</p>
            </>
          }
          lines={
            k
              ? [
                  { label: pick('Today’s sale', 'Aaj ki sale'), value: formatPKR(k.revenue_pkr) },
                  { label: pick('Cash in drawer', 'Cash box mein cash'), value: formatPKR(k.cash_in_hand_pkr) },
                  { label: pick('Late khata', 'Late udhaar'), value: formatPKR(k.overdue_receivables_pkr), tone: 'red' },
                  { label: pick('Running low', 'Kam maal'), value: `${k.products_at_risk_count} items`, tone: 'red' },
                ]
              : [0, 1, 2, 3].map(() => ({ label: ' ', value: '' }))
          }
        />
        {top && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 30, rotate: 0 }}
            animate={{ opacity: 1, y: 0, rotate: -2.5 }}
            transition={{ delay: reduce ? 0 : 2.2, type: 'spring', damping: 16, stiffness: 120 }}
            className="parchi absolute left-4 sm:left-10 right-4 sm:right-auto sm:w-[22rem] -bottom-2 rounded-xl border border-line shadow-lift pl-16 pr-5 py-4"
          >
            <span className="absolute left-0 w-[3.25rem] text-center top-3 text-3xl font-extrabold text-lal/80">1</span>
            <p className="text-sm text-ink-muted">{pick('Today, job 1', 'Aaj ka pehla kaam')}</p>
            <p className="text-lg font-extrabold leading-snug">{pick(top.title, top.title_ur)}</p>
          </motion.div>
        )}
      </motion.div>

      <motion.a
        href="#problem"
        className="absolute bottom-2 left-1/2 -translate-x-1/2 hidden lg:flex flex-col items-center gap-1 text-sm font-bold text-ink-muted hover:text-ink"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3 }}
      >
        {pick('See why it matters', 'Dekhein kyun zaroori hai')}
        <motion.span animate={reduce ? undefined : { y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}>
          <ArrowDown className="w-5 h-5" />
        </motion.span>
      </motion.a>
    </section>
  );
}

const CASES: { type: TodayAction['action_type']; icon: typeof TrendingDown; title: [string, string]; does: [string, string] }[] = [
  {
    type: 'restock',
    icon: PackageX,
    title: ['The fast seller runs out', 'Tez bikne wala maal khatam'],
    does: ['Orders whole cartons before it runs out, within the money available.', 'Khatam hone se pehle, budget ke andar poore carton mangwata hai.'],
  },
  {
    type: 'fix_price',
    icon: TrendingDown,
    title: ['The distributor quietly raises the price', 'Distributor chupke se rate barha deta hai'],
    does: ['Spots the cost rise and suggests the shelf price that restores the margin.', 'Rate barhna pakarta hai aur munafa wapas lane wali qeemat batata hai.'],
  },
  {
    type: 'collect_khata',
    icon: BookOpenText,
    title: ['Khata that never comes back', 'Udhaar jo wapas nahi aata'],
    does: ['Ranks who to collect from first and writes a polite reminder.', 'Batata hai pehle kis se wasooli karni hai aur narm yaad dihani likhta hai.'],
  },
];

function Problem() {
  const { pick } = useLanguage();
  const actions = useTodayActions();
  return (
    <section id="problem" className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28 scroll-mt-16">
      <Reveal>
        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight max-w-3xl leading-tight">
          {pick('A shop has records. What it lacks is decisions.', 'Dukaan ke paas records hote hain. Faislay nahi.')}
        </h2>
        <p className="text-lg text-ink-soft mt-4 max-w-2xl">
          {pick(
            'Three ways a karyana store loses money every week, with the demo shop’s numbers right now, and what HisaabAI does about each.',
            'Teen tareeqe jin se karyana store har hafte paisa khota hai, demo dukaan ke abhi ke numbers ke saath, aur HisaabAI har ek ka kya karta hai.',
          )}
        </p>
      </Reveal>
      <div className="grid md:grid-cols-3 gap-10 md:gap-6 mt-12">
        {CASES.map((c, i) => {
          const a = actions.data?.actions.find((x) => x.action_type === c.type);
          return (
            <Reveal key={c.type} delay={i * 0.15} className="flex flex-col">
              <div className="flex items-center gap-2 text-lal-dark">
                <c.icon className="w-6 h-6 shrink-0" />
                <h3 className="text-xl font-extrabold text-ink">{pick(...c.title)}</h3>
              </div>
              <div className="parchi rounded-xl border border-line shadow-card pl-14 pr-4 py-4 mt-4 md:min-h-[9rem]">
                {a ? (
                  <>
                    <p className="font-bold leading-snug">{pick(a.title, a.title_ur)}</p>
                    <p className="text-sm text-ink-soft mt-1">{pick(a.summary, a.summary_ur)}</p>
                  </>
                ) : (
                  <Skeleton className="h-16" />
                )}
              </div>
              <div className="flex justify-center py-1">
                <DrawArrow delay={0.4 + i * 0.15} />
              </div>
              <div className="rounded-xl bg-sabz-tint px-4 py-4 flex-1">
                <p className="text-sm font-bold text-sabz-dark">HisaabAI</p>
                <p className="text-base text-ink mt-1">{pick(...c.does)}</p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

function Demo() {
  const { pick, language } = useLanguage();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -30% 0px' });
  const [budget, setBudget] = useState(5_000);
  const [touched, setTouched] = useState(false);
  const debounced = useDebounced(budget, 180);
  const plan = useReorderPlan(debounced);
  const p = plan.data;

  // When the demo comes into view the budget counts up to Rs 50,000, so the reader sees the
  // list fill in as money is added. After that, the slider is theirs.
  useEffect(() => {
    if (!inView || touched) return;
    if (reduce) {
      setBudget(50_000);
      return;
    }
    const c = animate(5_000, 50_000, { duration: 1.8, ease: 'easeInOut', onUpdate: (v) => setBudget(Math.round(v / 5_000) * 5_000) });
    return () => c.stop();
  }, [inView, touched, reduce]);

  return (
    <section ref={ref} id="demo" className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28 grid lg:grid-cols-[0.9fr_1.1fr] gap-10 scroll-mt-16">
      <Reveal>
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
          {pick('“I have Rs 50,000. What should I buy today, and why?”', '“Mere paas Rs 50,000 hain. Aaj kya khareedun, aur kyun?”')}
        </h2>
        <p className="text-lg text-ink-soft mt-4">
          {pick(
            'Drag the slider. This is the real planner running on the demo shop: whole cartons, most urgent first, never over the budget.',
            'Slider chalayein. Yeh demo dukaan par asli planner hai: poore carton, zaroori maal pehle, budget se zyada kabhi nahi.',
          )}
        </p>
        <label htmlFor="landing-budget" className="block mt-8 text-base font-bold">{pick('Budget', 'Budget')}</label>
        <p className="text-5xl font-extrabold tabular mt-1">{formatPKR(budget)}</p>
        <input
          id="landing-budget"
          type="range"
          min={5_000}
          max={200_000}
          step={5_000}
          value={budget}
          onChange={(e) => {
            setTouched(true);
            setBudget(Number(e.target.value));
          }}
          className="w-full h-12 accent-[#0E6B3F] mt-2"
        />
        <div className="flex justify-between text-sm text-ink-muted">
          <span>Rs 5,000</span>
          <span>Rs 200,000</span>
        </div>
        {p && (
          <p className="text-lg mt-6">
            {pick(
              `${p.total_skus_recommended} items for ${formatPKR(p.total_allocated_spend_pkr)}. ${formatPKR(p.remaining_unallocated_pkr)} stays in hand.`,
              `${p.total_skus_recommended} cheezein ${formatPKR(p.total_allocated_spend_pkr)} mein. ${formatPKR(p.remaining_unallocated_pkr)} bachein ge.`,
            )}
          </p>
        )}
      </Reveal>

      <Reveal delay={0.15}>
        <div className="rounded-2xl border border-line bg-card shadow-card p-5 sm:p-6 min-h-[26rem]">
          <div className="flex items-center justify-between mb-2">
            <p className="font-extrabold">{pick('Order list', 'Order ki list')}</p>
            {p && <p className="text-sm text-ink-muted tabular">{pick(`${Math.round(p.budget_used_pct)}% of budget`, `budget ka ${Math.round(p.budget_used_pct)}%`)}</p>}
          </div>
          {p && (
            <div className="h-2 rounded-full bg-ink/[0.07] overflow-hidden mb-3">
              <motion.div className="h-full bg-sabz rounded-full" animate={{ width: `${Math.min(100, p.budget_used_pct)}%` }} transition={{ duration: 0.3 }} />
            </div>
          )}
          {!p && <Skeleton className="h-80" />}
          {p && (
            <ol className="divide-y divide-line">
              {p.recommendations.slice(0, 6).map((l, i) => (
                <motion.li key={l.product_id} layout="position" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="py-3 flex items-start gap-3">
                  <span className="w-6 text-lg font-extrabold text-lal/80 tabular shrink-0">{i + 1}</span>
                  <ProductImage src={l.image_url} alt="" className="w-12 h-12 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold leading-snug">{l.product_name}</p>
                    <p className="text-sm text-ink-muted">{language === 'roman_urdu' ? l.reasons_ur[0] : l.reasons[0]}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-extrabold tabular">{l.recommended_packs} {l.pack_unit}</p>
                    <p className="text-sm text-ink-muted tabular">{formatPKR(l.line_total_cost_pkr)}</p>
                  </div>
                </motion.li>
              ))}
            </ol>
          )}
          {p && p.total_skus_recommended > 6 && (
            <Link to="/app/order?mode=budget" className="inline-flex mt-3 min-h-[44px] items-center font-bold text-sabz hover:underline">
              {pick(`See all ${p.total_skus_recommended} items and send the order`, `Tamam ${p.total_skus_recommended} items dekhein aur order bhejein`)}
            </Link>
          )}
        </div>
      </Reveal>
    </section>
  );
}

function PipelineStep({ index, total, progress, title, body }: { index: number; total: number; progress: MotionValue<number>; title: string; body: string }) {
  const reduce = useReducedMotion();
  const at = index / (total - 1);
  const opacity = useTransform(progress, [Math.max(0, at - 0.2), at], [0.3, 1]);
  const scale = useTransform(progress, [Math.max(0, at - 0.12), at], [0.7, 1]);
  return (
    <motion.li className="relative" style={{ opacity: reduce ? 1 : opacity }}>
      <motion.span
        className="absolute -left-12 md:static flex items-center justify-center w-10 h-10 rounded-full bg-sabz text-white font-extrabold ring-8 ring-card"
        style={{ scale: reduce ? 1 : scale }}
      >
        {index + 1}
      </motion.span>
      <h3 className="text-xl font-extrabold md:mt-4">{title}</h3>
      <p className="text-base text-ink-soft mt-1">{body}</p>
    </motion.li>
  );
}

function Pipeline() {
  const { pick } = useLanguage();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.5'] });
  const fill = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);
  const steps: [string, string, string, string][] = [
    ['Records', 'Records', 'Sales, stock, khata and supplier bills, or a CSV file from any till.', 'Sale, stock, khata aur supplier bills, ya kisi bhi system ki CSV file.'],
    ['Rules and forecasts', 'Qaide aur andaze', 'Stock cover against delivery time, margin checks, khata aging, and a demand forecast tested against simple baselines.', 'Stock ko delivery ke waqt se milana, munafa check, khata ki muddat, aur sale ka andaza jo seedhe tareeqon se test hota hai.'],
    ['Decisions', 'Faislay', 'Today’s 3 jobs, the buying list and the cash plan, each with its reason.', 'Aaj ke 3 kaam, khareedari ki list aur cash ka plan, har ek ki wajah ke saath.'],
    ['Explanation', 'Samjhana', 'The copilot answers in Roman Urdu or English, using only these results.', 'Copilot Roman Urdu ya English mein jawab deta hai, sirf inhi nataij se.'],
  ];
  return (
    <ol ref={ref} className="relative grid md:grid-cols-4 gap-8 md:gap-6 mt-12 pl-12 md:pl-0">
      {/* The flow line fills as the reader scrolls: data moves from records to answers. */}
      <div className="hidden md:block absolute top-[1.125rem] left-5 right-5 h-1 rounded-full bg-line" aria-hidden />
      <div className="hidden md:block absolute top-[1.125rem] left-5 right-5 h-1" aria-hidden>
        <motion.div className="h-full rounded-full bg-sabz" style={{ width: reduce ? '100%' : fill }} />
      </div>
      <div className="md:hidden absolute left-[1.125rem] top-2 bottom-2 w-1 rounded-full bg-line" aria-hidden />
      <div className="md:hidden absolute left-[1.125rem] top-2 bottom-2 w-1" aria-hidden>
        <motion.div className="w-full rounded-full bg-sabz" style={{ height: reduce ? '100%' : fill }} />
      </div>
      {steps.map(([en, ur, den, dur], i) => (
        <PipelineStep key={en} index={i} total={steps.length} progress={scrollYProgress} title={pick(en, ur)} body={pick(den, dur)} />
      ))}
    </ol>
  );
}

function Proof({ title, value, children, delay }: { title: string; value: ReactNode; children: ReactNode; delay: number }) {
  return (
    <Reveal delay={delay} className="rounded-2xl border border-line bg-paper p-6">
      <p className="text-base font-bold text-ink-soft">{title}</p>
      <p className="text-3xl font-extrabold mt-2 tabular">{value}</p>
      <p className="text-base text-ink-soft mt-2">{children}</p>
    </Reveal>
  );
}

function How() {
  const { pick } = useLanguage();
  const fc = useForecast({ store: true });
  const scores = fc.data?.model_comparison ?? [];
  const ours = scores.find((m) => m.model === 'calendar_smoothing');
  const bestBaseline = scores.filter((m) => m.model !== 'calendar_smoothing').sort((a, b) => a.total_error_pct - b.total_error_pct)[0];

  return (
    <section id="how" className="bg-card border-y border-line scroll-mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28">
        <Reveal>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">{pick('How the numbers are made', 'Numbers kaise bante hain')}</h2>
          <p className="text-lg text-ink-soft mt-4 max-w-2xl">
            {pick('The AI does not decide anything. Plain, tested rules do the maths; the AI only explains the result.', 'Faisla AI nahi karta. Seedhe, test kiye hue qaide hisaab karte hain; AI sirf natija samjhata hai.')}
          </p>
        </Reveal>
        <Pipeline />
        <div className="grid md:grid-cols-3 gap-5 mt-16">
          <Proof
            delay={0}
            title={pick('Forecast error, next 14 days (whole shop)', 'Andaze ki ghalati, agle 14 din (poori dukaan)')}
            value={ours ? <CountUp value={ours.total_error_pct} format={(v) => formatPct(v)} /> : '…'}
          >
            {ours && bestBaseline
              ? pick(
                  `The best simple method was off by ${formatPct(bestBaseline.total_error_pct)} on the same held-out days. Measured on the simulated demo shop.`,
                  `Sab se acha seedha tareeqa unhi din ${formatPct(bestBaseline.total_error_pct)} ghalat tha. Demo dukaan ke farzi data par.`,
                )
              : '…'}
          </Proof>
          <Proof delay={0.12} title={pick('Budget guarantee', 'Budget ki zamanat')} value={pick('Never over', 'Kabhi zyada nahi')}>
            {pick('Checked in code and in tests on budgets from Rs 1,000 to Rs 2,000,000. Orders are always whole cartons.', 'Code aur tests mein Rs 1,000 se Rs 2,000,000 tak check. Order hamesha poore carton mein.')}
          </Proof>
          <Proof delay={0.24} title={pick('The AI cannot invent numbers', 'AI number nahi ghar sakta')} value={pick('Read-only tools', 'Sirf parhne wale tools')}>
            {pick('If an AI answer contains numbers it did not look up, the answer is thrown away. Without internet, a built-in engine answers instead.', 'Agar AI ka jawab bina dekhe number de, to woh jawab rad ho jata hai. Bina internet ke andar ka engine jawab deta hai.')}
          </Proof>
        </div>
      </div>
    </section>
  );
}

function Counter() {
  const { pick } = useLanguage();
  const items: [typeof Languages, string, string, string, string][] = [
    [Languages, 'Roman Urdu first', 'Pehle Roman Urdu', 'Written the way shopkeepers talk, with English one tap away.', 'Waise likha jaise dukaandar baat karte hain, English ek tap par.'],
    [BookOpenText, 'Big text, one button per job', 'Bara likha, har kaam ka ek button', 'A typeface made for weak eyesight, and no screen with more than one main action.', 'Kamzor nazar ke liye bana font, aur har screen par ek hi bara kaam.'],
    [Send, 'Nothing is sent behind your back', 'Aap ke bina kuch nahi jata', 'Receipts, reminders and orders stay on your screen to show, read out or copy. No customer number leaves the shop.', 'Raseed, yaad dihani aur order screen par rehte hain: dikhayein, parh kar sunayein ya copy karein. Koi customer number dukaan se bahar nahi jata.'],
    [MessageCircleQuestion, 'Ask in your own words', 'Apni zabaan mein poochein', '“Dalda kitna bacha hai?” gets a straight answer from the shop’s own records.', '“Dalda kitna bacha hai?” ka seedha jawab, dukaan ke apne records se.'],
  ];
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28">
      <Reveal>
        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">{pick('Made for the counter, not the office', 'Counter ke liye bana, office ke liye nahi')}</h2>
      </Reveal>
      <div className="grid sm:grid-cols-2 gap-x-10 gap-y-10 mt-12">
        {items.map(([Icon, en, ur, den, dur], i) => (
          <Reveal key={en} delay={(i % 2) * 0.12} className="flex gap-4">
            <span className="w-12 h-12 rounded-2xl bg-sabz-tint text-sabz flex items-center justify-center shrink-0">
              <Icon className="w-6 h-6" />
            </span>
            <div>
              <h3 className="text-xl font-extrabold">{pick(en, ur)}</h3>
              <p className="text-base text-ink-soft mt-1">{pick(den, dur)}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Limits() {
  const { pick } = useLanguage();
  const store = useStore();
  const points = [
    pick(
      `The demo shop is simulated: ${store.data?.product_count ?? 120} real products and a year of generated sales, khata and supplier bills. Names and phone numbers are made up.`,
      `Demo dukaan farzi hai: ${store.data?.product_count ?? 120} asli products aur ek saal ki banayi hui sale, khata aur supplier bills. Naam aur number farzi hain.`,
    ),
    pick('Forecast accuracy on simulated data is not proof for real shops. We report it next to two simple methods, including where they win.', 'Farzi data par andaze ki durusti asli dukaanon ka saboot nahi. Hum isay do seedhe tareeqon ke saath dikhate hain, jahan woh behtar hon wahan bhi.'),
    pick('Next step: a pilot with real shops, starting from their own records through the CSV import.', 'Agla qadam: asli dukaanon ke saath pilot, unke apne records CSV se daal kar.'),
  ];
  return (
    <section id="limits" className="bg-ink text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-24 grid md:grid-cols-[0.9fr_1.1fr] gap-10">
        <Reveal>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">{pick('What we don’t claim yet', 'Hum abhi kya daawa nahi karte')}</h2>
        </Reveal>
        <ul className="space-y-5 text-lg text-white/85">
          {points.map((t, i) => (
            <li key={i}>
              <Reveal delay={i * 0.12} className="border-l-4 border-haldi pl-4">
                {t}
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const { pick } = useLanguage();
  return (
    <div className="min-h-screen bg-paper">
      <ScrollProgress />
      <TopBar />
      <main>
        <Hero />
        <Problem />
        <div id="day" className="scroll-mt-16">
          <DayStory />
        </div>
        <Demo />
        <How />
        <Counter />
        <Limits />
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center">
          <Reveal>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">{pick('See it as a shopkeeper would', 'Dukaandar ki nazar se dekhein')}</h2>
            <p className="text-lg text-ink-soft mt-3">{pick('A two-minute tour starts when you open the demo shop.', 'Demo dukaan kholte hi do minute ka tour shuru hota hai.')}</p>
            <Link to="/app" className="inline-flex items-center mt-8 min-h-[56px] px-8 rounded-2xl bg-sabz text-white text-lg font-bold hover:bg-sabz-dark">
              {pick('Open the demo shop', 'Demo dukaan kholein')}
            </Link>
          </Reveal>
        </section>
      </main>
      <footer className="border-t border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row gap-3 justify-between text-sm text-ink-muted">
          <Logo />
          <p>{pick('Capital Youth Expo 2026, Track 3: FinTech and Financial Inclusion', 'Capital Youth Expo 2026, Track 3: FinTech aur Financial Inclusion')}</p>
        </div>
      </footer>
    </div>
  );
}
