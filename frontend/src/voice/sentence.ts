import type { ExpenseCategory, PaymentMethod, VoiceIntent } from '@/api/types';
import { formatNumber, formatPKR } from '@/lib/format';

/** One entry, said back in Urdu script, Roman Urdu and English. */
export interface Sentence {
  urdu: string;
  roman: string;
  english: string;
}

/** One item as it will be read back: the heard words while unchanged, else quantity + name. */
export interface ItemWords {
  roman: string;
  urdu: string | null;
  english: string;
}

export interface EntryDraft {
  intent: VoiceIntent;
  /** Udhaar with items: the amount besides the items (cash or other). Otherwise the amount. */
  amount: number;
  items: ItemWords[];
  itemsTotal: number;
  /** Items heard but not yet matched to a product: the sentence says so instead of a false total. */
  pending: number;
  name: string | null;
  nameUrdu: string | null;
  cash: boolean;
  method: PaymentMethod;
  category: ExpenseCategory | null;
  reason: string | null;
  reasonUrdu: string | null;
  daysAgo: number;
}

const METHOD: Record<PaymentMethod, { ur: string; roman: string; en: string }> = {
  cash: { ur: 'نقد', roman: 'cash', en: 'cash' },
  easypaisa: { ur: 'ایزی پیسہ', roman: 'Easypaisa', en: 'Easypaisa' },
  jazzcash: { ur: 'جاز کیش', roman: 'JazzCash', en: 'JazzCash' },
  bank: { ur: 'بینک', roman: 'bank', en: 'bank transfer' },
};

export const CATEGORY_TEXT: Record<ExpenseCategory, { ur: string; roman: string; en: string }> = {
  electricity: { ur: 'بجلی کا بل', roman: 'Bijli ka bill', en: 'Electricity' },
  rent: { ur: 'دکان کا کرایہ', roman: 'Dukaan ka kiraya', en: 'Rent' },
  salaries: { ur: 'تنخواہ', roman: 'Tankhwah', en: 'Salary' },
  transport: { ur: 'رکشہ / بھاڑا', roman: 'Rickshaw / bhaara', en: 'Transport' },
  general: { ur: 'دوسرا خرچہ', roman: 'Doosra kharcha', en: 'Other kharcha' },
  owner_drawings: { ur: 'گھر کا خرچ', roman: 'Ghar ka kharch', en: 'Taken home' },
  bank_deposit: { ur: 'بینک میں جمع', roman: 'Bank mein jama', en: 'Banked' },
};

const DAY = [
  { ur: 'آج', roman: 'Aaj', en: 'Today' },
  { ur: 'کل', roman: 'Kal', en: 'Yesterday' },
  { ur: 'پرسوں', roman: 'Parson', en: 'The day before yesterday' },
];

function day(n: number) {
  return DAY[n] ?? { ur: `${n} دن پہلے`, roman: `${n} din pehle`, en: `${n} days ago` };
}

/** "beti ki fees ke liye" -> "beti ki fees": the sentence adds "ke liye" itself. */
function bare(reason: string | null): string | null {
  const t = reason?.replace(/\s*(ke|kay|ki|k)\s*(liye|lie)\s*$/i, '').replace(/\s*(کے|کی)\s*(لیے|لئے)\s*$/, '').replace(/^for\s+/i, '').trim();
  return t || null;
}

export function sentence(d: EntryDraft): Sentence {
  const rs = formatPKR(d.amount);
  const urAmount = `${formatNumber(d.amount)} روپے`;
  const when = day(d.daysAgo);
  const who = d.name || 'Customer';
  const whoUr = d.nameUrdu || d.name || 'گاہک';
  if (d.intent === 'udhaar') {
    d = { ...d, reason: bare(d.reason), reasonUrdu: bare(d.reasonUrdu) };
    const forUr = d.reasonUrdu ? `، ${d.reasonUrdu} کے لیے` : d.reason ? `، ${d.reason} کے لیے` : '';
    const forRoman = d.reason ? `, ${d.reason} ke liye` : '';
    const forEn = d.reason ? `, for ${d.reason}` : '';
    if (d.items.length || d.pending) {
      const total = d.itemsTotal + d.amount;
      const listUr = d.items.map((i) => i.urdu ?? i.roman).join('، ');
      const listRoman = d.items.map((i) => i.roman).join(', ');
      const listEn = d.items.map((i) => i.english).join(', ');
      const cashUr = d.amount > 0 ? (d.cash ? ` اور ${urAmount} نقد` : ` اور ${urAmount}`) : '';
      const cashRoman = d.amount > 0 ? (d.cash ? ` aur ${rs} naqad` : ` aur ${rs}`) : '';
      const cashEn = d.amount > 0 ? (d.cash ? ` and ${rs} in cash` : ` and ${rs}`) : '';
      if (d.pending > 0) {
        return {
          urdu: `${when.ur} ${whoUr} نے ادھار پر لیا: ${listUr}${cashUr}${forUr}، اور ${formatNumber(d.pending)} چیز ابھی چننی ہے۔`,
          roman: `${when.roman} ${who} ne udhaar par liya: ${listRoman}${cashRoman}${forRoman}, aur ${d.pending} item abhi chunna hai.`,
          english: `${when.en} ${who} took on udhaar: ${listEn}${cashEn}${forEn}, and ${d.pending} item still to choose.`,
        };
      }
      return {
        urdu: `${when.ur} ${whoUr} نے ادھار پر لیا: ${listUr}${cashUr}${forUr}۔ کل ${formatNumber(total)} روپے۔`,
        roman: `${when.roman} ${who} ne udhaar par liya: ${listRoman}${cashRoman}${forRoman}. Kul ${formatPKR(total)}.`,
        english: `${when.en} ${who} took on udhaar: ${listEn}${cashEn}${forEn}. Total ${formatPKR(total)}.`,
      };
    }
    return d.cash
      ? {
          urdu: `${when.ur} ${whoUr} نے ${urAmount} نقد ادھار لیے${forUr}۔`,
          roman: `${when.roman} ${who} ne ${rs} naqad udhaar liye${forRoman}.`,
          english: `${when.en} ${who} took ${rs} in cash on udhaar${forEn}.`,
        }
      : {
          urdu: `${when.ur} ${whoUr} نے ${urAmount} کا سامان ادھار لیا${forUr}۔`,
          roman: `${when.roman} ${who} ne ${rs} ka saamaan udhaar liya${forRoman}.`,
          english: `${when.en} ${who} took goods worth ${rs} on udhaar${forEn}.`,
        };
  }
  if (d.intent === 'wasooli') {
    const m = METHOD[d.method];
    return {
      urdu: `${when.ur} ${whoUr} نے ${urAmount} واپس دیے، ${m.ur}۔`,
      roman: `${when.roman} ${who} ne ${rs} wapas diye, ${m.roman}.`,
      english: `${when.en} ${who} paid back ${rs} by ${m.en}.`,
    };
  }
  const c = CATEGORY_TEXT[d.category ?? 'general'];
  return {
    urdu: `${when.ur} ${c.ur}: ${urAmount} کیش باکس سے۔`,
    roman: `${when.roman} ${c.roman}: ${rs} cash box se.`,
    english: `${when.en} ${c.en}: ${rs} from the cash box.`,
  };
}
