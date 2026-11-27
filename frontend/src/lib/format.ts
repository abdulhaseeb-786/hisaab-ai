/** Number and date formatting for the app. Money is always "Rs 12,500". */

const pkr = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 });
const num1 = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 1 });

export function formatPKR(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const sign = value < 0 ? '−' : '';
  return `${sign}Rs ${pkr.format(Math.abs(value))}`;
}

/** Short money for tight spaces: PKR 1.6M, PKR 393K. */
export function formatPKRShort(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}Rs ${num1.format(abs / 1_000_000)}M`;
  if (abs >= 10_000) return `${sign}Rs ${pkr.format(abs / 1_000)}K`;
  return `${sign}Rs ${pkr.format(abs)}`;
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-PK', { maximumFractionDigits: digits }).format(value);
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${formatNumber(value, digits)}%`;
}

export function formatChange(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value), 1)}%`;
}

/** Dates from the API are store-local ISO strings without a timezone. */
export function parseApiDate(value: string): Date {
  const [d, t = '00:00:00'] = value.split('T');
  const [y, m, day] = (d ?? '').split('-').map(Number);
  const [hh, mm, ss] = t.split(':').map((x) => Number.parseFloat(x));
  return new Date(y ?? 1970, (m ?? 1) - 1, day ?? 1, hh ?? 0, mm ?? 0, ss ?? 0);
}

export function formatDate(value: string | null | undefined, withYear = false): string {
  if (!value) return '—';
  return parseApiDate(value).toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

export function formatWeekday(value: string): string {
  return parseApiDate(value).toLocaleDateString('en-PK', { weekday: 'short' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return parseApiDate(value).toLocaleString('en-PK', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
