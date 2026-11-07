// Copied from the web app (src/lib/compliance.ts) by scripts/sync-books.mjs — edit it there, not here.
import { fiscalQuarterOf, fiscalQuarterRange, fiscalYearRange, isFiscalYear, quarterLabel } from "@/books/fiscal";

/*
 * BIR filing calendar, derived from statutory rules rather than stored data —
 * the app doesn't track what has actually been filed yet, so this lists the
 * next occurrence of each recurring obligation from today forward. Dates
 * follow the EOPT-era schedule:
 *   - 0619-E monthly EWT remittance: 10th of the following month, for the
 *     first two months of each calendar quarter only
 *   - 1601-EQ quarterly EWT: last day of the month after the calendar quarter
 *   - 2550Q quarterly VAT: 25 days after the close of the taxable quarter
 *   - 1702Q quarterly income tax: 60 days after the close of quarters 1–3
 *   - 1702 annual income tax: 15th day of the fourth month after year-end
 *
 * Withholding runs on calendar months and quarters whatever the books use;
 * VAT and income tax follow the accounting period (Settings › Accounting).
 */

export type Deadline = {
  key: string;
  label: string;
  cadence: string;
  date: string; // yyyy-mm-dd
  daysLeft: number;
};

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const daysBetween = (fromIso: string, toIso: string) =>
  Math.round((new Date(toIso + "T00:00:00").getTime() - new Date(fromIso + "T00:00:00").getTime()) / 86_400_000);

/** Add whole months to a (year, month) pair; month is 1-based. */
const addMonths = (y: number, m: number, n: number): [number, number] => {
  const t = y * 12 + (m - 1) + n;
  return [Math.floor(t / 12), (t % 12) + 1];
};

const lastDayOf = (y: number, m: number) => new Date(y, m, 0).getDate();

/** A date plus n days (local time). */
const plusDays = (date: string, n: number) => {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return iso(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
};

/** Fiscal quarters starting one before today's, in order — the previous quarter's deadline can still be ahead. */
function quartersFrom(todayIso: string, count: number): { fy: number; q: number }[] {
  const cur = fiscalQuarterOf(todayIso);
  let { fy, q } = cur.q === 1 ? { fy: cur.fy - 1, q: 4 } : { fy: cur.fy, q: cur.q - 1 };
  const out: { fy: number; q: number }[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ fy, q });
    if (q === 4) { fy++; q = 1; } else q++;
  }
  return out;
}

/** The next few statutory deadlines on or after `todayIso`, soonest first. */
export function nextDeadlines(todayIso: string): Deadline[] {
  const [y, m] = todayIso.split("-").map(Number);
  const out: Deadline[] = [];
  const push = (key: string, label: string, cadence: string, date: string) =>
    out.push({ key, label, cadence, date, daysLeft: daysBetween(todayIso, date) });

  // Withholding (calendar). Months 1 and 2 of a quarter: 0619-E by the 10th
  // of the next month. Month 3: no 0619-E — the 1601-EQ covers the quarter,
  // due on the last day of the following month.
  let monthly = "";
  let quarterly = "";
  for (let i = -1; i < 4 && (!monthly || !quarterly); i++) {
    const [wy, wm] = addMonths(y, m, i); // the month tax was withheld in
    const [ny, nm] = addMonths(wy, wm, 1);
    if (wm % 3 !== 0) {
      const due = iso(ny, nm, 10);
      if (!monthly && due >= todayIso) monthly = due;
    } else {
      const due = iso(ny, nm, lastDayOf(ny, nm));
      if (!quarterly && due >= todayIso) quarterly = due;
    }
  }
  if (monthly) push("ewt", "Withholding Tax (0619-E)", "Monthly", monthly);
  if (quarterly) push("ewt-q", "Withholding Tax (1601-EQ)", "Quarterly", quarterly);

  // 2550Q: 25 days after the taxable quarter closes.
  for (const { fy, q } of quartersFrom(todayIso, 6)) {
    const due = plusDays(fiscalQuarterRange(fy, q).to, 25);
    if (due >= todayIso) {
      push("vat", "VAT Return (2550Q)", "Quarterly", due);
      break;
    }
  }

  // Income tax: quarters 1–3 file a 1702Q 60 days after the quarter; the
  // fourth quarter is the annual 1702, due the 15th of the fourth month after
  // year-end.
  for (const { fy, q } of quartersFrom(todayIso, 6)) {
    if (q < 4) {
      const due = plusDays(fiscalQuarterRange(fy, q).to, 60);
      if (due >= todayIso) {
        push("itr", "Income Tax Return (1702Q)", "Quarterly", due);
        break;
      }
    } else {
      const [ey, em] = fiscalYearRange(fy).to.split("-").map(Number);
      const [dy, dm] = addMonths(ey, em, 4);
      const due = iso(dy, dm, 15);
      if (due >= todayIso) {
        push("itr", `Annual Income Tax (1702)${isFiscalYear() ? ` · FY${fy}` : ""}`, "Annual", due);
        break;
      }
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/* ---- Calendar ---- */

/** The three kinds the tax calendar colours and filters by. */
export type TaxEventKind = "vat" | "itr" | "wht";
/** One statutory deadline on the calendar: which return, for which period, and where to prepare it. */
export type TaxEvent = { id: string; kind: TaxEventKind; form: string; title: string; period: string; date: string; href: string };

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Every deadline falling between `from` and `to` (inclusive), by the same
 * rules as nextDeadlines above — so the calendar can page back and forward.
 */
export function deadlinesBetween(from: string, to: string): TaxEvent[] {
  const out: TaxEvent[] = [];
  const inRange = (d: string) => d >= from && d <= to;
  const [fy0, fm0] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);

  // Withholding, on calendar months: tax withheld in month wm is due the next month.
  for (let [wy, wm] = addMonths(fy0, fm0, -2); wy * 12 + wm <= ty * 12 + tm; [wy, wm] = addMonths(wy, wm, 1)) {
    const [ny, nm] = addMonths(wy, wm, 1);
    if (wm % 3 !== 0) {
      const due = iso(ny, nm, 10);
      if (inRange(due)) out.push({ id: `0619e-${wy}-${wm}`, kind: "wht", form: "0619-E", title: "Monthly EWT remittance", period: `${MON[wm - 1]} ${wy}`, date: due, href: "/taxes/0619e" });
    } else {
      const due = iso(ny, nm, lastDayOf(ny, nm));
      if (inRange(due)) out.push({ id: `1601eq-${wy}-${wm}`, kind: "wht", form: "1601-EQ", title: "Quarterly EWT return", period: `Q${wm / 3} ${wy}`, date: due, href: "/taxes/1601eq" });
    }
  }

  // VAT and income tax, on the accounting year's quarters. Start well before
  // `from`: the annual return lands four and a half months after year-end.
  let { fy, q } = fiscalQuarterOf(plusDays(from, -200));
  for (let i = 0; i < 12; i++) {
    const r = fiscalQuarterRange(fy, q);
    if (r.from > to) break;
    const vat = plusDays(r.to, 25);
    if (inRange(vat)) out.push({ id: `2550q-${fy}-${q}`, kind: "vat", form: "2550Q", title: "Quarterly VAT return", period: quarterLabel(fy, q), date: vat, href: "/taxes/2550q" });
    if (q < 4) {
      const itr = plusDays(r.to, 60);
      if (inRange(itr)) out.push({ id: `1702q-${fy}-${q}`, kind: "itr", form: "1702Q", title: "Quarterly income tax", period: quarterLabel(fy, q), date: itr, href: "/taxes/1702q" });
    } else {
      const [ey, em] = fiscalYearRange(fy).to.split("-").map(Number);
      const [dy, dm] = addMonths(ey, em, 4);
      const due = iso(dy, dm, 15);
      if (inRange(due)) out.push({ id: `1702-${fy}`, kind: "itr", form: "1702", title: "Annual income tax return", period: isFiscalYear() ? `FY${fy}` : String(fy), date: due, href: "/taxes/1702q" });
    }
    if (q === 4) {
      fy++;
      q = 1;
    } else q++;
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.form.localeCompare(b.form));
}
