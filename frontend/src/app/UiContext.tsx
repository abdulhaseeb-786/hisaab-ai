import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Which drawer or modal is open. Screens ask for "open product 4" or "give udhaar to
 * customer 1"; the sheet itself loads the real data by id.
 */
interface UiState {
  productId: number | null;
  reminderCustomerId: number | null;
  copilot: { open: boolean; prompt?: string };
  csvOpen: boolean;
  comboProductId: number | null;
  /** Open or close the day (galla count). */
  day: 'open' | 'close' | null;
  /** Udhaar entry; customerId preselects the customer. */
  udhaar: { open: boolean; customerId?: number };
  wasooli: { open: boolean; customerId?: number };
  expenseOpen: boolean;
  /** "Maal aaya" for a pending order; 0 means "choose the order first". */
  receivePurchaseId: number | null;
  paySupplierId: number | null;
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
  openDay: (mode: 'open' | 'close') => void;
  closeDay: () => void;
  openUdhaar: (customerId?: number) => void;
  closeUdhaar: () => void;
  openWasooli: (customerId?: number) => void;
  closeWasooli: () => void;
  openExpense: () => void;
  closeExpense: () => void;
  openReceive: (purchaseId?: number) => void;
  closeReceive: () => void;
  openPaySupplier: (supplierId: number) => void;
  closePaySupplier: () => void;
}

const UiContext = createContext<(UiState & UiActions) | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UiState>({
    productId: null,
    reminderCustomerId: null,
    copilot: { open: false },
    csvOpen: false,
    comboProductId: null,
    day: null,
    udhaar: { open: false },
    wasooli: { open: false },
    expenseOpen: false,
    receivePurchaseId: null,
    paySupplierId: null,
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
      openDay: (mode: 'open' | 'close') => set({ day: mode }),
      closeDay: () => set({ day: null }),
      // A customer sheet may be open underneath; the entry sheet replaces it.
      openUdhaar: (customerId?: number) => set({ udhaar: { open: true, customerId }, reminderCustomerId: null }),
      closeUdhaar: () => set({ udhaar: { open: false } }),
      openWasooli: (customerId?: number) => set({ wasooli: { open: true, customerId }, reminderCustomerId: null }),
      closeWasooli: () => set({ wasooli: { open: false } }),
      openExpense: () => set({ expenseOpen: true }),
      closeExpense: () => set({ expenseOpen: false }),
      openReceive: (purchaseId?: number) => set({ receivePurchaseId: purchaseId ?? 0 }),
      closeReceive: () => set({ receivePurchaseId: null }),
      openPaySupplier: (supplierId: number) => set({ paySupplierId: supplierId }),
      closePaySupplier: () => set({ paySupplierId: null }),
    };
  }, [state]);

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi must be used inside <UiProvider>');
  return ctx;
}
