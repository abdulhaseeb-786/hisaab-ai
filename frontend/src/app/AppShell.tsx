import { CircleHelp, Menu, Mic } from 'lucide-react';
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
import VoiceSheet from '@/voice/VoiceSheet';
import { cn } from '@/lib/format';
import { useOnboarding } from '@/onboarding/OnboardingContext';
import { MenuSheet } from './MenuSheet';
import { HUES, hueForPath } from './areas';
import { PRIMARY_NAV, SECONDARY_NAV } from './nav';
import { useUi } from './UiContext';

function useBadges(): Record<string, number> {
  const kpis = useDashboard('30d');
  return {
    '/app/stock': kpis.data?.products_at_risk_count ?? 0,
    '/app/khata': kpis.data?.overdue_customers_count ?? 0,
  };
}

function LanguageButton({ className, onBoard = false }: { className?: string; onBoard?: boolean }) {
  const { language, toggleLanguage, pick } = useLanguage();
  return (
    <button
      onClick={toggleLanguage}
      className={cn('min-h-[44px] px-3 rounded-xl font-bold text-sm', onBoard ? 'text-sabz-100 hover:bg-white/10 hover:text-white' : 'text-ink-soft hover:bg-ink/5', className)}
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
    <aside className="print:hidden hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-sabz-900 border-r-4 border-haldi-400 px-4 py-5 text-sabz-100">
      <Logo className="px-2" onBoard />
      <p className="px-2 mt-4 text-sm text-sabz-100 leading-snug">
        {store.data?.name}
        <br />
        <span className="text-sabz-300">{pick('Demo shop', 'Demo dukaan')}</span>
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
                isActive ? 'bg-haldi-400 text-sabz-950' : 'text-sabz-100 hover:bg-white/10 hover:text-white',
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="flex-1">{pick(item.en, item.ur)}</span>
            {(badges[item.to] ?? 0) > 0 && (
              <span className="min-w-[1.5rem] h-6 px-1.5 rounded-full bg-lal-500 text-white text-xs font-bold flex items-center justify-center ring-2 ring-sabz-900">{badges[item.to]}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-2">
        <button
          data-tour="voice-side"
          onClick={() => ui.openVoice(true)}
          className="w-full flex items-center gap-3 min-h-[60px] px-4 rounded-2xl bg-white text-sabz-900 font-bold hover:bg-haldi-50"
        >
          <span className="w-9 h-9 rounded-full bg-sabz-600 text-white flex items-center justify-center shrink-0">
            <Mic className="w-5 h-5" />
          </span>
          <span className="text-left leading-tight">
            {pick('Talk to HisaabAI', 'HisaabAI se baat')}
            <span className="block text-xs font-normal text-ink-muted">{pick('Speak an entry or ask', 'Bolein ya poochein')}</span>
          </span>
        </button>
        <div className="flex items-center gap-1">
          <button onClick={onboarding.restart} className="flex-1 flex items-center gap-2 min-h-[44px] px-3 rounded-xl text-sm font-bold text-sabz-100 hover:bg-white/10 hover:text-white" data-tour="help-side">
            <CircleHelp className="w-5 h-5" />
            {pick('Tutorial', 'Tutorial')}
          </button>
          <LanguageButton onBoard />
          <button onClick={() => setMenu(true)} className="w-11 h-11 rounded-xl flex items-center justify-center text-sabz-100 hover:bg-white/10 hover:text-white" aria-label={pick('Menu', 'Menu')}>
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
    <header className="print:hidden lg:hidden sticky top-0 z-30 bg-sabz-900 border-b-4 border-haldi-400">
      <div className="flex items-center gap-2 px-4 h-16">
        <Logo compact />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="font-extrabold text-white truncate">{store.data?.name ?? 'HisaabAI'}</p>
          <p className="text-xs text-sabz-300">{pick('Demo shop', 'Demo dukaan')}</p>
        </div>
        <button onClick={onboarding.restart} className="w-11 h-11 rounded-xl flex items-center justify-center text-sabz-100 hover:bg-white/10" aria-label={pick('Tutorial', 'Tutorial')} data-tour="help">
          <CircleHelp className="w-6 h-6" />
        </button>
        <LanguageButton onBoard />
        <button onClick={() => setMenu(true)} className="w-11 h-11 rounded-xl flex items-center justify-center text-sabz-100 hover:bg-white/10" aria-label={pick('Menu', 'Menu')}>
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
        {PRIMARY_NAV.map((item) => {
          const hue = HUES[hueForPath(item.to)];
          return (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={'end' in item ? item.end : undefined}
              data-tour={item.tour}
              className={({ isActive }) =>
                cn('relative flex flex-col items-center justify-center gap-0.5 h-16 text-xs font-bold', isActive ? hue.tabText : 'text-ink-muted')
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn('flex items-center justify-center w-14 h-8 rounded-full transition-colors', isActive && hue.tab)}>
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
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The one assistant, always one tap away: a raised mic above the middle of the bottom bar.
 * Speak or type an udhaar, wasooli or kharcha, or ask a question.
 */
function VoiceButton() {
  const { pick } = useLanguage();
  const ui = useUi();
  return (
    <button
      data-tour="voice"
      onClick={() => ui.openVoice(true)}
      aria-label={pick('Talk to HisaabAI: write by voice or ask', 'HisaabAI se baat: bol kar likhein ya poochein')}
      className="print:hidden lg:hidden fixed left-1/2 -translate-x-1/2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 w-16 h-16 rounded-full bg-sabz text-white flex items-center justify-center shadow-lift ring-4 ring-paper hover:bg-sabz-dark"
    >
      <Mic className="w-8 h-8" />
    </button>
  );
}

export function AppShell() {
  const ui = useUi();
  return (
    <div className="min-h-screen bg-paper">
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
      <VoiceButton />

      <ProductSheet productId={ui.productId} onClose={ui.closeProduct} />
      <CustomerSheet customerId={ui.reminderCustomerId} onClose={ui.closeReminder} />
      <ComboSheet productId={ui.comboProductId} onClose={ui.closeCombo} />
      <CopilotSheet open={ui.copilot.open} initialPrompt={ui.copilot.prompt} seed={ui.copilot.seed} onClose={ui.closeCopilot} />
      <CsvSheet open={ui.csvOpen} onClose={ui.closeCsv} />
      <DaySheet />
      <ExpenseSheet />
      <UdhaarSheet />
      <WasooliSheet />
      <ReceiveSheet />
      <PaySupplierSheet />
      <VoiceSheet />
    </div>
  );
}
