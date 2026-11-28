import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

const KEY = 'hisaab_onboarding_v2';

type Phase = 'welcome' | 'tour' | 'done';

interface OnboardingValue {
  phase: Phase;
  startTour: () => void;
  finish: () => void;
  restart: () => void;
}

const Ctx = createContext<OnboardingValue | null>(null);

function initialPhase(): Phase {
  try {
    return localStorage.getItem(KEY) === 'done' ? 'done' : 'welcome';
  } catch {
    return 'welcome';
  }
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const navigate = useNavigate();

  const finish = useCallback(() => {
    setPhase('done');
    try {
      localStorage.setItem(KEY, 'done');
    } catch {
      // storage blocked: the tutorial will simply show again next time
    }
  }, []);

  const value = useMemo<OnboardingValue>(
    () => ({
      phase,
      finish,
      startTour: () => {
        navigate('/app');
        setPhase('tour');
      },
      restart: () => {
        navigate('/app');
        setPhase('welcome');
      },
    }),
    [phase, finish, navigate],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOnboarding(): OnboardingValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useOnboarding must be used inside <OnboardingProvider>');
  return ctx;
}
