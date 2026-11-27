import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Which drawer or modal is open. Screens ask for "open product 4" or "open the khata
 * reminder for customer 1"; the modal itself loads the real data by id.
 */
interface UiState {
  productId: number | null;
  reminderCustomerId: number | null;
  copilot: { open: boolean; prompt?: string };
  csvOpen: boolean;
  comboProductId: number | null;
}

interface UiActions {
  openProduct: (id: number) => void;
  closeProduct: () => void;
  openReminder: (customerId: number) => void;
  closeReminder: () => void;
  openCopilot: (prompt?: string) => void;
  closeCopilot: () => void;
  openCsv: () => void;
  closeCsv: () => void;
  openCombo: (deadStockProductId: number) => void;
  closeCombo: () => void;
}

const UiContext = createContext<(UiState & UiActions) | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UiState>({
    productId: null,
    reminderCustomerId: null,
    copilot: { open: false },
    csvOpen: false,
    comboProductId: null,
  });

  const value = useMemo(() => {
    const set = (patch: Partial<UiState>) => setState((s) => ({ ...s, ...patch }));
    return {
      ...state,
      openProduct: (id: number) => set({ productId: id }),
      closeProduct: () => set({ productId: null }),
      openReminder: (customerId: number) => set({ reminderCustomerId: customerId }),
      closeReminder: () => set({ reminderCustomerId: null }),
      openCopilot: (prompt?: string) => set({ copilot: { open: true, prompt } }),
      closeCopilot: () => set({ copilot: { open: false } }),
      openCsv: () => set({ csvOpen: true }),
      closeCsv: () => set({ csvOpen: false }),
      openCombo: (id: number) => set({ comboProductId: id }),
      closeCombo: () => set({ comboProductId: null }),
    };
  }, [state]);

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi must be used inside <UiProvider>');
  return ctx;
}
