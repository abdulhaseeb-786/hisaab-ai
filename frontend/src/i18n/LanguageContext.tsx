import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type Language = 'roman_urdu' | 'english';

const STORAGE_KEY = 'hisaab_lang';

const en = {
  brand_tagline: 'Business helper for your shop',
  demo_badge: 'Demo data',

  nav_today: 'Today',
  nav_store_map: 'Store map',
  nav_buy: 'What to buy',
  nav_stock: 'Stock',
  nav_khata: 'Khata',
  nav_cash: 'Cash',
  nav_import: 'Import CSV',
  nav_ask: 'Ask HisaabAI',
  reset_demo: 'Reset demo',

  today_actions_title: "Today's 3 most important actions",
  ranking_rule_label: 'How these are picked',
  next_step: 'Next step',
  why: 'Why',
  money_at_stake: 'At stake',

  mart_title: 'Your store at a glance',
  mart_subtitle: 'Each pin shows the most important thing in that part of the shop right now.',

  hero_title: 'I have a budget. What should I buy today, and why?',
  hero_subtitle: 'HisaabAI fills your budget with whole cartons, most urgent items first, and never spends more than you have.',
  budget_label: 'Your budget for today',

  catalog_title: 'All products',
  search_placeholder: 'Search a product or SKU (e.g. Dalda, Surf)',

  khata_title: 'Khata (customer credit)',
  copilot_placeholder: 'Ask about stock, buying, profit, khata or cash...',

  loading: 'Loading...',
  retry: 'Try again',
  error_title: 'Could not load this',
};

type Dict = typeof en;
export type TranslationKey = keyof Dict;

const roman_urdu: Dict = {
  brand_tagline: 'Aap ki dukaan ka hisaab-kitaab madadgar',
  demo_badge: 'Demo data',

  nav_today: 'Aaj',
  nav_store_map: 'Dukaan ka naqsha',
  nav_buy: 'Kya khareedein',
  nav_stock: 'Stock',
  nav_khata: 'Khata',
  nav_cash: 'Cash',
  nav_import: 'CSV daalein',
  nav_ask: 'HisaabAI se poochein',
  reset_demo: 'Demo reset',

  today_actions_title: 'Aaj ke 3 sab se zaroori kaam',
  ranking_rule_label: 'Yeh kaise chune gaye',
  next_step: 'Agla qadam',
  why: 'Wajah',
  money_at_stake: 'Daao par',

  mart_title: 'Aap ki dukaan ek nazar mein',
  mart_subtitle: 'Har pin dukaan ke us hisse ki sab se ahem baat dikhata hai.',

  hero_title: 'Mere paas budget hai. Aaj kya khareedun, aur kyun?',
  hero_subtitle: 'HisaabAI aap ke budget mein poore carton rakhta hai, pehle sab se zaroori maal, aur budget se zyada kabhi kharch nahi karta.',
  budget_label: 'Aaj ka budget',

  catalog_title: 'Tamam maal',
  search_placeholder: 'Product ya SKU talash karein (e.g. Dalda, Surf)',

  khata_title: 'Khata (udhaar)',
  copilot_placeholder: 'Stock, khareedari, munafa, khata ya cash ke baare mein poochein...',

  loading: 'Load ho raha hai...',
  retry: 'Dobara koshish karein',
  error_title: 'Yeh load nahi ho saka',
};

const DICTIONARIES: Record<Language, Dict> = { english: en, roman_urdu };

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey) => string;
  /** Pick the right text when the API gives both an English and a Roman Urdu version. */
  pick: (english: string, romanUrdu: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'english' || saved === 'roman_urdu') return saved;
  } catch {
    // storage may be blocked (private mode); fall back to the default
  }
  return 'roman_urdu';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      toggleLanguage: () => setLanguage(language === 'roman_urdu' ? 'english' : 'roman_urdu'),
      t: (key) => DICTIONARIES[language][key],
      pick: (english, romanUrdu) => (language === 'roman_urdu' ? romanUrdu : english),
    }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>');
  return ctx;
}
