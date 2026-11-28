import { Database, MessagesSquare, Mic, Volume2 } from 'lucide-react';
import { useUi } from '@/app/UiContext';
import type { VoiceProposal } from '@/api/types';
import { RichText, SOURCE } from '@/components/CopilotSheet';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/i18n/LanguageContext';
import { canSpeak, speak } from './speak';

const URDU_SCRIPT = /[؀-ۿ]/;

/** The answer as plain words for read-aloud: no **bold** marks or list dashes. */
export function spokenAnswer(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/^\s*[*-]\s+/gm, '')
    .replace(/\n+/g, '۔ ')
    .trim();
}

/** Read the answer aloud only with a voice that can say it: Urdu script with an Urdu voice, English with an English one. */
export function speakAnswer(text: string, english: boolean): boolean {
  const plain = spokenAnswer(text);
  if (URDU_SCRIPT.test(plain)) return speak({ urdu: plain, english: plain }, false);
  if (english) return speak({ urdu: plain, english: plain }, true);
  return false; // Roman Urdu: no browser voice reads it well; the screen is the answer
}

/** "Aap ne poocha" and HisaabAI's answer. A question never writes anything. */
export function VoiceAnswer({ p, audioUrl, onAgain, onDone }: { p: VoiceProposal; audioUrl: string | null; onAgain: () => void; onDone: () => void }) {
  const { pick, language } = useLanguage();
  const ui = useUi();
  const english = language === 'english';
  const a = p.answer;
  const continueInChat = () => {
    if (!a) return;
    onDone(); // closes and resets the voice sheet
    ui.openCopilot(undefined, {
      question: p.transcript_roman ?? p.question ?? p.transcript_urdu ?? '', // the user's own words, as shown above
      answer: a.response,
      provider: a.provider_used,
      tools: a.tool_calls.map((c) => ({ tool_name: c.tool_name, tool_label: c.tool_label })),
    });
  };
  const urdu = a ? URDU_SCRIPT.test(a.response) : false;
  return (
    <div className="space-y-5">
      <div className="p-4 rounded-2xl bg-ink/[0.04] space-y-2">
        <p className="text-sm font-bold text-ink-muted">{pick('You asked', 'Aap ne poocha')}</p>
        {p.transcript_urdu && <p className="font-urdu text-xl leading-[2.3]" dir="rtl" lang="ur">{p.transcript_urdu}</p>}
        {/* What was said or typed; the AI's tidied question is only what the copilot was given. */}
        {(p.transcript_roman || !p.transcript_urdu) && <p className="text-lg font-bold">“{p.transcript_roman ?? p.question}”</p>}
        {audioUrl && <audio controls preload="none" src={audioUrl} className="w-full h-10" aria-label={pick('Your recording', 'Aap ki recording')} />}
      </div>

      {a && (
        <div className="p-4 rounded-2xl bg-card border-2 border-sabz-mid space-y-3">
          <div className="flex items-start gap-3">
            <p className="text-sm font-bold text-ink-muted flex-1">{pick('HisaabAI says', 'HisaabAI ka jawab')}</p>
            {canSpeak(english) && (urdu || english) && (
              <button type="button" onClick={() => speakAnswer(a.response, english)} className="w-11 h-11 -mt-2 rounded-xl flex items-center justify-center text-ink-soft hover:bg-ink/5 shrink-0" aria-label={pick('Read it out', 'Sunayein')}>
                <Volume2 className="w-6 h-6" />
              </button>
            )}
          </div>
          <p className={urdu ? 'font-urdu text-xl leading-[2.4]' : 'text-lg leading-relaxed'} dir={urdu ? 'rtl' : undefined} lang={urdu ? 'ur' : undefined}>
            <RichText text={a.response} />
          </p>
          <p className="flex items-center gap-1.5 text-sm text-ink-muted">
            <Database className="w-4 h-4 shrink-0" />
            {pick(...SOURCE[a.provider_used])}
            {a.tool_calls.length > 0 && `: ${a.tool_calls.map((c) => c.tool_label).join(', ')}`}
          </p>
        </div>
      )}
      <p className="text-sm text-ink-muted">{pick('A question is only answered; nothing is written in your books.', 'Sawal ka sirf jawab diya jata hai; hisaab mein kuch nahi likha jata.')}</p>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onAgain} icon={<Mic className="w-5 h-5" />}>
          {pick('Ask again', 'Aur poochein')}
        </Button>
        {a && (
          <Button variant="secondary" onClick={continueInChat} icon={<MessagesSquare className="w-5 h-5" />}>
            {pick('Follow-up in chat', 'Chat mein jari rakhein')}
          </Button>
        )}
        <Button className="flex-1 min-w-[8rem]" onClick={onDone}>
          {pick('Done', 'Theek hai')}
        </Button>
      </div>
    </div>
  );
}
