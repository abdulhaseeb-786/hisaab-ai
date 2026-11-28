import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { AppShell } from '@/app/AppShell';
import { UiProvider, useUi } from '@/app/UiContext';
import CopilotLauncher from '@/components/CopilotLauncher';
import CopilotSheet from '@/components/CopilotSheet';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { OnboardingProvider, useOnboarding } from '@/onboarding/OnboardingContext';
import { Tour } from '@/onboarding/Tour';
import { Welcome } from '@/onboarding/Welcome';
import BuyPage from '@/pages/BuyPage';
import CashPage from '@/pages/CashPage';
import LandingPage from '@/pages/LandingPage';
import KhataPage from '@/pages/KhataPage';
import StockPage from '@/pages/StockPage';
import StoreMapPage from '@/pages/StoreMapPage';
import TodayPage from '@/pages/TodayPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
    },
  },
});

/** The app itself; the tutorial only ever appears here, never on the landing page. */
function AppWithOnboarding() {
  return (
    <>
      <AppShell />
      <OnboardingLayer />
    </>
  );
}

function OnboardingLayer() {
  const { phase } = useOnboarding();
  if (phase === 'welcome') return <Welcome />;
  if (phase === 'tour') return <Tour />;
  return null;
}

function GlobalCopilot() {
  const ui = useUi();
  return (
    <>
      <CopilotLauncher />
      <CopilotSheet open={ui.copilot.open} initialPrompt={ui.copilot.prompt} onClose={ui.closeCopilot} />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <BrowserRouter>
          <OnboardingProvider>
            <UiProvider>
              <Routes>
                <Route index element={<LandingPage />} />
                <Route path="app" element={<AppWithOnboarding />}>
                  <Route index element={<TodayPage />} />
                  <Route path="buy" element={<BuyPage />} />
                  <Route path="stock" element={<StockPage />} />
                  <Route path="khata" element={<KhataPage />} />
                  <Route path="cash" element={<CashPage />} />
                  <Route path="store-map" element={<StoreMapPage />} />
                  <Route path="*" element={<Navigate to="/app" replace />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <GlobalCopilot />
            </UiProvider>
          </OnboardingProvider>
        </BrowserRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
