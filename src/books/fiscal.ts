// Copied from the web app (src/lib/fiscal.ts) by scripts/sync-books.mjs — edit it there, not here.
import { loadProfile } from "@/books/eis";

/*
 * The company's accounting period — a calendar year (January to December) or
 * a fiscal year ending on the last day of any other month. Everything that
 * says "year" (year-to-date, last year, quarters, the income tax return)
 * asks here rather than assuming January.
 *
 * A fiscal year is named by the calendar year it ENDS in, the way the BIR and
 * PFRS statements label it: the year July 2025 – June 2026 is FY 2026.
 */

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate();

/** Month (1–12) the accounting year ends in — 12 for a calendar year. */
export function yearEndMonth(): number {
  const p = loadProfile();
  if (p.accountingPeriod !== "fiscal") return 12;
  const m = Math.round(Number(p.fiscalYearEndMonth));
  return m >= 1 && m <= 12 ? m : 12;
}

/** Month (1–12) the accounting year starts in. */
export const yearStartMonth = () => (yearEndMonth() % 12) + 1;

/** True when the year does not run January to December. */
export const isFiscalYear = () => yearEndMonth() !== 12;

/** The fiscal year (named by the year it ends in) that a date falls in. */
export function fiscalYearOf(date: string): number {
  const [y, m] = date.split("-").map(Number);
  const end = yearEndMonth();
  return end === 12 || m <= end ? y : y + 1;
}

/** First and last day of a fiscal year. */
export function fiscalYearRange(fy: number): { from: string; to: string } {
  const end = yearEndMonth();
  const start = (end % 12) + 1;
  return { from: iso(end === 12 ? fy : fy - 1, start, 1), to: iso(fy, end, lastDay(fy, end)) };
}

/** First and last day of quarter 1–4 of a fiscal year. */
export function fiscalQuarterRange(fy: number, q: number): { from: string; to: string } {
  const { from } = fiscalYearRange(fy);
  const [sy, sm] = from.split("-").map(Number);
  const at = (offset: number) => {
    const idx = sm - 1 + offset;
    return { y: sy + Math.floor(idx / 12), m: (idx % 12) + 1 };
  };
  const a = at((q - 1) * 3);
  const b = at((q - 1) * 3 + 2);
  return { from: iso(a.y, a.m, 1), to: iso(b.y, b.m, lastDay(b.y, b.m)) };
}

/** The fiscal year and quarter (1–4) a date falls in. */
export function fiscalQuarterOf(date: string): { fy: number; q: number } {
  const m = Number(date.slice(5, 7));
  const q = Math.floor(((m - yearStartMonth() + 12) % 12) / 3) + 1;
  return { fy: fiscalYearOf(date), q };
}

/** "January – December" or e.g. "July – June", for labels and hints. */
export const yearSpanLabel = () => `${MONTH_NAMES[yearStartMonth() - 1]} – ${MONTH_NAMES[yearEndMonth() - 1]}`;

/** Short quarter label: "Q3 2026" on a calendar year, "Q3 FY2026" on a fiscal one. */
export const quarterLabel = (fy: number, q: number) => (isFiscalYear() ? `Q${q} FY${fy}` : `Q${q} ${fy}`);
