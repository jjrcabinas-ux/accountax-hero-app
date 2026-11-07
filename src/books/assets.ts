// Copied from the web app (src/lib/assets.ts) by scripts/sync-books.mjs — edit it there, not here.
import { Rec, queuePush, stampChanged } from "@/books/sync";

import { Account } from "@/books/coa";
import { addDays } from "@/books/invoices";

/**
 * Fixed-asset register behind the Lapsing Schedule. Each asset carries its own
 * straight-line profile; monthly depreciation is derived (never stored) and
 * auto-posted to the ledger, so the register IS the schedule and the books
 * always agree with it.
 *
 * Convention: a full month of depreciation from the month placed in service,
 * none in the month of disposal — each charge dated the last day of its month.
 * The final month absorbs rounding so lifetime depreciation equals exactly
 * cost − salvage.
 *
 * The ACQUISITION is deliberately not posted from here — it belongs to the
 * journal entry that bought the asset (DR the PPE account, CR cash/payable),
 * and `journalEntryId` links the two. Posting it from both places would
 * double-count the cost. An asset with no link never reached the general
 * ledger at all, which is what `isJournalized` flags.
 */

export type AssetDisposal = { date: string; proceeds: number; note?: string };

export type FixedAsset = {
  id: string;
  number: string; // FA-0001
  name: string;
  category: string; // PPE grouping — the name of the PPE cost account when one is linked
  ppeAccountId?: string; // the COA PPE cost account this asset belongs to
  description?: string;
  acquisitionDate: string; // yyyy-mm-dd
  startDate: string; // depreciation start (placed in service)
  cost: number;
  salvage: number;
  lifeMonths: number;
  depExpenseId?: string; // COA override; falls back to 5500
  accumDepId?: string; // COA override; falls back to 1710
  /** The journal entry that recorded the acquisition. Without it the cost is
   *  not in the general ledger, so the asset is only half-recorded. */
  journalEntryId?: string;
  disposal?: AssetDisposal;
  createdAt: string;
};

/** An asset is fully recorded only when its acquisition also hit the ledger. */
export const isJournalized = (a: Pick<FixedAsset, "journalEntryId">) => !!a.journalEntryId;

export const ASSET_CATEGORIES = [
  "Building",
  "Building Improvements",
  "Leasehold Improvements",
  "Machinery and Equipment",
  "Office Equipment",
  "Computer Equipment",
  "Furniture and Fixtures",
  "Transportation Equipment",
  "Other Property and Equipment",
];

const KEY = "ath:assets";

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function loadAssets(): FixedAsset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FixedAsset[]) : [];
  } catch {
    return [];
  }
}

export function saveAssets(list: FixedAsset[]) {
  if (typeof window === "undefined") return;
  // Local first, then pushed in the background — see lib/sync.ts.
  const stamped = stampChanged("assets", list as unknown as Rec[]);
  localStorage.setItem(KEY, JSON.stringify(stamped));
  queuePush("assets", stamped);
}

export function upsertAsset(a: FixedAsset): FixedAsset[] {
  const list = loadAssets();
  const i = list.findIndex((x) => x.id === a.id);
  if (i >= 0) list[i] = a;
  else list.push(a);
  saveAssets(list);
  return list;
}

export function deleteAsset(id: string): FixedAsset[] {
  const list = loadAssets().filter((a) => a.id !== id);
  saveAssets(list);
  return list;
}

export function nextAssetNumber(): string {
  const nums = loadAssets()
    .map((a) => parseInt((a.number.match(/(\d+)$/) || [])[1] || "", 10))
    .filter((n) => !isNaN(n));
  return `FA-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, "0")}`;
}

/* ---- Depreciation math (straight line, full-month convention) ---- */

const pad = (n: number) => String(n).padStart(2, "0");
/** yyyy-mm-dd → month index (year × 12 + month − 1); the day is ignored. */
const monthIdx = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return y * 12 + (m - 1);
};
/** Last day of the month at `idx`, as yyyy-mm-dd. */
const monthEnd = (idx: number) => {
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;
};

/** Round UP to centavos (with a float-noise guard so exact values stay put). */
const ceil2 = (n: number) => Math.ceil(n * 100 - 1e-7) / 100;

export const depreciableAmount = (a: FixedAsset) => r2(Math.max(0, a.cost - a.salvage));
/** Monthly charge rounds UP to 2 decimals; the tail of the schedule absorbs the difference. */
export const monthlyDep = (a: FixedAsset) => (a.lifeMonths >= 1 ? ceil2(depreciableAmount(a) / a.lifeMonths) : 0);

/** Index of the last month this asset depreciates: end of life, or the month before disposal. */
const lastActiveIdx = (a: FixedAsset) => {
  const lifeEnd = monthIdx(a.startDate) + Math.max(1, a.lifeMonths) - 1;
  return a.disposal ? Math.min(lifeEnd, monthIdx(a.disposal.date) - 1) : lifeEnd;
};

/** Every monthly charge over the asset's (possibly cut short) life. */
export function depSchedule(a: FixedAsset): { date: string; amount: number }[] {
  const dep = depreciableAmount(a);
  if (dep < 0.005) return [];
  const n = Math.max(1, Math.round(a.lifeMonths) || 1);
  const start = monthIdx(a.startDate);
  const end = lastActiveIdx(a);
  const monthly = ceil2(dep / n);
  // Clamp each charge to what's left so rounding can never overshoot cost − salvage.
  const rows: { date: string; amount: number }[] = [];
  let posted = 0;
  for (let idx = start; idx <= end; idx++) {
    const remaining = r2(dep - posted);
    const amount = idx - start === n - 1 ? remaining : Math.min(monthly, remaining);
    if (amount > 0.004) {
      rows.push({ date: monthEnd(idx), amount });
      posted = r2(posted + amount);
    }
  }
  return rows;
}

export const accumDepAsOf = (a: FixedAsset, asOf: string) =>
  r2(depSchedule(a).reduce((s, m) => s + (m.date <= asOf ? m.amount : 0), 0));

export const depForPeriod = (a: FixedAsset, from: string, to: string) =>
  r2(depSchedule(a).reduce((s, m) => s + ((!from || m.date >= from) && m.date <= to ? m.amount : 0), 0));

export const bookValueAsOf = (a: FixedAsset, asOf: string) => r2(a.cost - accumDepAsOf(a, asOf));

/** Accumulated depreciation the books would carry at a hypothetical disposal date. */
export const accumAtDisposal = (a: FixedAsset, date: string) =>
  r2(depSchedule({ ...a, disposal: { date, proceeds: 0 } }).reduce((s, m) => s + m.amount, 0));

/** Month-end when the asset becomes fully depreciated (ignoring any disposal). */
export const fullyDepreciatedOn = (a: FixedAsset) => monthEnd(monthIdx(a.startDate) + Math.max(1, a.lifeMonths) - 1);

export const isDisposedAsOf = (a: FixedAsset, asOf: string) => !!a.disposal && a.disposal.date <= asOf;

export type AssetStatus = "active" | "fully-depreciated" | "disposed";

export function assetStatus(a: FixedAsset, asOf: string): AssetStatus {
  if (isDisposedAsOf(a, asOf)) return "disposed";
  if (depreciableAmount(a) >= 0.005 && fullyDepreciatedOn(a) <= asOf) return "fully-depreciated";
  return "active";
}

/** Whether the asset still takes a monthly charge in the month of `asOf`. */
export const isDepreciating = (a: FixedAsset, asOf: string) =>
  depreciableAmount(a) >= 0.005 && monthIdx(asOf) >= monthIdx(a.startDate) && monthIdx(asOf) <= lastActiveIdx(a);

/** Register headline figures as of a date; disposed assets are off the books. */
export function registerTotals(assets: FixedAsset[], asOf: string) {
  let cost = 0;
  let accum = 0;
  let monthly = 0;
  for (const a of assets) {
    if (isDisposedAsOf(a, asOf)) continue;
    cost += a.cost;
    accum += accumDepAsOf(a, asOf);
    if (isDepreciating(a, asOf)) monthly += monthlyDep(a);
  }
  return { cost: r2(cost), accum: r2(accum), nbv: r2(cost - accum), monthly: r2(monthly) };
}

/** Year-by-year run-out for one asset (for the expandable register row). */
export function yearlySchedule(a: FixedAsset) {
  const byYear = new Map<number, number>();
  for (const m of depSchedule(a)) {
    const y = Number(m.date.slice(0, 4));
    byYear.set(y, (byYear.get(y) ?? 0) + m.amount);
  }
  let accum = 0;
  return [...byYear.entries()]
    .sort((x, y) => x[0] - y[0])
    .map(([year, dep]) => {
      accum += dep;
      return { year, depreciation: r2(dep), accumulated: r2(accum), bookValue: r2(a.cost - accum) };
    });
}

/** Resolved accumulated-depreciation account ids (per-asset override or the 1710 default). */
export function accumDepAccountIds(accounts: Account[]): Set<string> {
  // By seed id first — codes move when the chart is renumbered, ids never do.
  const def = (accounts.find((x) => x.id === "acct-1710") ?? accounts.find((x) => /accumulated deprec/i.test(x.name)) ?? accounts.find((x) => x.code === "1710"))?.id;
  const ids = new Set<string>();
  for (const a of loadAssets()) {
    const id = a.accumDepId || def;
    if (id) ids.add(id);
  }
  return ids;
}

export const fmtLife = (months: number) => (months % 12 === 0 ? `${months / 12} yr${months === 12 ? "" : "s"}` : `${months} mo`);

/* ---- Lapsing schedule (the report) ---- */

export type LapsingRow = {
  asset: FixedAsset;
  begAccum: number; // accumulated depreciation the day before `from`
  periodDep: number;
  endAccum: number; // as of `to` (for disposals, the amount derecognized)
  nbv: number; // cost − endAccum
  acquiredInPeriod: boolean;
};

export type LapsingTotals = { cost: number; begAccum: number; periodDep: number; endAccum: number; nbv: number };
export type LapsingGroup = { category: string; rows: LapsingRow[]; totals: LapsingTotals };

function totalRows(rows: LapsingRow[]): LapsingTotals {
  const t = { cost: 0, begAccum: 0, periodDep: 0, endAccum: 0, nbv: 0 };
  for (const r of rows) {
    t.cost += r.asset.cost;
    t.begAccum += r.begAccum;
    t.periodDep += r.periodDep;
    t.endAccum += r.endAccum;
    t.nbv += r.nbv;
  }
  return { cost: r2(t.cost), begAccum: r2(t.begAccum), periodDep: r2(t.periodDep), endAccum: r2(t.endAccum), nbv: r2(t.nbv) };
}

/**
 * The lapsing schedule for a period: assets grouped by category, with assets
 * disposed within the period set apart (their cost and accumulated
 * depreciation leave the books, so they're excluded from the ending totals).
 */
export function lapsingRows(assets: FixedAsset[], from: string, to: string) {
  const active: LapsingRow[] = [];
  const disposed: LapsingRow[] = [];
  for (const a of assets) {
    if (a.acquisitionDate > to) continue;
    if (a.disposal && from && a.disposal.date < from) continue;
    const endAccum = accumDepAsOf(a, to);
    const row: LapsingRow = {
      asset: a,
      begAccum: from ? accumDepAsOf(a, addDays(from, -1)) : 0,
      periodDep: depForPeriod(a, from, to),
      endAccum,
      nbv: r2(a.cost - endAccum),
      acquiredInPeriod: !!from && a.acquisitionDate >= from,
    };
    (a.disposal && a.disposal.date <= to ? disposed : active).push(row);
  }
  const order = (x: LapsingRow, y: LapsingRow) =>
    x.asset.acquisitionDate.localeCompare(y.asset.acquisitionDate) || x.asset.number.localeCompare(y.asset.number);
  const categories = [...ASSET_CATEGORIES, ...new Set(active.map((r) => r.asset.category).filter((c) => !ASSET_CATEGORIES.includes(c)))];
  const groups: LapsingGroup[] = [];
  for (const category of categories) {
    const rows = active.filter((r) => r.asset.category === category).sort(order);
    if (rows.length) groups.push({ category, rows, totals: totalRows(rows) });
  }
  disposed.sort(order);
  // Grand totals: the flow columns (cost, beginning accum, period dep) cover every
  // printed row so they tie to the GL and roll forward from the prior schedule;
  // the ending columns stay active-only — disposed assets have left the books.
  const act = totalRows(active);
  const all = totalRows([...active, ...disposed]);
  return {
    groups,
    disposed,
    disposedTotals: totalRows(disposed),
    totals: { cost: all.cost, begAccum: all.begAccum, periodDep: all.periodDep, endAccum: act.endAccum, nbv: act.nbv },
  };
}
