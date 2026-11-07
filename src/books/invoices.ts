// Copied from the web app (src/lib/invoices.ts) by scripts/sync-books.mjs — edit it there, not here.
import { Rec, queuePush, stampChanged } from "@/books/sync";

export const VAT_RATE = 0.12; // Philippine VAT

export type VatClass = "vatable" | "exempt" | "zero";

export type InvoiceLine = {
  id: string;
  item: string; // product / service (free text for now)
  description: string;
  qty: number;
  rate: number; // unit price as entered
  vat: VatClass;
};

export type Invoice = {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  customerTin: string;
  billingAddress: string;
  invoiceDate: string; // yyyy-mm-dd
  dueDate: string; // yyyy-mm-dd
  terms: string;
  amountsAre: "exclusive" | "inclusive"; // whether line rates include VAT
  lines: InvoiceLine[];
  message: string;
  status: InvoiceStatus; // derived from payments, stored for quick filtering
  payments?: Payment[]; // receipts recorded against this invoice
  /** @deprecated single-payment shape, migrated into `payments` on load */
  payment?: LegacyPayment;
  paidDate?: string; // @deprecated — kept for old records
  createdAt: string;
  /**
   * Voided: the invoice stays in the register with its number (so the sequence
   * has no hole) but counts for nothing — no receivable, no VAT, no sales. Only
   * an invoice with no payments can be voided.
   */
  voided?: boolean;
  voidedAt?: string;
  /** When "Send" last opened an email to the customer. */
  sentAt?: string;
  /** Every time "Send" was used, oldest first (sentAt is the last of these). */
  sentLog?: string[];
  /**
   * "receipt": a sales receipt — a cash sale settled on the spot. Stored as an
   * invoice carrying one payment for the full amount, so VAT, the SLSP and the
   * journals treat it like any sale; the ledger posts it straight to cash (no
   * receivable). Numbered SR-#### on its own sequence and kept out of the
   * invoice list. Absent = an ordinary invoice.
   */
  kind?: "invoice" | "receipt";
  /** Where the receipt can be emailed — prefilled from the customer, optional. */
  customerEmail?: string;
};

export type DocKind = "invoice" | "receipt";
export const kindOf = (i: Pick<Invoice, "kind">): DocKind => (i.kind === "receipt" ? "receipt" : "invoice");
export const isReceipt = (i: Pick<Invoice, "kind">) => i.kind === "receipt";
/** Invoices proper — sales receipts excluded. */
export const loadInvoicesOnly = () => loadInvoices().filter((i) => !isReceipt(i));
/** Sales receipts only. */
export const loadReceipts = () => loadInvoices().filter(isReceipt);

/** All the times this invoice was sent, oldest first — older records only carry sentAt. */
export function sentTimes(inv: Pick<Invoice, "sentAt" | "sentLog">): string[] {
  const all = [...(inv.sentLog ?? [])];
  if (inv.sentAt && !all.includes(inv.sentAt)) all.push(inv.sentAt);
  return all.sort();
}

export type InvoiceStatus = "open" | "partial" | "paid";

/** A receipt against an invoice: cash actually received plus any tax withheld. */
export type Payment = {
  id: string;
  date: string; // yyyy-mm-dd the payment was received
  amount: number; // cash actually received
  taxWithheld: number; // creditable withholding tax (CWT), 0 if none
  withholdingRate?: number; // e.g. 0.02 — kept for the 2307 schedule
  accountId: string; // cash/bank account the money went into
  accountName: string;
  method: string; // Cash, Bank transfer, Check, GCash…
  reference: string; // OR/check no. — optional
};

type LegacyPayment = Omit<Payment, "id" | "taxWithheld"> & { id?: string; taxWithheld?: number };

export const PAYMENT_METHODS = ["Cash", "Bank transfer", "Check", "GCash", "Card", "Other"];

/** Standard BIR expanded-withholding-tax rates, computed on the VAT-exclusive base. */
export const WITHHOLDING_RATES: { label: string; rate: number }[] = [
  { label: "1% — Goods", rate: 0.01 },
  { label: "2% — Services / contractors", rate: 0.02 },
  { label: "5% — Rentals / some services", rate: 0.05 },
  { label: "10% — Professional fees", rate: 0.1 },
  { label: "15% — Professional fees (higher)", rate: 0.15 },
];

const KEY = "ath:invoices";

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function loadInvoices(): Invoice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Invoice[]).map(migrateInvoice) : [];
  } catch {
    return [];
  }
}

/** Bring old single-payment / binary-status records up to the payments-array shape. */
function migrateInvoice(inv: Invoice): Invoice {
  if (!inv.payments) {
    if (inv.payment) {
      inv.payments = [{ id: inv.payment.id ?? newId(), taxWithheld: inv.payment.taxWithheld ?? 0, ...inv.payment } as Payment];
    } else if (inv.status === "paid") {
      // Legacy "paid" with no recorded payment — assume a full cash receipt.
      const t = invoiceTotals(inv).total;
      inv.payments = [
        { id: newId(), date: inv.paidDate || inv.invoiceDate, amount: t, taxWithheld: 0, accountId: "", accountName: "—", method: "Cash", reference: "" },
      ];
    } else {
      inv.payments = [];
    }
  }
  inv.status = statusOf(inv);
  return inv;
}

/** Every stored invoice that has not been voided — what the books, returns and reports are built from. */
export function loadLiveInvoices(): Invoice[] {
  return loadInvoices().filter((i) => !i.voided);
}

export function saveInvoices(list: Invoice[]) {
  if (typeof window === "undefined") return;
  // Local first so the UI never waits on the network; the push happens in the
  // background. See lib/sync.ts for why reads stay synchronous.
  const stamped = stampChanged("invoices", list as unknown as Rec[]);
  localStorage.setItem(KEY, JSON.stringify(stamped));
  queuePush("invoices", stamped);
}

export function upsertInvoice(inv: Invoice): Invoice[] {
  const list = loadInvoices();
  const i = list.findIndex((x) => x.id === inv.id);
  if (i >= 0) list[i] = inv;
  else list.push(inv);
  saveInvoices(list);
  const n = numberOf(inv.number);
  if (!isNaN(n)) recordIssued(n, kindOf(inv));
  return list;
}

export function getInvoice(id: string): Invoice | null {
  return loadInvoices().find((i) => i.id === id) || null;
}

export function deleteInvoice(id: string): Invoice[] {
  const list = loadInvoices().filter((i) => i.id !== id);
  saveInvoices(list);
  return list;
}

/* ---- Numbering ----
 * Numbers were Max+1 over whatever this browser happened to hold, so a device
 * with a partial copy restarted at INV-0001, deleting the top invoice handed its
 * number out again, and sync (which merges by id, not number) kept both copies.
 * Now: the highest number ever issued is kept in the synced meta store, so a
 * deleted number is never reused; a new invoice re-checks its number at save;
 * and the list flags any clash already in the books.
 */
const META_KEY = "ath:meta";
// Invoices and sales receipts run on separate sequences (INV-#### and SR-####).
const SEQ: Record<DocKind, { id: string; prefix: string }> = {
  invoice: { id: "seq-invoice", prefix: "INV-" },
  receipt: { id: "seq-receipt", prefix: "SR-" },
};
const ofKind = (k: DocKind) => loadInvoices().filter((i) => kindOf(i) === k);
const numberOf = (s: string) => parseInt((String(s).match(/(\d+)$/) || [])[1] || "", 10);
const sameNumber = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();

function readMeta(): Rec[] {
  try {
    const v = JSON.parse(localStorage.getItem(META_KEY) || "[]");
    return Array.isArray(v) ? (v as Rec[]) : [];
  } catch {
    return [];
  }
}
/** Highest number ever issued for this kind of document — survives deletes. */
function issuedHighWater(k: DocKind): number {
  const r = readMeta().find((x) => x?.id === SEQ[k].id);
  return typeof r?.last === "number" ? r.last : 0;
}
function recordIssued(n: number, k: DocKind) {
  if (typeof window === "undefined" || n <= issuedHighWater(k)) return;
  const others = readMeta().filter((x) => x?.id !== SEQ[k].id);
  const stamped = stampChanged("meta", [...others, { id: SEQ[k].id, last: n }] as Rec[]);
  localStorage.setItem(META_KEY, JSON.stringify(stamped));
  queuePush("meta", stamped);
}

/** Next number for the kind: one past the highest stored or ever issued (INV-#### / SR-####). */
export function nextDocNumber(k: DocKind): string {
  const nums = ofKind(k).map((i) => numberOf(i.number)).filter((n) => !isNaN(n));
  const next = Math.max(0, issuedHighWater(k), ...nums) + 1;
  return `${SEQ[k].prefix}${String(next).padStart(4, "0")}`;
}
export const nextInvoiceNumber = () => nextDocNumber("invoice");

/**
 * Start the invoice and sales-receipt series over at 0001 (Settings › Start
 * fresh, after the documents are cleared). The counters are zeroed rather than
 * removed, so the reset syncs to every device like any other edit.
 */
export function resetDocNumbers() {
  if (typeof window === "undefined") return;
  const ids = Object.values(SEQ).map((q) => q.id);
  const others = readMeta().filter((x) => !ids.includes(String(x?.id)));
  const stamped = stampChanged("meta", [...others, ...ids.map((id) => ({ id, last: 0 }))] as Rec[]);
  localStorage.setItem(META_KEY, JSON.stringify(stamped));
  queuePush("meta", stamped);
}

/** True when another document of the same kind (voided ones included — they keep their number) already uses this number. */
export const invoiceNumberTaken = (number: string, exceptId?: string, k: DocKind = "invoice") =>
  ofKind(k).some((i) => i.id !== exceptId && sameNumber(i.number, number));

/** Normalised numbers that appear on more than one invoice. */
export function duplicateInvoiceNumbers(list: Pick<Invoice, "number">[]): Set<string> {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const i of list) {
    const k = i.number.trim().toUpperCase();
    if (seen.has(k)) dupes.add(k);
    else seen.add(k);
  }
  return dupes;
}

export const TERMS = [
  { label: "Due on receipt", days: 0 },
  { label: "Net 5", days: 5 },
  { label: "Net 7", days: 7 },
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

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Per-line net and VAT, honouring whether the rate is VAT-inclusive. */
export function lineAmounts(l: InvoiceLine, amountsAre: Invoice["amountsAre"]) {
  const gross = round2((Number(l.qty) || 0) * (Number(l.rate) || 0));
  if (l.vat !== "vatable") return { net: gross, vat: 0, total: gross };
  if (amountsAre === "inclusive") {
    const net = round2(gross / (1 + VAT_RATE));
    return { net, vat: round2(gross - net), total: gross };
  }
  const vat = round2(gross * VAT_RATE);
  return { net: gross, vat, total: round2(gross + vat) };
}

export function invoiceTotals(inv: Pick<Invoice, "lines" | "amountsAre">) {
  let subtotal = 0;
  let vat = 0;
  for (const l of inv.lines) {
    const a = lineAmounts(l, inv.amountsAre);
    subtotal += a.net;
    vat += a.vat;
  }
  subtotal = round2(subtotal);
  vat = round2(vat);
  return { subtotal, vat, total: round2(subtotal + vat) };
}

/* ---- Payment-derived amounts ---- */

export const invoicePayments = (inv: Pick<Invoice, "payments">): Payment[] => inv.payments ?? [];

/** Cash actually received (excludes tax withheld). */
export const cashReceived = (inv: Pick<Invoice, "payments">) =>
  round2(invoicePayments(inv).reduce((s, p) => s + (Number(p.amount) || 0), 0));

/** Total creditable withholding tax on this invoice. */
export const taxWithheldTotal = (inv: Pick<Invoice, "payments">) =>
  round2(invoicePayments(inv).reduce((s, p) => s + (Number(p.taxWithheld) || 0), 0));

/** Amount credited against the invoice = cash + CWT. */
export const appliedTotal = (inv: Pick<Invoice, "payments">) =>
  round2(cashReceived(inv) + taxWithheldTotal(inv));

/** Remaining balance the customer still owes (0 once settled). */
export const invoiceBalance = (inv: Pick<Invoice, "lines" | "amountsAre" | "payments"> & { voided?: boolean }) =>
  inv.voided ? 0 : round2(invoiceTotals(inv).total - appliedTotal(inv));

/** Amount received in excess of the invoice — a customer credit/advance. */
export const overpayment = (inv: Pick<Invoice, "lines" | "amountsAre" | "payments">) =>
  Math.max(0, round2(appliedTotal(inv) - invoiceTotals(inv).total));

export function statusOf(inv: Pick<Invoice, "lines" | "amountsAre" | "payments">): InvoiceStatus {
  const applied = appliedTotal(inv);
  if (applied <= 0.005) return "open";
  return invoiceBalance(inv) > 0.005 ? "partial" : "paid";
}

/** True when unpaid/partly-paid and past due. */
export const isOverdue = (inv: Pick<Invoice, "lines" | "amountsAre" | "payments" | "dueDate">, asOf: string) =>
  invoiceBalance(inv) > 0.005 && inv.dueDate < asOf;

export type BadgeTone = "green" | "amber" | "red" | "slate";

/** Status badge shown in lists: Paid / Overdue / Partial / Open. */
export function invoiceBadge(
  inv: Pick<Invoice, "lines" | "amountsAre" | "payments" | "dueDate"> & { voided?: boolean },
  asOf: string
): { label: string; tone: BadgeTone } {
  if (inv.voided) return { label: "Void", tone: "slate" };
  const st = statusOf(inv);
  if (st === "paid") return { label: "Paid", tone: "green" };
  if (isOverdue(inv, asOf)) {
    // Both are yyyy-mm-dd, parsed as UTC midnight, so the difference is whole days.
    const days = Math.max(1, Math.round((Date.parse(asOf) - Date.parse(inv.dueDate)) / 86_400_000));
    return { label: `Overdue ${days} day${days === 1 ? "" : "s"}`, tone: "red" };
  }
  if (st === "partial") return { label: "Partial", tone: "amber" };
  return { label: "Open", tone: "slate" };
}

/** Status colours — text only; the tinted pill backgrounds were dropped to keep the lists quiet. */
export const BADGE_TONE: Record<BadgeTone, string> = {
  green: "text-[var(--green)]",
  amber: "text-[var(--warning)] ",
  red: "text-[var(--danger)] ",
  slate: "text-[var(--nav)]",
};

export const peso = (n: number) =>
  "₱" + (Number(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
