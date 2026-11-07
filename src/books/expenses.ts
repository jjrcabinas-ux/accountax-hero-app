// Copied from the web app (src/lib/expenses.ts) by scripts/sync-books.mjs — edit it there, not here.
import { Rec, queuePush, stampChanged } from "@/books/sync";

import { Payment, VAT_RATE, VatClass, round2 } from "@/books/invoices";

/** A line on a bill/expense: an expense (or other) account and an amount. */
export type ExpenseLine = {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  description: string;
  amount: number; // as entered (VAT-inclusive or exclusive per the bill)
  vat: VatClass;
};

export type ExpenseStatus = "open" | "partial" | "paid";

/** A bill / recorded expense. Payments reuse the shared Payment shape (EWT = taxWithheld). */
export type Expense = {
  id: string;
  number: string; // BILL-0001
  supplierId: string;
  supplierName: string;
  supplierTin: string;
  date: string; // yyyy-mm-dd
  dueDate: string;
  terms: string;
  amountsAre: "exclusive" | "inclusive";
  lines: ExpenseLine[];
  // Expanded withholding tax accrued at bill date (reduces the supplier payable).
  withholds?: boolean;
  withholdingRate?: number; // e.g. 0.02
  ewt?: number; // EWT amount
  memo: string;
  status: ExpenseStatus;
  payments?: Payment[];
  createdAt: string;
};

const KEY = "ath:expenses";

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function loadExpenses(): Expense[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Expense[]).map((e) => ({ ...e, payments: e.payments ?? [], status: statusOf(e) })) : [];
  } catch {
    return [];
  }
}

export function saveExpenses(list: Expense[]) {
  if (typeof window === "undefined") return;
  // Local first, then pushed in the background — see lib/sync.ts.
  const stamped = stampChanged("expenses", list as unknown as Rec[]);
  localStorage.setItem(KEY, JSON.stringify(stamped));
  queuePush("expenses", stamped);
}

export function upsertExpense(e: Expense): Expense[] {
  const list = loadExpenses();
  const i = list.findIndex((x) => x.id === e.id);
  if (i >= 0) list[i] = e;
  else list.push(e);
  saveExpenses(list);
  return list;
}

export function getExpense(id: string): Expense | null {
  return loadExpenses().find((e) => e.id === id) || null;
}

export function deleteExpense(id: string): Expense[] {
  const list = loadExpenses().filter((e) => e.id !== id);
  saveExpenses(list);
  return list;
}

export function nextExpenseNumber(): string {
  const nums = loadExpenses()
    .map((e) => parseInt((e.number.match(/(\d+)$/) || [])[1] || "", 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `BILL-${String(next).padStart(4, "0")}`;
}

/** Per-line net and input VAT, honouring whether the amount is VAT-inclusive. */
export function lineAmounts(l: ExpenseLine, amountsAre: Expense["amountsAre"]) {
  const gross = round2(Number(l.amount) || 0);
  if (l.vat !== "vatable") return { net: gross, vat: 0, total: gross };
  if (amountsAre === "inclusive") {
    const net = round2(gross / (1 + VAT_RATE));
    return { net, vat: round2(gross - net), total: gross };
  }
  const vat = round2(gross * VAT_RATE);
  return { net: gross, vat, total: round2(gross + vat) };
}

export function expenseTotals(e: Pick<Expense, "lines" | "amountsAre">) {
  let subtotal = 0;
  let vat = 0;
  for (const l of e.lines) {
    const a = lineAmounts(l, e.amountsAre);
    subtotal += a.net;
    vat += a.vat;
  }
  subtotal = round2(subtotal);
  vat = round2(vat);
  return { subtotal, vat, total: round2(subtotal + vat) };
}

/* ---- EWT (accrued at the bill) and payment-derived amounts (cash) ---- */

/** EWT accrued on this bill — computed on the VAT-exclusive subtotal. */
export const ewtAmount = (e: Pick<Expense, "lines" | "amountsAre" | "withholds" | "withholdingRate" | "ewt">) =>
  e.withholds ? round2(e.ewt ?? round2(expenseTotals(e).subtotal * (e.withholdingRate ?? 0))) : 0;

/** Amount owed to the supplier = gross total less EWT withheld. */
export const netPayable = (e: Pick<Expense, "lines" | "amountsAre" | "withholds" | "withholdingRate" | "ewt">) =>
  round2(expenseTotals(e).total - ewtAmount(e));

const pays = (e: Pick<Expense, "payments">) => e.payments ?? [];
export const cashPaid = (e: Pick<Expense, "payments">) => round2(pays(e).reduce((s, p) => s + (Number(p.amount) || 0), 0));

type PayCtx = Pick<Expense, "lines" | "amountsAre" | "withholds" | "withholdingRate" | "ewt" | "payments">;
export const expenseBalance = (e: PayCtx) => round2(netPayable(e) - cashPaid(e));
export const overpayment = (e: PayCtx) => Math.max(0, round2(cashPaid(e) - netPayable(e)));

export function statusOf(e: PayCtx): ExpenseStatus {
  const paid = cashPaid(e);
  if (paid <= 0.005) return "open";
  return expenseBalance(e) > 0.005 ? "partial" : "paid";
}

export const isOverdue = (e: PayCtx & Pick<Expense, "dueDate">, asOf: string) => expenseBalance(e) > 0.005 && e.dueDate < asOf;

export type BadgeTone = "green" | "amber" | "red" | "slate";
export function expenseBadge(e: PayCtx & Pick<Expense, "dueDate">, asOf: string): { label: string; tone: BadgeTone } {
  const st = statusOf(e);
  if (st === "paid") return { label: "Paid", tone: "green" };
  if (isOverdue(e, asOf)) {
    // Both are yyyy-mm-dd, parsed as UTC midnight, so the difference is whole days.
    const days = Math.max(1, Math.round((Date.parse(asOf) - Date.parse(e.dueDate || asOf)) / 86_400_000));
    return { label: `Overdue ${days} day${days === 1 ? "" : "s"}`, tone: "red" };
  }
  if (st === "partial") return { label: "Partial", tone: "amber" };
  return { label: "Open", tone: "slate" };
}

/** Status colours — text only, matching the invoice statuses. */
export const BADGE_TONE: Record<BadgeTone, string> = {
  green: "text-[var(--green)]",
  amber: "text-[var(--warning)] ",
  red: "text-[var(--danger)] ",
  slate: "text-[var(--nav)]",
};

export const peso = (n: number) =>
  "₱" + (Number(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const TERMS = [
  { label: "Due on receipt", days: 0 },
  { label: "Net 15", days: 15 },
  { label: "Net 30", days: 30 },
  { label: "Net 60", days: 60 },
];

export function addDays(iso: string, days: number): string {
  // Stay in local time end to end — toISOString() is UTC and lands a day early in PH time.
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
