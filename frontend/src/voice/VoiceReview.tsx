import { Banknote, Ear, Package, UserPlus, Users } from 'lucide-react';
import { useCreditCheck } from '@/api/queries';
import type { CustomerItem, ExpenseCategory, PaymentMethod, VoiceConfirm, VoiceIntent, VoiceProposal } from '@/api/types';
import { KINDS } from '@/components/day/ExpenseSheet';
import { CreditVerdict } from '@/components/khata/CreditVerdict';
import { CustomerPicker, initials } from '@/components/khata/CustomerPicker';
import { Button } from '@/components/ui/Button';
import { AmountInput, MethodPicker, readAmount } from '@/components/ui/Fields';
import { Segmented } from '@/components/ui/Segmented';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn, formatDate, formatPKR } from '@/lib/format';
import { useDebounced } from '@/lib/useDebounced';
import type { EntryDraft } from './sentence';
import { VoiceItems, itemProblems, itemWords, itemsFromProposal, itemsTotal, type ReviewItem } from './VoiceItems';

export interface ReviewState {
  intent: VoiceIntent | null;
  /** Udhaar with items: the amount besides the items. Otherwise the amount. */
  amountText: string;
  items: ReviewItem[];
  customer: CustomerItem | null;
  newName: string;
  picking: boolean;
  cash: boolean;
  method: PaymentMethod;
  category: ExpenseCategory | null;
  reason: string;
  daysAgo: number;
  due: string;
  // From the proposal, to keep the Urdu spelling only while it still applies.
  spokenName: string | null;
  spokenNameUrdu: string | null;
  matchId: number | null;
  heardReason: string | null;
  heardReasonUrdu: string | null;
  cashInGalla: number;
}

function isoDay(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}

export function draftFromProposal(p: VoiceProposal): ReviewState {
  const match = p.person.match ?? null;
  const items = p.intent === 'udhaar' ? itemsFromProposal(p.items ?? []) : [];
  const amount = items.length ? p.extra_amount_pkr : p.amount_pkr;
  return {
    intent: p.intent && p.intent !== 'question' ? p.intent : null,
    amountText: amount ? String(Math.round(amount)) : '',
    items,
    customer: match,
    newName: match ? '' : p.person.spoken_name ?? '',
    picking: false,
    cash: p.cash_from_galla,
    method: p.method,
    category: p.expense_category ?? null,
    reason: p.reason ?? '',
    daysAgo: p.days_ago,
    due: isoDay(p.due_date),
    spokenName: p.person.spoken_name ?? null,
    spokenNameUrdu: p.person.spoken_name_urdu ?? null,
    matchId: match?.customer_id ?? null,
    heardReason: p.reason ?? null,
    heardReasonUrdu: p.reason_urdu ?? null,
    cashInGalla: p.cash_in_galla_pkr,
  };
}

export function toDraft(r: ReviewState): EntryDraft {
  const name = r.customer ? r.customer.name.replace(/\s*\(.*?\)/g, '') : r.newName.trim() || null;
  const sameAsSpoken = r.customer ? r.customer.customer_id === r.matchId : r.newName.trim() === (r.spokenName ?? '').trim();
  const goods = r.intent === 'udhaar' ? r.items : [];
  return {
    intent: r.intent ?? 'udhaar',
    amount: readAmount(r.amountText),
    items: goods.flatMap((i) => itemWords(i) ?? []),
    itemsTotal: itemsTotal(goods),
    pending: goods.filter((i) => !i.product).length,
    name,
    nameUrdu: sameAsSpoken ? r.spokenNameUrdu : null,
    cash: r.cash,
    method: r.method,
    category: r.category,
    reason: r.reason.trim() || null,
    reasonUrdu: r.reason.trim() === (r.heardReason ?? '').trim() ? r.heardReasonUrdu : null,
    daysAgo: r.daysAgo,
  };
}

/** What is still needed before saving, in the shopkeeper's words. Empty = ready. */
export function problems(r: ReviewState): { en: string; ur: string }[] {
  const out: { en: string; ur: string }[] = [];
  const amount = readAmount(r.amountText);
  if (!r.intent) out.push({ en: 'Choose what to write: udhaar, wasooli or kharcha.', ur: 'Chunein kya likhna hai: udhaar, wasooli ya kharcha.' });
  const withItems = r.intent === 'udhaar' && r.items.length > 0;
  if (amount <= 0 && !withItems) out.push({ en: 'Write the amount.', ur: 'Raqam likhein.' });
  if (withItems) out.push(...itemProblems(r.items));
  if (r.intent === 'udhaar' && !r.customer && r.newName.trim().length < 2) out.push({ en: 'Choose the customer.', ur: 'Customer chunein.' });
  if (r.intent === 'wasooli' && !r.customer) out.push({ en: 'Choose who paid.', ur: 'Chunein kis ne diye.' });
  if (r.intent === 'wasooli' && r.customer && amount > r.customer.balance_pkr + 0.01)
    out.push({ en: `${r.customer.name} only owes ${formatPKR(r.customer.balance_pkr)}.`, ur: `${r.customer.name} ka khata sirf ${formatPKR(r.customer.balance_pkr)} hai.` });
  if (r.intent === 'kharcha' && !r.category) out.push({ en: 'Choose what the kharcha was for.', ur: 'Chunein kharcha kis cheez ka tha.' });
  const fromGalla = r.intent === 'kharcha' || (r.intent === 'udhaar' && r.cash);
  if (fromGalla && amount > r.cashInGalla + 0.01) out.push({ en: `Only ${formatPKR(r.cashInGalla)} is in the cash box.`, ur: `Cash box mein sirf ${formatPKR(r.cashInGalla)} hain.` });
  return out;
}

export function toConfirm(r: ReviewState): VoiceConfirm | null {
  if (problems(r).length || !r.intent) return null;
  return {
    intent: r.intent,
    amount: readAmount(r.amountText),
    items: r.intent === 'udhaar' ? r.items.flatMap((i) => (i.product ? [{ product_id: i.product.product_id, qty: i.qty }] : [])) : [],
    customer_id: r.intent !== 'kharcha' ? r.customer?.customer_id ?? null : null,
    new_customer_name: r.intent === 'udhaar' && !r.customer ? r.newName.trim() : null,
    cash_from_galla: r.cash,
    method: r.method,
    expense_category: r.intent === 'kharcha' ? r.category : null,
    reason: r.reason.trim() || null,
    days_ago: r.daysAgo,
    due_date: r.intent === 'udhaar' && r.due ? r.due : null,
  };
}

function Heard({ p, audioUrl }: { p: VoiceProposal; audioUrl: string | null }) {
  const { pick } = useLanguage();
  const by = p.provider === 'gemini' ? 'Gemini' : p.provider === 'groq' ? 'Groq (Whisper)' : pick('offline rules', 'offline qawaid');
  if (!p.transcript_urdu && !p.transcript_roman && !audioUrl) return null;
  return (
    <div className="p-4 rounded-2xl bg-ink/[0.04] space-y-2">
      <p className="flex items-center gap-2 text-sm font-bold text-ink-muted">
        <Ear className="w-4 h-4" />
        {pick(`What was heard (understood by ${by})`, `Kya suna (${by} ne samjha)`)}
      </p>
      {p.transcript_urdu && <p className="font-urdu text-xl leading-[2.3]" dir="rtl" lang="ur">{p.transcript_urdu}</p>}
      {p.transcript_roman && <p className="text-base text-ink-soft">“{p.transcript_roman}”</p>}
      {audioUrl && <audio controls preload="none" src={audioUrl} className="w-full h-10" aria-label={pick('Your recording', 'Aap ki recording')} />}
      {p.notes.map((n) => (
        <p key={n.en} className="text-sm text-ink-soft border-l-4 border-haldi pl-3">{pick(n.en, n.ur)}</p>
      ))}
    </div>
  );
}

function Person({ p, r, set }: { p: VoiceProposal; r: ReviewState; set: (patch: Partial<ReviewState>) => void }) {
  const { pick } = useLanguage();
  const wasooli = r.intent === 'wasooli';
  if (r.picking) {
    return (
      <div className="space-y-2">
        <CustomerPicker onlyWithBalance={wasooli} allowNew={!wasooli} onPick={(c) => set({ customer: c, picking: false })} />
        <Button variant="ghost" onClick={() => set({ picking: false })}>{pick('Back', 'Wapas')}</Button>
      </div>
    );
  }
  if (r.customer) {
    const c = r.customer;
    return (
      <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-line">
        <span className="w-11 h-11 rounded-full bg-sabz-tint text-sabz-dark flex items-center justify-center font-extrabold shrink-0" aria-hidden>{initials(c.name)}</span>
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-snug">{c.name}</p>
          <p className="text-sm text-ink-muted">{pick(`Khata now ${formatPKR(c.balance_pkr)}`, `Khata abhi ${formatPKR(c.balance_pkr)}`)}</p>
        </div>
        <button type="button" onClick={() => set({ customer: null, picking: !p.person.spoken_name, newName: wasooli ? '' : r.newName || p.person.spoken_name || '' })} className="min-h-[44px] px-3 rounded-xl text-sm font-bold text-ink-muted hover:bg-ink/5">
          {pick('Change', 'Badlein')}
        </button>
      </div>
    );
  }
  const others = p.person.candidates.filter((c) => !wasooli || c.balance_pkr > 0);
  return (
    <div className="space-y-3">
      {!wasooli && (
        <div className="p-3 rounded-2xl border-2 border-dashed border-sabz-mid space-y-2">
          <label htmlFor="voice-new-name" className="flex items-center gap-2 font-bold text-sabz-dark">
            <UserPlus className="w-5 h-5" />
            {pick('New khata for', 'Naya khata')}
          </label>
          <input id="voice-new-name" value={r.newName} onChange={(e) => set({ newName: e.target.value })} maxLength={120} placeholder={pick('Customer name', 'Customer ka naam')} className="w-full min-h-[48px] px-4 rounded-xl border-2 border-line bg-card outline-none focus:border-sabz text-lg" />
          <p className="text-sm text-ink-muted">{pick('No khata with this name yet. Saving opens one.', 'Is naam ka khata nahi mila. Save karne par naya khul jaye ga.')}</p>
        </div>
      )}
      {others.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-bold text-ink-muted">{pick('Or is it one of these?', 'Ya in mein se koi hai?')}</p>
          <ul className="bg-card rounded-2xl border border-line divide-y divide-line overflow-hidden">
            {others.map((c) => (
              <li key={c.customer_id}>
                <button type="button" onClick={() => set({ customer: c })} className="w-full flex items-center gap-3 p-3 text-left hover:bg-paper min-h-[56px]">
                  <span className="w-10 h-10 rounded-full bg-ink/[0.06] flex items-center justify-center font-extrabold shrink-0" aria-hidden>{initials(c.name)}</span>
                  <span className="flex-1 font-bold">{c.name}</span>
                  <span className="tabular font-bold text-ink-soft">{formatPKR(c.balance_pkr)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Button variant="secondary" onClick={() => set({ picking: true })} icon={<Users className="w-5 h-5" />}>
        {pick('Choose from all khatas', 'Tamam khaton se chunein')}
      </Button>
    </div>
  );
}

function Verdict({ r }: { r: ReviewState }) {
  const amount = Math.round(readAmount(r.amountText) + (r.intent === 'udhaar' ? itemsTotal(r.items) : 0));
  const debounced = useDebounced(amount, 350);
  const check = useCreditCheck(r.intent === 'udhaar' && r.customer ? r.customer.customer_id : null, debounced);
  if (!check.data || amount <= 0 || r.intent !== 'udhaar' || !r.customer) return null;
  return <CreditVerdict check={check.data} stale={check.isFetching || debounced !== amount} />;
}

export function VoiceReview({ proposal: p, state: r, onChange, audioUrl }: { proposal: VoiceProposal; state: ReviewState; onChange: (r: ReviewState) => void; audioUrl: string | null }) {
  const { pick } = useLanguage();
  const set = (patch: Partial<ReviewState>) => onChange({ ...r, ...patch });
  const issues = problems(r);
  const usualDue = isoDay(p.usual_due_date);

  return (
    <div className="space-y-6">
      <Heard p={p} audioUrl={audioUrl} />

      <div className="space-y-2">
        <p className="text-lg font-bold">{pick('What is it?', 'Kya likhna hai?')}</p>
        <Segmented<VoiceIntent | 'none'>
          value={r.intent ?? 'none'}
          onChange={(v) => v !== 'none' && set({ intent: v, picking: false })}
          label={pick('What is it?', 'Kya likhna hai?')}
          options={[
            { value: 'udhaar', label: 'Udhaar' },
            { value: 'wasooli', label: 'Wasooli' },
            { value: 'kharcha', label: 'Kharcha' },
          ]}
        />
      </div>

      {(r.intent === 'udhaar' || r.intent === 'wasooli') && (
        <div className="space-y-2">
          <p className="text-lg font-bold">{r.intent === 'udhaar' ? pick('Who took it?', 'Kis ne liya?') : pick('Who paid?', 'Kis ne diya?')}</p>
          <Person p={p} r={r} set={set} />
        </div>
      )}

      {r.intent === 'udhaar' && (
        <div className="space-y-2">
          <p className="text-lg font-bold">{pick('What did they take?', 'Kya liya?')}</p>
          <VoiceItems items={r.items} onChange={(items) => set({ items })} />
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="voice-amount" className="block text-lg font-bold">
          {r.intent === 'udhaar' && r.items.length ? pick('Any money besides the items? (optional)', 'Items ke ilawa koi raqam? (marzi se)') : pick('How much?', 'Kitne?')}
        </label>
        <AmountInput id="voice-amount" value={r.amountText} onChange={(v) => set({ amountText: v })} invalid={!!r.amountText && issues.some((i) => i.en.includes('cash box') || i.en.includes('owes'))} />
        {p.amount_heard && <p className="text-sm text-ink-muted">{pick(`Heard: “${p.amount_heard}”`, `Suna: “${p.amount_heard}”`)}</p>}
      </div>

      {r.intent === 'udhaar' && (
        <>
          {(readAmount(r.amountText) > 0 || !r.items.length) && (
          <div className="space-y-2">
            <p className="text-lg font-bold">{r.items.length ? pick('Was this money cash?', 'Yeh raqam cash di?') : pick('Cash or goods?', 'Naqad ya saamaan?')}</p>
            <div role="radiogroup" aria-label={pick('Cash or goods?', 'Naqad ya saamaan?')} className="grid grid-cols-2 gap-2">
              {[
                { v: true, icon: <Banknote className="w-6 h-6" />, en: 'Cash from the cash box', ur: 'Cash box se cash diya' },
                { v: false, icon: <Package className="w-6 h-6" />, en: 'Goods on credit', ur: 'Saamaan diya' },
              ].map((o) => (
                <button key={String(o.v)} type="button" role="radio" aria-checked={r.cash === o.v} onClick={() => set({ cash: o.v })} className={cn('min-h-[64px] px-3 rounded-2xl border-2 font-bold flex items-center gap-2 text-left', r.cash === o.v ? 'bg-sabz-tint border-sabz text-sabz-dark' : 'bg-card border-line text-ink-soft hover:border-ink-muted')}>
                  {o.icon}
                  <span className="leading-tight">{pick(o.en, o.ur)}</span>
                </button>
              ))}
            </div>
            <p className="text-sm text-ink-muted">
              {r.cash ? pick('The cash box goes down by this amount.', 'Cash box se itne kam ho jayen ge.') : pick('The cash box does not change. Add items above to take them out of stock.', 'Cash box nahi badle ga. Stock se items nikalne ke liye upar items daalein.')}
              {!p.cash_from_galla_heard && ' ' + pick('(Not said; please check.)', '(Yeh nahi suna, check kar lein.)')}
            </p>
          </div>
          )}
          <div className="space-y-1">
            <label htmlFor="voice-due" className="block text-lg font-bold">{pick('Pay back by', 'Wapsi kab tak')}</label>
            <input id="voice-due" type="date" value={r.due || usualDue} onChange={(e) => set({ due: e.target.value })} className="min-h-[48px] px-4 rounded-xl border-2 border-line bg-card outline-none focus:border-sabz text-lg" />
            <p className="text-sm text-ink-muted">{r.due ? (p.due_date && r.due === isoDay(p.due_date) ? pick('As promised in the recording.', 'Jaisa recording mein kaha.') : '') : pick(`The shop's usual time: ${formatDate(p.usual_due_date)}.`, `Dukaan ka mamool: ${formatDate(p.usual_due_date)}.`)}</p>
          </div>
        </>
      )}

      {r.intent === 'wasooli' && <MethodPicker value={r.method} onChange={(m) => set({ method: m })} direction="in" />}

      {r.intent === 'kharcha' && (
        <div className="space-y-2">
          <p className="text-lg font-bold">{pick('What was it for?', 'Kis cheez ka?')}</p>
          <div role="radiogroup" aria-label={pick('What was it for?', 'Kis cheez ka?')} className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {KINDS.map((k) => (
              <button type="button" key={k.value} role="radio" aria-checked={r.category === k.value} onClick={() => set({ category: k.value })} className={cn('min-h-[56px] px-3 rounded-2xl border-2 font-bold flex items-center gap-2 text-left', r.category === k.value ? 'bg-sabz-tint border-sabz text-sabz-dark' : 'bg-card border-line text-ink-soft hover:border-ink-muted')}>
                {k.icon}
                <span className="leading-tight">{pick(k.en, k.ur)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {r.intent && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="voice-reason" className="block font-bold">{r.intent === 'kharcha' ? pick('Note (optional)', 'Note (marzi se)') : pick('What for? (optional)', 'Kis liye? (marzi se)')}</label>
            <input id="voice-reason" value={r.reason} onChange={(e) => set({ reason: e.target.value })} maxLength={100} className="w-full min-h-[48px] px-4 rounded-xl border-2 border-line bg-card outline-none focus:border-sabz" />
          </div>
          <div className="space-y-1">
            <p className="font-bold">{pick('When?', 'Kab?')}</p>
            <Segmented<number>
              value={Math.min(r.daysAgo, 2)}
              onChange={(v) => set({ daysAgo: v })}
              label={pick('When?', 'Kab?')}
              options={[
                { value: 0, label: pick('Today', 'Aaj') },
                { value: 1, label: pick('Yesterday', 'Kal') },
                { value: 2, label: pick('Day before', 'Parson') },
              ]}
            />
          </div>
        </div>
      )}

      <Verdict r={r} />

      {issues.length > 0 && (
        <ul className="space-y-1" aria-live="polite">
          {issues.map((i) => (
            <li key={i.en} className="text-sm font-bold text-lal-dark">{pick(i.en, i.ur)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
