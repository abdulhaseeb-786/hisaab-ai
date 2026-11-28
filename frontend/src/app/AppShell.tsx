import { CircleHelp, Ellipsis, Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useDashboard, useStore } from '@/api/queries';
import CsvSheet from '@/components/CsvSheet';
import ComboSheet from '@/components/ComboSheet';
import { Logo } from '@/components/Logo';
import ProductSheet from '@/components/ProductSheet';
import CustomerSheet from '@/components/CustomerSheet';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/lib/format';
import { useOnboarding } from '@/onboarding/OnboardingContext';
import { MenuSheet } from './MenuSheet';
import { LANDING_NAV, PRIMARY_NAV, SECONDARY_NAV } from './nav';
import { useUi } from './UiContext';

const SIDEBAR_KEY = 'hisaab_sidebar_collapsed_v1';

function useBadges(): Record<string, number> {
  const kpis = useDashboard('30d');
  return {
    '/app/stock': kpis.data?.products_at_risk_count ?? 0,
    '/app/khata': kpis.data?.overdue_customers_count ?? 0,
  };
}

function LanguageButton({ inverse = false }: { inverse?: boolean }) {
  const { language, toggleLanguage, pick } = useLanguage();
  return (
    <button
      onClick={toggleLanguage}
      className={cn(
        'min-h-[44px] px-3 rounded-xl font-bold text-sm',
        inverse ? 'text-ivory/75 hover:bg-white/5' : 'text-ink-soft hover:bg-ink/5',
      )}
      aria-label={pick('Switch to Roman Urdu', 'Switch to English')}
    >
      {language === 'roman_urdu' ? 'EN' : 'اردو'}
    </button>
  );
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { pick } = useLanguage();
  const onboarding = useOnboarding();
  const store = useStore();
  const badges = useBadges();
  const [menu, setMenu] = useState(false);
  const items = [LANDING_NAV, ...PRIMARY_NAV, ...SECONDARY_NAV];

  return (
    <aside
      className={cn(
        'hidden lg:flex fixed inset-y-0 left-0 flex-col border-r border-gold/25 bg-royal-950 py-5 text-ivory transition-[width] duration-300 ease-out',
        collapsed ? 'w-20 px-2' : 'w-64 px-4',
      )}
    >
      <div className={cn('flex items-center', collapsed ? 'justify-center' : 'justify-between px-2')}>
        <Logo inverse animated compact={collapsed} />
        {!collapsed && (
          <button
            onClick={onToggle}
            className="w-11 h-11 rounded-xl flex items-center justify-center text-ivory/75 hover:bg-white/5"
            aria-label={pick('Collapse panel', 'Panel band karein')}
            title={pick('Collapse panel', 'Panel band karein')}
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={onToggle}
          className="mx-auto mt-3 w-11 h-11 rounded-xl flex items-center justify-center text-ivory/75 hover:bg-white/5"
          aria-label={pick('Open panel', 'Panel kholein')}
          title={pick('Open panel', 'Panel kholein')}
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {!collapsed && (
        <p className="px-2 mt-4 text-sm text-ivory/80 leading-snug">
          {store.data?.name}
          <br />
          <span className="text-ivory/55">{pick('Demo shop', 'Demo dukaan')}</span>
        </p>
      )}

      <nav className={cn('space-y-1', collapsed ? 'mt-4' : 'mt-6')} aria-label={pick('Main', 'Main')}>
        {items.map((item) => {
          const label = pick(item.en, item.ur);
          const badge = badges[item.to] ?? 0;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : undefined}
              data-tour={'tour' in item ? `side-${item.tour}` : undefined}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center min-h-[48px] rounded-xl font-bold transition-colors',
                  collapsed ? 'justify-center px-0' : 'gap-3 px-3',
                  isActive ? 'bg-white/10 text-ivory shadow-gold' : 'text-ivory/75 hover:bg-white/5',
                )
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="flex-1">{label}</span>}
              {badge > 0 &&
                (collapsed ? (
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-lal" aria-hidden />
                ) : (
                  <span className="min-w-[1.5rem] h-6 px-1.5 rounded-full bg-lal text-white text-xs font-bold flex items-center justify-center">{badge}</span>
                ))}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-auto">
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={onboarding.restart}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-ivory/75 hover:bg-white/5"
              aria-label={pick('Tutorial', 'Tutorial')}
              title={pick('Tutorial', 'Tutorial')}
              data-tour="help-side"
            >
              <CircleHelp className="w-5 h-5" />
            </button>
            <button
              onClick={() => setMenu(true)}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-ivory/75 hover:bg-white/5"
              aria-label={pick('More', 'Aur')}
              title={pick('More', 'Aur')}
            >
              <Ellipsis className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button onClick={onboarding.restart} className="flex-1 flex items-center gap-2 min-h-[44px] px-3 rounded-xl text-sm font-bold text-ivory/75 hover:bg-white/5" data-tour="help-side">
              <CircleHelp className="w-5 h-5" />
              {pick('Tutorial', 'Tutorial')}
            </button>
            <LanguageButton inverse />
            <button
              onClick={() => setMenu(true)}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-ivory/75 hover:bg-white/5"
              aria-label={pick('More', 'Aur')}
              title={pick('More', 'Aur')}
            >
              <Ellipsis className="w-5 h-5" />
            </button>
          </div>
        )}
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
    <header className="lg:hidden sticky top-0 z-30 royal-header">
      <div className="flex items-center gap-2 px-4 h-16">
        <Logo compact inverse animated />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="font-extrabold text-ivory truncate">{store.data?.name ?? 'HisaabAI'}</p>
          <p className="text-xs text-ivory/60">{pick('Demo shop', 'Demo dukaan')}</p>
        </div>
        <button onClick={onboarding.restart} className="w-11 h-11 rounded-xl flex items-center justify-center text-ivory/75 hover:bg-white/5" aria-label={pick('Tutorial', 'Tutorial')} data-tour="help">
          <CircleHelp className="w-6 h-6" />
        </button>
        <LanguageButton inverse />
        <button onClick={() => setMenu(true)} className="w-11 h-11 rounded-xl flex items-center justify-center text-ivory/75 hover:bg-white/5" aria-label={pick('Menu', 'Menu')}>
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
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-card border-t border-line pb-[env(safe-area-inset-bottom)]"
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

export function AppShell() {
  const ui = useUi();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === 'true';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, String(collapsed));
    } catch {
      return;
    }
  }, [collapsed]);

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 bg-card px-4 py-2 rounded-xl font-bold">
        Skip to content
      </a>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      <MobileTopBar />
      <main id="main" className={cn('transition-[padding] duration-300 ease-out', collapsed ? 'lg:pl-20' : 'lg:pl-64')}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 pt-5 pb-40 lg:py-10">
          <Outlet />
        </div>
      </main>
      <BottomNav />

      <ProductSheet productId={ui.productId} onClose={ui.closeProduct} />
      <CustomerSheet customerId={ui.reminderCustomerId} onClose={ui.closeReminder} />
      <ComboSheet productId={ui.comboProductId} onClose={ui.closeCombo} />
      <CsvSheet open={ui.csvOpen} onClose={ui.closeCsv} />
    </div>
  );
}
