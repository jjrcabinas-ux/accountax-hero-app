/** Peso formatting without relying on Intl (consistent on Hermes and web). */
export function peso(amount: number, opts: { decimals?: boolean; sign?: boolean } = {}): string {
  const { decimals = true, sign = false } = opts;
  const neg = amount < 0;
  const abs = Math.abs(amount);
  const fixed = decimals ? abs.toFixed(2) : Math.round(abs).toString();
  const [whole, cents] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = `₱${grouped}${cents ? `.${cents}` : ''}`;
  if (neg) return `(${body})`;
  return sign && amount > 0 ? `+${body}` : body;
}

/** Compact peso for tiles: ₱1.24M, ₱86.4K. */
export function pesoShort(amount: number): string {
  const abs = Math.abs(amount);
  const neg = amount < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${neg}₱${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${neg}₱${(abs / 1_000).toFixed(1)}K`;
  return `${neg}${peso(abs, { decimals: false })}`;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-11-07' → 'Nov 7, 2026' */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** '2026-11-07' → 'Nov 7' */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

export function todayIso(): string {
  const t = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00`);
  const b = Date.parse(`${toIso}T00:00:00`);
  return Math.round((b - a) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const t = new Date(Date.parse(`${iso}T00:00:00`) + days * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}
