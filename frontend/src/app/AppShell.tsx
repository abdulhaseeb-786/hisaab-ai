import { CircleHelp, Menu, MessageCircleQuestion } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useDashboard, useStore } from '@/api/queries';
import CopilotSheet from '@/components/CopilotSheet';
import CsvSheet from '@/components/CsvSheet';
import ComboSheet from '@/components/ComboSheet';
import { Logo } from '@/components/Logo';
import ProductSheet from '@/components/ProductSheet';
import CustomerSheet from '@/components/CustomerSheet';
import DaySheet from '@/components/day/DaySheet';
import ExpenseSheet from '@/components/day/ExpenseSheet';
import UdhaarSheet from '@/components/khata/UdhaarSheet';
import WasooliSheet from '@/components/khata/WasooliSheet';
import PaySupplierSheet from '@/components/orders/PaySupplierSheet';
import ReceiveSheet from '@/components/orders/ReceiveSheet';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/lib/format';
import { useOnboarding } from '@/onboarding/OnboardingContext';
import { MenuSheet } from './MenuSheet';
import { PRIMARY_NAV, SECONDARY_NAV } from './nav';
import { useUi } from './UiContext';

function useBadges(): Record<string, number> {
  const kpis = useDashboard('30d');
  return {
    '/app/stock': kpis.data?.products_at_risk_count ?? 0,
    '/app/khata': kpis.data?.overdue_customers_count ?? 0,
  };
}

function LanguageButton({ className }: { className?: string }) {
  const { language, toggleLanguage, pick } = useLanguage();
  return (
    <button
      onClick={toggleLanguage}
      className={cn('min-h-[44px] px-3 rounded-xl font-bold text-sm text-ink-soft hover:bg-ink/5', className)}
      aria-label={pick('Switch to Roman Urdu', 'Switch to English')}
    >
      {language === 'roman_urdu' ? 'EN' : 'اردو'}
    </button>
  );
}

function Sidebar() {
  const { pick } = useLanguage();
  const ui = useUi();
  const onboarding = useOnboarding();
  const store = useStore();
  const badges = useBadges();
  const [menu, setMenu] = useState(false);

  return (
    <aside className="print:hidden hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-line bg-card px-4 py-5">
      <Logo className="px-2" />
      <p className="px-2 mt-4 text-sm text-ink-muted leading-snug">
        {store.data?.name}
        <br />
        <span className="text-ink-faint">{pick('Demo shop', 'Demo dukaan')}</span>
      </p>

      <nav className="mt-6 space-y-1" aria-label={pick('Main', 'Main')}>
        {[...PRIMARY_NAV, ...SECONDARY_NAV].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={'end' in item ? item.end : undefined}
            data-tour={'tour' in item ? `side-${item.tour}` : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 min-h-[48px] px-3 rounded-xl font-bold transition-colors',
                isActive ? 'bg-sabz-tint text-sabz-dark' : 'text-ink-soft hover:bg-ink/5',
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="flex-1">{pick(item.en, item.ur)}</span>
            {(badges[item.to] ?? 0) > 0 && (
              <span className="min-w-[1.5rem] h-6 px-1.5 rounded-full bg-lal text-white text-xs font-bold flex items-center justify-center">{badges[item.to]}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-2">
        <button
          data-tour="ask-side"
          onClick={() => ui.openCopilot()}
          className="w-full flex items-center gap-3 min-h-[52px] px-4 rounded-2xl bg-ink text-white font-bold hover:bg-ink-soft"
        >
          <MessageCircleQuestion className="w-5 h-5" />
          {pick('Ask HisaabAI', 'HisaabAI se poochein')}
        </button>
        <div className="flex items-center gap-1">
          <button onClick={onboarding.restart} className="flex-1 flex items-center gap-2 min-h-[44px] px-3 rounded-xl text-sm font-bold text-ink-soft hover:bg-ink/5" data-tour="help-side">
            <CircleHelp className="w-5 h-5" />
            {pick('Tutorial', 'Tutorial')}
          </button>
          <LanguageButton />
          <button onClick={() => setMenu(true)} className="w-11 h-11 rounded-xl flex items-center justify-center text-ink-soft hover:bg-ink/5" aria-label={pick('Menu', 'Menu')}>
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>
      <MenuSheet open={menu} onClose={() => setMenu(false)} />
    </aside>
  );
}

function MobileTopBar() {
  const { pick } = useLanguage();
  const onboarding = useOnboarding();
  const store = useStore();
  const [menu, setMenu] = useState(false);
  return (
    <header className="print:hidden lg:hidden sticky top-0 z-30 bg-paper/95 backdrop-blur border-b border-line">
      <div className="flex items-center gap-2 px-4 h-16">
        <Logo compact />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="font-extrabold text-ink truncate">{store.data?.name ?? 'HisaabAI'}</p>
          <p className="text-xs text-ink-faint">{pick('Demo shop', 'Demo dukaan')}</p>
        </div>
        <button onClick={onboarding.restart} className="w-11 h-11 rounded-xl flex items-center justify-center text-ink-soft hover:bg-ink/5" aria-label={pick('Tutorial', 'Tutorial')} data-tour="help">
          <CircleHelp className="w-6 h-6" />
        </button>
        <LanguageButton />
        <button onClick={() => setMenu(true)} className="w-11 h-11 rounded-xl flex items-center justify-center text-ink-soft hover:bg-ink/5" aria-label={pick('Menu', 'Menu')}>
          <Menu className="w-6 h-6" />
        </button>
      </div>
      <MenuSheet open={menu} onClose={() => setMenu(false)} />
    </header>
  );
}

function BottomNav() {
  const { pick } = useLanguage();
  const badges = useBadges();
  return (
    <nav
      aria-label={pick('Main', 'Main')}
      className="print:hidden lg:hidden fixed bottom-0 inset-x-0 z-30 bg-card border-t border-line pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5">
        {PRIMARY_NAV.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={'end' in item ? item.end : undefined}
              data-tour={item.tour}
              className={({ isActive }) =>
                cn('relative flex flex-col items-center justify-center gap-0.5 h-16 text-xs font-bold', isActive ? 'text-sabz' : 'text-ink-muted')
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn('flex items-center justify-center w-14 h-8 rounded-full transition-colors', isActive && 'bg-sabz-tint')}>
                    <item.icon className="w-6 h-6" />
                  </span>
                  {pick(item.en, item.ur)}
                  {(badges[item.to] ?? 0) > 0 && (
                    <span className="absolute top-1.5 right-[calc(50%-1.6rem)] min-w-[1.25rem] h-5 px-1 rounded-full bg-lal text-white text-[11px] flex items-center justify-center">
                      {badges[item.to]}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function AskButton() {
  const { pick } = useLanguage();
  const ui = useUi();
  return (
    <button
      data-tour="ask"
      onClick={() => ui.openCopilot()}
      className="print:hidden lg:hidden fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-2 h-14 pl-4 pr-5 rounded-full bg-ink text-white font-bold shadow-lift"
    >
      <MessageCircleQuestion className="w-6 h-6" />
      {pick('Ask', 'Poochein')}
    </button>
  );
}

export function AppShell() {
  const ui = useUi();
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 bg-card px-4 py-2 rounded-xl font-bold">
        Skip to content
      </a>
      <Sidebar />
      <MobileTopBar />
      <main id="main" className="lg:pl-64 print:pl-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 pt-5 pb-40 lg:py-10 print:p-0 print:max-w-none">
          <Outlet />
        </div>
      </main>
      <BottomNav />
      <AskButton />

      <ProductSheet productId={ui.productId} onClose={ui.closeProduct} />
      <CustomerSheet customerId={ui.reminderCustomerId} onClose={ui.closeReminder} />
      <ComboSheet productId={ui.comboProductId} onClose={ui.closeCombo} />
      <CopilotSheet open={ui.copilot.open} initialPrompt={ui.copilot.prompt} onClose={ui.closeCopilot} />
      <CsvSheet open={ui.csvOpen} onClose={ui.closeCsv} />
      <DaySheet />
      <ExpenseSheet />
      <UdhaarSheet />
      <WasooliSheet />
      <ReceiveSheet />
      <PaySupplierSheet />
    </div>
  );
}
