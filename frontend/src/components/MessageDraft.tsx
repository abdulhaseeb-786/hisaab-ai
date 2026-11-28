import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Copy, Maximize2, PencilLine, X } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { useLanguage, type Language } from '@/i18n/LanguageContext';
import { copyText, plainDraft } from '@/lib/clipboard';
import { cn } from '@/lib/format';
import { Button } from './ui/Button';

export interface Draft {
  roman_urdu: string;
  english: string;
}

/** Render *bold* runs as bold, keep line breaks. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line.split(/(\*[^*\n]+\*)/g).map((part, j) =>
            part.startsWith('*') && part.endsWith('*') && part.length > 2 ? <strong key={j}>{part.slice(1, -1)}</strong> : <Fragment key={j}>{part}</Fragment>,
          )}
        </Fragment>
      ))}
    </>
  );
}

/**
 * A message the shopkeeper can show, read out or copy. Nothing is sent from HisaabAI:
 * no WhatsApp or SMS integration, so no customer number ever leaves the shop.
 */
export function MessageDraft({
  draft,
  title,
  editable = false,
  className,
}: {
  draft: Draft;
  title: string;
  editable?: boolean;
  className?: string;
}) {
  const { pick, language } = useLanguage();
  const reduce = useReducedMotion();
  const [lang, setLang] = useState<Language>(language);
  const [text, setText] = useState(lang === 'english' ? draft.english : draft.roman_urdu);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [big, setBig] = useState(false);

  useEffect(() => {
    setText(lang === 'english' ? draft.english : draft.roman_urdu);
    setEditing(false);
  }, [lang, draft.english, draft.roman_urdu]);

  useEffect(() => {
    if (!big) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setBig(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [big]);

  const copy = async () => {
    if (await copyText(plainDraft(text))) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-lg font-bold">{title}</p>
        <div role="radiogroup" aria-label={pick('Message language', 'Paighaam ki zabaan')} className="inline-flex p-1 rounded-xl bg-ink/[0.06]">
          {(['roman_urdu', 'english'] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={lang === l}
              onClick={() => setLang(l)}
              className={cn('min-h-[36px] px-3 rounded-lg text-sm font-bold', lang === l ? 'bg-card shadow-card text-ink' : 'text-ink-muted')}
            >
              {l === 'english' ? 'English' : 'Roman Urdu'}
            </button>
          ))}
        </div>
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10, rotate: -0.5 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 180 }}
        className="parchi relative rounded-2xl border border-line shadow-slip"
      >
        {editing ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={Math.min(14, text.split('\n').length + 1)}
            aria-label={title}
            className="block w-full bg-transparent pl-16 pr-5 py-4 text-base leading-[1.75rem] outline-none resize-y"
          />
        ) : (
          <p className="pl-16 pr-5 py-4 text-base leading-[1.75rem] text-ink whitespace-normal break-words">
            <Rich text={text} />
          </p>
        )}
      </motion.div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={copy} icon={copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />} className="flex-1 min-w-[9rem]">
          {copied ? pick('Copied', 'Copy ho gaya') : pick('Copy message', 'Paighaam copy karein')}
        </Button>
        <Button variant="secondary" onClick={() => setBig(true)} icon={<Maximize2 className="w-5 h-5" />}>
          {pick('Show customer', 'Customer ko dikhayein')}
        </Button>
        {editable && (
          <Button variant="ghost" onClick={() => setEditing((v) => !v)} aria-pressed={editing} icon={<PencilLine className="w-5 h-5" />}>
            {editing ? pick('Done', 'Theek hai') : pick('Edit', 'Badlein')}
          </Button>
        )}
      </div>
      <p className="text-sm text-ink-muted">
        {pick(
          'HisaabAI does not send messages. Show this screen, read it out, or copy it into any app you trust.',
          'HisaabAI khud paighaam nahi bhejta. Yeh screen dikhayein, parh kar sunayein, ya copy kar ke apni marzi ki app mein daalein.',
        )}
      </p>

      <AnimatePresence>
        {big && (
          <motion.div
            className="fixed inset-0 z-[70] bg-paper flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-line">
              <p className="font-bold text-ink-muted">{title}</p>
              <button onClick={() => setBig(false)} className="w-12 h-12 rounded-full flex items-center justify-center hover:bg-ink/5" aria-label={pick('Close', 'Band karein')}>
                <X className="w-7 h-7" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 sm:px-12 py-8">
              <p className="max-w-2xl mx-auto text-2xl sm:text-3xl leading-relaxed font-bold text-ink">
                <Rich text={text} />
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
