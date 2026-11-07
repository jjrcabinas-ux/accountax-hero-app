// Copied from the web app (src/lib/pos.ts) by scripts/sync-books.mjs — edit it there, not here.
import { Rec, queuePush, stampChanged } from "@/books/sync";
import { round2 } from "@/books/invoices";
import { Account, loadAccounts, newId as newAccountId, upsertAccount } from "@/books/coa";
import { nextCodeFor } from "@/books/lineItems";

/*
 * POS sales — one record per Z-reading.
 *
 * A Z-reading is the terminal's end-of-day summary: sales by VAT class, the
 * VAT itself, statutory discounts (senior citizen and PWD, kept apart because
 * they are reported apart), returns and voids, and what was actually taken
 * in by tender type. It is a cash sale, so it posts straight to cash — there
 * is no receivable — and it flows into the books like this:
 *
 *   Sales Journal          the reading's sales by VAT class (the VAT book)
 *   Cash Receipts Journal  the tenders, one line per tender type
 *   Ledger / statements    DR cash accounts (tenders)
 *                          DR contra-revenue (SC, PWD, returns)
 *                          CR Sales (net of VAT), CR Output VAT
 *
 * The entry balances by construction: the dialog refuses a reading whose
 * tenders do not equal gross sales less discounts and returns.
 */

export type TenderMethod = "cash" | "card" | "ewallet" | "other";

export const TENDER_METHODS: TenderMethod[] = ["cash", "card", "ewallet", "other"];

export const TENDER_LABEL: Record<TenderMethod, string> = {
  cash: "Cash",
  card: "Card",
  ewallet: "GCash / Maya",
  other: "Other",
};

export type PosTender = {
  method: TenderMethod;
  amount: number;
  /** Cash / bank account the money lands in (a "Deposit to" account). */
  accountId: string;
  accountName: string;
};

export type PosSale = {
  id: string;
  number: string; // POS-0001
  machine: string; // POS machine / terminal number, as printed on the Z-reading
  date: string; // yyyy-mm-dd — Z-reading report date
  /** First and last invoice / official receipt numbers covered by the reading. */
  invoiceFrom?: string;
  invoiceTo?: string;
  vatable: number; // VATable sales, net of VAT
  exempt: number; // VAT-exempt sales
  zeroRated: number; // zero-rated sales
  vat: number; // output VAT
  scDiscount: number; // senior citizen discount
  pwdDiscount: number; // PWD discount
  returns: number; // returns and voids
  tenders: PosTender[];
  notes?: string;
  createdAt: string;
};

/** Contra-revenue accounts the readings post to; created on first use. */
export const SALES_CONTRA = {
  sc: "Senior Citizen Discount",
  pwd: "PWD Discount",
  returns: "Sales Returns and Allowances",
} as const;

const KEY = "ath:pos";

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function loadPosSales(): PosSale[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PosSale[]) : [];
  } catch {
    return [];
  }
}

export function savePosSales(list: PosSale[]) {
  if (typeof window === "undefined") return;
  const stamped = stampChanged("pos", list as unknown as Rec[]);
  localStorage.setItem(KEY, JSON.stringify(stamped));
  queuePush("pos", stamped);
}

export function upsertPosSale(z: PosSale): PosSale[] {
  const list = loadPosSales();
  const i = list.findIndex((x) => x.id === z.id);
  if (i >= 0) list[i] = z;
  else list.push(z);
  savePosSales(list);
  return list;
}

export function deletePosSale(id: string): PosSale[] {
  const list = loadPosSales().filter((x) => x.id !== id);
  savePosSales(list);
  return list;
}

export function nextPosNumber(): string {
  const max = loadPosSales().reduce((m, z) => {
    const n = parseInt(z.number.replace(/\D/g, ""), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `POS-${String(max + 1).padStart(4, "0")}`;
}

/** The arithmetic of a reading; `diff` must be zero for it to post. */
export function posTotals(z: Pick<PosSale, "vatable" | "exempt" | "zeroRated" | "vat" | "scDiscount" | "pwdDiscount" | "returns" | "tenders">) {
  const n = (v: number) => Number(v) || 0;
  const netSales = round2(n(z.vatable) + n(z.exempt) + n(z.zeroRated));
  const gross = round2(netSales + n(z.vat));
  const deductions = round2(n(z.scDiscount) + n(z.pwdDiscount) + n(z.returns));
  const net = round2(gross - deductions);
  const tendered = round2(z.tenders.reduce((s, t) => s + n(t.amount), 0));
  return { netSales, gross, deductions, net, tendered, diff: round2(tendered - net) };
}

/** A break in a machine's invoice series: the numbers that should sit right before this reading but were never encoded. */
export type InvoiceGap = { from: string; to: string; count: number; prevNumber: string; prevDate: string };

const serial = (s?: string) => {
  const d = (s ?? "").replace(/\D/g, "");
  return d ? Number(d) : NaN;
};
const padLike = (n: number, like: string) => String(n).padStart((like.trim().match(/\d+$/)?.[0] ?? "").length, "0");

/**
 * POS invoices run in one unbroken series per machine, so each Z-reading's
 * first invoice should be the previous reading's last invoice + 1. Readings
 * are ordered by their invoice numbers (not by date, which can be mistyped);
 * a reading whose first number jumps past the previous last number is
 * flagged with the missing range. Readings without a parseable range are
 * skipped and never break the chain for their neighbours.
 */
export function invoiceGaps(list: PosSale[]): Map<string, InvoiceGap> {
  const gaps = new Map<string, InvoiceGap>();
  const byMachine = new Map<string, PosSale[]>();
  for (const z of list) {
    const a = serial(z.invoiceFrom);
    const b = serial(z.invoiceTo ?? z.invoiceFrom);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) continue;
    const k = z.machine.trim();
    if (!byMachine.has(k)) byMachine.set(k, []);
    byMachine.get(k)!.push(z);
  }
  for (const zs of byMachine.values()) {
    zs.sort((x, y) => serial(x.invoiceFrom) - serial(y.invoiceFrom) || x.date.localeCompare(y.date));
    let prev: PosSale | null = null;
    let prevEnd = NaN;
    for (const z of zs) {
      const a = serial(z.invoiceFrom);
      const b = serial(z.invoiceTo ?? z.invoiceFrom);
      if (prev && a > prevEnd + 1) {
        gaps.set(z.id, { from: padLike(prevEnd + 1, z.invoiceFrom ?? ""), to: padLike(a - 1, z.invoiceFrom ?? ""), count: a - 1 - prevEnd, prevNumber: prev.number, prevDate: prev.date });
      }
      if (!prev || b > prevEnd) {
        prev = z;
        prevEnd = b;
      }
    }
  }
  return gaps;
}

/** "SI 000123–000178", or the one number present, or nothing. */
export function invoiceRange(z: Pick<PosSale, "invoiceFrom" | "invoiceTo">): string {
  const a = (z.invoiceFrom ?? "").trim();
  const b = (z.invoiceTo ?? "").trim();
  if (a && b) return a === b ? `SI ${a}` : `SI ${a}–${b}`;
  return a || b ? `SI ${a || b}` : "";
}

/** Machines seen so far, most recently used first — the suggestion list. */
export function posMachines(list: PosSale[]): string[] {
  const last = new Map<string, string>();
  for (const z of list) {
    const k = z.machine.trim();
    if (!k) continue;
    if (!last.has(k) || last.get(k)! < z.date) last.set(k, z.date);
  }
  return [...last.entries()].sort((a, b) => b[1].localeCompare(a[1])).map(([m]) => m);
}

/**
 * Make sure the contra-revenue accounts a reading needs exist. They are
 * income-type accounts filed under Revenue: their debit balances net against
 * sales, so the statement's Revenue line is already net of the discounts and
 * returns the law lets a seller deduct.
 */
export function ensureContraAccounts(names: string[]): Account[] {
  let list = loadAccounts();
  for (const name of names) {
    if (list.some((a) => a.name.trim().toLowerCase() === name.toLowerCase())) continue;
    const acct: Account = {
      id: newAccountId(),
      code: nextCodeFor("revenue", list),
      name,
      type: "income",
      lineItem: "revenue",
      category: "Revenue",
      description: "Contra-revenue from POS readings — deducted from sales",
      createdAt: new Date().toISOString(),
    };
    list = upsertAccount(acct);
  }
  return list;
}
