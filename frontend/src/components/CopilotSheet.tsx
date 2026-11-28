import { Database, RotateCcw, Send } from 'lucide-react';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { useCopilotChat, type ChatTurn } from '@/api/queries';
import type { ChatResponse } from '@/api/types';
import type { CopilotSeed } from '@/app/UiContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/lib/format';
import { Sheet } from './ui/Sheet';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  meta?: Pick<ChatResponse, 'provider_used' | 'tool_calls'>;
  error?: boolean;
}

const SUGGESTIONS: [string, string][] = [
  ['I have Rs 50,000. What should I buy today and why?', 'Mere paas 50,000 rupay hain, aaj kya khareedun aur kyun?'],
  ['What should I do today?', 'Aaj kya karun?'],
  ['How much Dalda oil is left?', 'Dalda kitna bacha hai?'],
  ['Where am I losing margin?', 'Kahan munafa kam ho raha hai?'],
  ['Who owes me the most?', 'Sabse ziyada udhaar kiska hai?'],
  ['How is cash this week?', 'Is hafte cash ka kya haal hai?'],
];

export const SOURCE: Record<ChatResponse['provider_used'], [string, string]> = {
  gemini: ['Gemini, using your shop records', 'Gemini, aap ke records se'],
  groq: ['Llama, using your shop records', 'Llama, aap ke records se'],
  offline: ['Worked out on this device from your records', 'Aap ke records se, bina internet'],
};

/** Shows **bold** and line breaks without injecting HTML. */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i, all) => (
        <Fragment key={i}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j): ReactNode =>
            part.startsWith('**') && part.endsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : <Fragment key={j}>{part.replace(/^\s*[*-]\s/, '• ')}</Fragment>,
          )}
          {i < all.length - 1 && <br />}
        </Fragment>
      ))}
    </>
  );
}

export function CopilotSheet({ open, initialPrompt, seed, onClose }: { open: boolean; initialPrompt?: string; seed?: CopilotSeed; onClose: () => void }) {
  const { pick, language, t } = useLanguage();
  const chat = useCopilotChat();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const sent = useRef<string | undefined>(undefined);

  const send = (text: string) => {
    const message = text.trim();
    if (!message || chat.isPending) return;
    const history: ChatTurn[] = messages.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.text }));
    setMessages((m) => [...m, { role: 'user', text: message }]);
    setInput('');
    chat.mutate(
      { message, language, history },
      {
        onSuccess: (r) => setMessages((m) => [...m, { role: 'assistant', text: r.response, meta: { provider_used: r.provider_used, tool_calls: r.tool_calls } }]),
        onError: (e) => setMessages((m) => [...m, { role: 'assistant', text: e.message, error: true }]),
      },
    );
  };

  // Continuing from a voice answer: the question and answer are already in the chat.
  const seeded = useRef<CopilotSeed | undefined>(undefined);
  useEffect(() => {
    if (open && seed && seeded.current !== seed) {
      seeded.current = seed;
      setMessages([
        { role: 'user', text: seed.question },
        { role: 'assistant', text: seed.answer, meta: { provider_used: seed.provider, tool_calls: seed.tools.map((t) => ({ ...t, parameters: {}, result_summary: {} })) } },
      ]);
    }
  }, [open, seed]);

  useEffect(() => {
    if (open && initialPrompt && sent.current !== initialPrompt) {
      sent.current = initialPrompt;
      send(initialPrompt);
    }
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, chat.isPending]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={pick('Ask HisaabAI', 'HisaabAI se poochein')}
      description={pick('Answers come only from your shop records.', 'Jawab sirf aap ki dukaan ke records se.')}
      footer={
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={1000}
            placeholder={t('copilot_placeholder')}
            aria-label={pick('Your question', 'Aap ka sawal')}
            className="flex-1 min-w-0 min-h-[52px] px-4 rounded-2xl border-2 border-line-strong bg-paper text-base outline-none focus:border-sabz"
          />
          <button type="submit" disabled={chat.isPending || !input.trim()} className="w-[52px] h-[52px] rounded-2xl bg-sabz text-white flex items-center justify-center disabled:opacity-50" aria-label={pick('Send', 'Bhejein')}>
            <Send className="w-5 h-5" />
          </button>
        </form>
      }
    >
      <div className="space-y-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-lg text-ink-soft">{pick('Try one of these, or type your own question:', 'Inn mein se koi poochein, ya apna sawal likhein:')}</p>
            <div className="grid gap-2">
              {SUGGESTIONS.map(([en, ur]) => (
                <button key={en} onClick={() => send(pick(en, ur))} className="text-left min-h-[52px] px-4 py-3 rounded-2xl bg-card border-2 border-line font-bold hover:border-sabz">
                  {pick(en, ur)}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[88%] rounded-2xl px-4 py-3 text-base leading-relaxed',
                m.role === 'user' ? 'bg-sabz text-white rounded-br-md font-bold' : 'bg-card border border-line rounded-bl-md',
                m.error && 'bg-lal-tint border-lal/30 text-lal-dark',
              )}
            >
              <RichText text={m.text} />
              {m.meta && (
                <p className="mt-3 pt-2 border-t border-line text-sm text-ink-muted flex items-start gap-1.5">
                  <Database className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    {pick(...SOURCE[m.meta.provider_used])}
                    {m.meta.tool_calls.length > 0 && `: ${m.meta.tool_calls.map((c) => c.tool_label).join(', ')}`}
                  </span>
                </p>
              )}
            </div>
          </div>
        ))}

        {chat.isPending && (
          <div className="flex">
            <div className="rounded-2xl px-4 py-3 bg-card border border-line text-ink-muted flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sabz animate-ping" />
              {pick('Checking your records…', 'Records dekh raha hoon…')}
            </div>
          </div>
        )}

        {messages.length > 0 && !chat.isPending && (
          <button onClick={() => setMessages([])} className="inline-flex items-center gap-2 min-h-[44px] font-bold text-ink-muted hover:text-ink">
            <RotateCcw className="w-4 h-4" />
            {pick('Start a new question', 'Naya sawal shuru karein')}
          </button>
        )}
        <div ref={endRef} />
      </div>
    </Sheet>
  );
}

export default CopilotSheet;
