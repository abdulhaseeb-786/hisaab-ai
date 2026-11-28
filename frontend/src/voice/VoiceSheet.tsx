import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CircleCheck, Info, Keyboard, Mic, RotateCcw, Send, ShieldCheck, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useVoiceConfirm, useVoiceDiscard, useVoiceSettings, useVoiceStatus, useVoiceUnderstand, voiceAudioUrl } from '@/api/queries';
import type { VoiceProposal, VoiceSaved } from '@/api/types';
import { useUi } from '@/app/UiContext';
import { MessageDraft } from '@/components/MessageDraft';
import { Button } from '@/components/ui/Button';
import { Stamp } from '@/components/ui/Fields';
import { ErrorBox } from '@/components/ui/QueryState';
import { Sheet } from '@/components/ui/Sheet';
import { useLanguage } from '@/i18n/LanguageContext';
import { formatPKR } from '@/lib/format';
import { MicButton } from './MicButton';
import { useRecorder, type MicProblem } from './recorder';
import { sentence, type Sentence } from './sentence';
import { canSpeak, speak, stopSpeaking, urduVoice, warmUpVoices } from './speak';
import { VoiceAnswer, speakAnswer } from './VoiceAnswer';
import { VoiceReview, draftFromProposal, toConfirm, toDraft, type ReviewState } from './VoiceReview';

const READBACK_KEY = 'hisaab_voice_readback';
const EXAMPLES = [
  { ur: 'آج علی بٹ پانچ ہزار روپے ادھار لے گیا', roman: 'Aaj Ali Butt 5000 rupay udhaar le gaya' },
  { ur: 'عمران نے دو ہزار واپس دیے، ایزی پیسہ پر', roman: 'Imran ne 2000 wapas diye, Easypaisa pe' },
  { ur: 'طارق بھائی دو کلو چینی اور تین لکس صابن لے گئے', roman: 'Tariq bhai do kilo cheeni aur teen Lux sabun le gaye' },
  { ur: 'بجلی کا بل ساڑھے تین ہزار دیا', roman: 'Bijli ka bill saadhe teen hazaar diya' },
  { ur: 'عمران کا کتنا ادھار باقی ہے؟', roman: 'Imran ka kitna udhaar baqi hai?' },
];

function readbackOn(): boolean {
  try {
    return localStorage.getItem(READBACK_KEY) !== 'off';
  } catch {
    return true;
  }
}

function MicHelp({ problem }: { problem: MicProblem }) {
  const { pick } = useLanguage();
  const text: Record<MicProblem, [string, string]> = {
    insecure: ['The microphone only works on a secure link (https) or on this computer (localhost). Type it below instead.', 'Mic sirf mehfooz link (https) ya isi computer (localhost) par chalta hai. Neeche likh dein.'],
    unsupported: ['This browser cannot record. Use Chrome or Edge, or type it below.', 'Yeh browser recording nahi karta. Chrome ya Edge chalayein, ya neeche likh dein.'],
    denied: ['Microphone permission was refused. Allow the mic in the browser (lock icon next to the address), or type it below.', 'Mic ki ijazat nahi mili. Browser mein mic allow karein (address ke saath taale ka nishan), ya neeche likh dein.'],
    'no-mic': ['No microphone found on this device. Type it below.', 'Is device par mic nahi mila. Neeche likh dein.'],
    failed: ['The microphone did not start. Try again, or type it below.', 'Mic shuru nahi hua. Dobara koshish karein, ya neeche likh dein.'],
    'too-short': ['That was too short. Hold the button while you speak.', 'Bohat chhota tha. Bolte waqt button daba kar rakhein.'],
  };
  return (
    <p role="alert" className="flex gap-2 p-3 rounded-xl bg-haldi-tint text-ink text-sm font-bold">
      <Info className="w-5 h-5 shrink-0 text-haldi-dark" />
      {pick(...text[problem])}
    </p>
  );
}

function Consent({ onAnswer, busy }: { onAnswer: (yes: boolean) => void; busy: boolean }) {
  const { pick } = useLanguage();
  return (
    <div className="p-4 rounded-2xl bg-neela-tint border border-neela/40 space-y-3">
      <p className="flex items-center gap-2 text-lg font-bold">
        <ShieldCheck className="w-6 h-6 text-neela" />
        {pick('Allow online AI to understand your voice?', 'Awaaz samajhne ke liye online AI ki ijazat?')}
      </p>
      <p className="text-base text-ink-soft">
        {pick(
          'To understand Urdu speech, the recording and your customers’ names are sent to an online AI (Google Gemini, or Groq as backup). The recording is also kept in your shop’s records so you can play it back. Without permission you can still type.',
          'Urdu baat samajhne ke liye recording aur customers ke naam online AI (Google Gemini, ya Groq) ko bheje jayen ge. Recording aap ki dukaan ke record mein bhi rahe gi taake baad mein sun sakein. Ijazat ke baghair aap likh kar bata sakte hain.',
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onAnswer(true)} disabled={busy} className="flex-1">
          {pick('Yes, allow', 'Haan, ijazat hai')}
        </Button>
        <Button variant="secondary" onClick={() => onAnswer(false)} disabled={busy}>
          {pick('No, I will type', 'Nahi, likh kar bataun ga')}
        </Button>
      </div>
    </div>
  );
}

function Saved({ saved, said, onMore, onDone }: { saved: VoiceSaved; said: Sentence; onMore: () => void; onDone: () => void }) {
  const { pick, language } = useLanguage();
  const reduce = useReducedMotion();
  const stamp = saved.intent === 'udhaar' ? 'ادھار' : saved.intent === 'wasooli' ? 'وصول' : 'خرچ';
  const amount = saved.udhaar?.total_pkr ?? saved.payment?.amount_received ?? saved.expense?.amount_pkr ?? 0;
  const after = saved.udhaar
    ? pick(`${saved.udhaar.name} now owes ${formatPKR(saved.udhaar.balance_pkr)}.`, `${saved.udhaar.name} ka khata ab ${formatPKR(saved.udhaar.balance_pkr)}.`)
    : saved.payment
      ? pick(`${saved.payment.name} now owes ${formatPKR(saved.payment.new_balance)}.`, `${saved.payment.name} ka baqi khata ${formatPKR(saved.payment.new_balance)}.`)
      : saved.expense
        ? pick(`Cash Box now ${formatPKR(saved.expense.cash_in_drawer_pkr)}.`, `Cash box mein ab ${formatPKR(saved.expense.cash_in_drawer_pkr)}.`)
        : '';
  const receipt = saved.udhaar?.receipt ?? saved.payment?.receipt;
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-2xl font-extrabold text-sabz-dark">
            <CircleCheck className="w-7 h-7 shrink-0" />
            {pick('Written in the book.', 'Likh diya.')}
          </p>
          <p className="mt-2 font-urdu text-xl leading-[2.4] text-ink" dir="rtl" lang="ur">{said.urdu}</p>
          <p className="text-base text-ink-soft">{language === 'english' ? said.english : said.roman}</p>
          <p className="text-base text-ink-soft mt-1">{after}</p>
          {saved.new_customer && <p className="text-sm text-ink-muted mt-1">{pick('A new khata was opened.', 'Naya khata khul gaya.')}</p>}
        </div>
        <motion.div className="shrink-0" initial={reduce ? false : { scale: 2.3, opacity: 0, rotate: -6 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 480, damping: 22 }}>
          <Stamp urdu={stamp} line={formatPKR(amount)} tone={saved.intent === 'wasooli' ? 'sabz' : 'lal'} />
        </motion.div>
      </div>
      {receipt && <MessageDraft draft={receipt} title={pick('Receipt for the customer', 'Customer ki raseed')} />}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onMore} icon={<Mic className="w-5 h-5" />}>
          {pick('Say another', 'Aur bolein')}
        </Button>
        <Button className="flex-1" onClick={onDone}>
          {pick('Done', 'Theek hai')}
        </Button>
      </div>
    </div>
  );
}

/**
 * "Bol kar likhein": say what happened, check what HisaabAI understood, then save.
 * Nothing reaches the khata or the galla until the shopkeeper taps "Haan, likh do".
 */
export function VoiceSheet() {
  const { pick, language } = useLanguage();
  const ui = useUi();
  const open = ui.voice.open;
  const status = useVoiceStatus();
  const settings = useVoiceSettings();
  const understand = useVoiceUnderstand();
  const confirm = useVoiceConfirm();
  const discard = useVoiceDiscard();
  const rec = useRecorder(status.data?.max_seconds ?? 30);
  const [typed, setTyped] = useState('');
  const [showTyping, setShowTyping] = useState(false);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [proposal, setProposal] = useState<VoiceProposal | null>(null);
  const [readback, setReadback] = useState(readbackOn);
  const [, setVoicesReady] = useState(0);
  const autoListened = useRef(false);

  useEffect(() => warmUpVoices(() => setVoicesReady((n) => n + 1)), []);

  const cloudReady = Boolean(status.data?.cloud_allowed && status.data.cloud_available);
  const askConsent = Boolean(status.data && status.data.cloud_available && !status.data.cloud_allowed && !settings.isSuccess);

  const reset = () => {
    rec.cancel();
    stopSpeaking();
    understand.reset();
    confirm.reset();
    setProposal(null);
    setReview(null);
    setTyped('');
  };

  // Closing with an unsaved proposal sets it aside (kept as "discarded", never written).
  const close = () => {
    if (proposal && proposal.intent !== 'question' && !confirm.isSuccess) discard.mutate(proposal.capture_id);
    reset();
    setShowTyping(false);
    autoListened.current = false;
    ui.closeVoice();
  };

  // Opening from a mic button starts listening straight away, but only if permission was
  // already given: decided once per opening, never later (e.g. right after "Haan, ijazat hai").
  useEffect(() => {
    if (!open || autoListened.current || !status.data) return;
    autoListened.current = true;
    if (ui.voice.listen && cloudReady && !proposal) void rec.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, status.data]);

  const said = useMemo(() => (review ? sentence(toDraft(review)) : null), [review]);
  const english = language === 'english';

  const sayBack = (s: Sentence | null) => {
    if (s && readback) speak({ urdu: s.urdu, english: s.english }, english);
  };

  // Questions are answered in Urdu script when this device can read Urdu aloud.
  const answerLanguage = english ? 'english' : urduVoice() ? 'urdu' : 'roman_urdu';

  const received = (p: VoiceProposal) => {
    setProposal(p);
    if (p.intent === 'question') {
      if (readback && p.answer) speakAnswer(p.answer.response, english);
      return;
    }
    const r = draftFromProposal(p);
    setReview(r);
    // Read back only when there is something complete to read: an amount, or items all matched.
    if (p.intent && (r.items.length ? r.items.every((i) => i.product) : p.amount_pkr)) sayBack(sentence(toDraft(r)));
  };

  const finish = async () => {
    const clip = await rec.stop();
    if (clip) understand.mutate({ audio: clip.blob, seconds: clip.seconds, answerLanguage }, { onSuccess: received });
  };

  const sendTyped = (e: FormEvent) => {
    e.preventDefault();
    const t = typed.trim();
    if (t.length < 3) return;
    understand.mutate({ text: t, answerLanguage }, { onSuccess: received });
  };

  const again = () => {
    if (proposal && proposal.intent !== 'question' && !confirm.isSuccess) discard.mutate(proposal.capture_id);
    reset();
  };

  const save = () => {
    if (!proposal || !review) return;
    const body = toConfirm(review);
    if (!body) return;
    confirm.mutate({ captureId: proposal.capture_id, body }, {
      onSuccess: () => {
        if (readback && said) speak({ urdu: `${said.urdu} لکھ دیا۔`, english: `${said.english} Written.` }, english);
      },
    });
  };

  const toggleReadback = () => {
    const next = !readback;
    setReadback(next);
    try {
      localStorage.setItem(READBACK_KEY, next ? 'on' : 'off');
    } catch {
      /* per-device preference only */
    }
    if (!next) stopSpeaking();
  };

  const stage = confirm.isSuccess ? 'saved' : proposal?.intent === 'question' ? 'answer' : review ? 'review' : understand.isPending ? 'thinking' : 'listen';
  const speakable = canSpeak(english);

  return (
    <Sheet
      open={open}
      onClose={close}
      width="lg"
      title={pick('Say it, HisaabAI writes it', 'Bolein, HisaabAI likhe ga')}
      description={stage === 'listen' ? pick('Udhaar, wasooli or kharcha, the way you would tell a munshi. Or ask a question.', 'Udhaar, wasooli ya kharcha, jaise munshi ko batate hain. Ya koi sawal poochein.') : undefined}
      footer={
        stage === 'review' && review ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={again} icon={<RotateCcw className="w-5 h-5" />}>
              {pick('Again', 'Dobara')}
            </Button>
            <Button size="lg" className="flex-1" onClick={save} disabled={!toConfirm(review) || confirm.isPending}>
              {confirm.isPending ? pick('Saving', 'Likh raha hoon') : pick('Yes, write it', 'Haan, likh do')}
            </Button>
          </div>
        ) : undefined
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {stage === 'answer' && proposal ? (
          <motion.div key="answer" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <VoiceAnswer p={proposal} audioUrl={proposal.has_recording ? voiceAudioUrl(proposal.capture_id) : null} onAgain={reset} onDone={close} />
          </motion.div>
        ) : stage === 'saved' && confirm.data && said ? (
          <motion.div key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Saved saved={confirm.data} said={said} onMore={reset} onDone={close} />
          </motion.div>
        ) : stage === 'review' && review && proposal ? (
          <motion.div key="review" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {said && (
              <div className="p-4 rounded-2xl bg-card border-2 border-sabz-mid">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink-muted">{pick('HisaabAI will write:', 'HisaabAI yeh likhe ga:')}</p>
                    <p className="font-urdu text-2xl leading-[2.3] text-ink" dir="rtl" lang="ur">{said.urdu}</p>
                    <p className="text-lg font-bold leading-snug">{english ? said.english : said.roman}</p>
                  </div>
                  {speakable && (
                    <button type="button" onClick={() => speak({ urdu: said.urdu, english: said.english }, english)} className="w-11 h-11 rounded-xl flex items-center justify-center text-ink-soft hover:bg-ink/5 shrink-0" aria-label={pick('Read it out', 'Sunayein')}>
                      <Volume2 className="w-6 h-6" />
                    </button>
                  )}
                </div>
              </div>
            )}
            <VoiceReview proposal={proposal} state={review} onChange={setReview} audioUrl={proposal.has_recording ? voiceAudioUrl(proposal.capture_id) : null} />
            {confirm.isError && <ErrorBox error={confirm.error} />}
          </motion.div>
        ) : (
          <motion.div key="listen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {askConsent && <Consent busy={settings.isPending} onAnswer={(yes) => settings.mutate(yes, { onSuccess: () => { if (!yes) setShowTyping(true); } })} />}
            {status.data?.cloud_available && !status.data.cloud_allowed && !askConsent && (
              <button type="button" onClick={() => settings.mutate(true)} className="flex items-center gap-2 min-h-[44px] px-3 rounded-xl text-sm font-bold text-neela hover:bg-neela-tint">
                <Mic className="w-5 h-5" />
                {pick('Turn on speaking (allow online AI)', 'Bol kar likhna chalu karein (online AI ki ijazat)')}
              </button>
            )}
            {status.data && !status.data.cloud_available && (
              <p className="flex gap-2 p-3 rounded-xl bg-ink/[0.05] text-sm text-ink-soft">
                <Info className="w-5 h-5 shrink-0" />
                {pick('No online AI is set up, so speech cannot be understood here. Type it below; HisaabAI understands typed Roman Urdu offline.', 'Online AI set nahi, is liye awaaz yahan samajh nahi aaye gi. Neeche likh dein; HisaabAI likhi hui Roman Urdu offline samajhta hai.')}
              </p>
            )}

            {stage === 'thinking' ? (
              <div className="flex flex-col items-center gap-4 py-8" aria-live="polite">
                <div className="flex gap-2" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <motion.span key={i} className="w-3 h-3 rounded-full bg-sabz" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
                  ))}
                </div>
                <p className="text-lg font-bold">{pick('Understanding...', 'Samajh raha hoon...')}</p>
              </div>
            ) : (
              cloudReady && (
                <MicButton state={rec.state} level={rec.level} elapsed={rec.elapsed} maxSeconds={status.data?.max_seconds ?? 30} onStart={() => { rec.clearProblem(); void rec.start(); }} onStop={finish} />
              )
            )}
            {rec.problem && <MicHelp problem={rec.problem} />}
            {understand.isError && <ErrorBox error={understand.error} />}

            {stage === 'listen' && (
              <>
                {cloudReady && !showTyping && !rec.problem ? (
                  <button type="button" onClick={() => { rec.cancel(); setShowTyping(true); }} className="mx-auto flex items-center gap-2 min-h-[44px] px-3 rounded-xl text-ink-soft font-bold hover:bg-ink/5">
                    <Keyboard className="w-5 h-5" />
                    {pick('Or type it', 'Ya likh kar batayein')}
                  </button>
                ) : (
                  <form onSubmit={sendTyped} className="space-y-2">
                    <label htmlFor="voice-text" className="block text-lg font-bold">{pick('Type what happened', 'Likh kar batayein kya hua')}</label>
                    <div className="flex gap-2">
                      <input id="voice-text" value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={300} autoFocus={!cloudReady || showTyping} placeholder="Ali Butt 5000 udhaar le gaya" className="min-w-0 flex-1 min-h-[52px] px-4 rounded-2xl border-2 border-line bg-card outline-none focus:border-sabz text-lg" />
                      <Button type="submit" size="lg" disabled={typed.trim().length < 3} aria-label={pick('Understand', 'Samjho')} icon={<Send className="w-5 h-5" />} />
                    </div>
                  </form>
                )}
                <div className="space-y-2">
                  <p className="text-sm font-bold text-ink-muted">{pick('You can say things like:', 'Aap aise bol sakte hain:')}</p>
                  <ul className="space-y-2">
                    {EXAMPLES.map((ex) => (
                      <li key={ex.roman} className="parchi rounded-xl border border-line pl-14 pr-4 py-2">
                        <span className="block font-urdu text-lg leading-[2.2]" dir="rtl" lang="ur">{ex.ur}</span>
                        <span className="block text-sm text-ink-soft">“{ex.roman}”</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {speakable && (
                  <button type="button" onClick={toggleReadback} aria-pressed={readback} className="flex items-center gap-2 min-h-[44px] px-3 rounded-xl text-sm font-bold text-ink-soft hover:bg-ink/5">
                    {readback ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                    {readback ? pick('HisaabAI reads it back to you', 'HisaabAI sun kar dohraye ga') : pick('Read-back is off', 'Dohrana band hai')}
                  </button>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}

export default VoiceSheet;
