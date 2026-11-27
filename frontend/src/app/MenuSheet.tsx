import { CircleHelp, FileSpreadsheet, Globe, Map, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useResetDemo, useStore } from '@/api/queries';
import { Sheet } from '@/components/ui/Sheet';
import { useLanguage } from '@/i18n/LanguageContext';
import { formatDate } from '@/lib/format';
import { useOnboarding } from '@/onboarding/OnboardingContext';
import { useUi } from './UiContext';

function Row({ icon, title, detail, onClick, disabled }: { icon: ReactNode; title: string; detail?: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border border-line text-left hover:border-ink-muted disabled:opacity-60">
      <span className="w-11 h-11 rounded-full bg-sabz-tint text-sabz flex items-center justify-center shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block font-bold text-ink">{title}</span>
        {detail && <span className="block text-sm text-ink-muted">{detail}</span>}
      </span>
    </button>
  );
}

export function MenuSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pick, language, toggleLanguage } = useLanguage();
  const ui = useUi();
  const onboarding = useOnboarding();
  const store = useStore();
  const reset = useResetDemo();
  const navigate = useNavigate();

  const go = (fn: () => void) => {
    onClose();
    window.setTimeout(fn, 200);
  };

  return (
    <Sheet open={open} onClose={onClose} title={pick('Menu', 'Menu')} description={store.data ? `${store.data.name}, ${store.data.location ?? ''}` : undefined}>
      <div className="space-y-3">
        <Row icon={<Globe className="w-5 h-5" />} title={pick('Language: English', 'Zabaan: Roman Urdu')} detail={pick('Switch to Roman Urdu', 'English mein badlein')} onClick={toggleLanguage} />
        <Row icon={<CircleHelp className="w-5 h-5" />} title={pick('Show the tutorial again', 'Tutorial dobara dekhein')} onClick={() => go(onboarding.restart)} />
        <Row icon={<Map className="w-5 h-5" />} title={pick('Store map', 'Dukaan ka naqsha')} detail={pick('Each part of the shop at a glance', 'Dukaan ka har hissa ek nazar mein')} onClick={() => go(() => navigate('/app/store-map'))} />
        <Row icon={<FileSpreadsheet className="w-5 h-5" />} title={pick('Add records from a file', 'File se records daalein')} detail={pick('Products or sales from a CSV file', 'CSV file se products ya sale')} onClick={() => go(ui.openCsv)} />
        <Row
          icon={<RotateCcw className={reset.isPending ? 'w-5 h-5 animate-spin' : 'w-5 h-5'} />}
          title={pick('Reset the demo shop', 'Demo dukaan reset karein')}
          detail={reset.isSuccess ? pick('Done. Fresh demo data loaded.', 'Ho gaya. Naya demo data aa gaya.') : pick('Undo every change made while trying the app', 'App try karte hue ki gayi har tabdeeli wapas')}
          onClick={() => reset.mutate()}
          disabled={reset.isPending}
        />
        {reset.isError && <p className="text-sm text-lal-dark">{reset.error.message}</p>}
      </div>
      {store.data?.data_start && (
        <p className="text-sm text-ink-muted mt-6">
          {pick(
            `This is a demo shop with simulated records from ${formatDate(store.data.data_start, true)} to ${formatDate(store.data.data_end, true)}. Names and phone numbers are made up.`,
            `Yeh demo dukaan hai. Records farzi hain, ${formatDate(store.data.data_start, true)} se ${formatDate(store.data.data_end, true)} tak. Naam aur phone number bhi farzi hain.`,
          )}
        </p>
      )}
      <p className="sr-only">{language}</p>
    </Sheet>
  );
}
