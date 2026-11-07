// Copied from the web app (src/lib/ledger.ts) by scripts/sync-books.mjs — edit it there, not here.
import { loadAccounts, normalBalanceFor } from "@/books/coa";
import { loadEntries } from "@/books/journal";
import { invoiceTotals, loadLiveInvoices } from "@/books/invoices";
import { ewtAmount, expenseTotals, lineAmounts as expenseLineAmounts, loadExpenses } from "@/books/expenses";
import { depSchedule, loadAssets } from "@/books/assets";
import { SALES_CONTRA, TENDER_LABEL, loadPosSales } from "@/books/pos";

export const peso = (n: number) =>
  "₱" + (Number(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** A single debit or credit to an account, from any source. */
export type Posting = {
  date: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  sourceType: "journal" | "invoice" | "receipt" | "payment" | "bill" | "bill-payment" | "depreciation" | "pos";
  source: string; // JE-0001 / INV-0001 / BILL-0001 / FA-0001 / POS-0001
  memo: string;
};

/** Standard accounts the auto-posting relies on, by code. */
const STD = {
  ar: { code: "1200", name: "Accounts Receivable" },
  sales: { code: "4000", name: "Sales / Service Revenue" },
  outputVat: { code: "2100", name: "Output VAT" },
  cwt: { code: "1300", name: "Creditable Withholding Tax" },
  cash: { code: "1010", name: "Cash in Bank" },
  ap: { code: "2000", name: "Accounts Payable" },
  inputVat: { code: "1500", name: "Input VAT" },
  whtPayable: { code: "2200", name: "Withholding Tax Payable" },
  depExpense: { code: "5500", name: "Depreciation Expense" },
  accumDep: { code: "1710", name: "Accumulated Depreciation" },
} as const;

/**
 * Secondary way to find a standard account if its code was ever changed (the
 * user can freely edit codes in the Chart of Accounts) — match by name so the
 * posting still lands on the real account instead of a synthetic fallback.
 */
const NAME_HINTS: Partial<Record<keyof typeof STD, RegExp>> = {
  ar: /accounts receivable/i,
  sales: /sales|service revenue/i,
  outputVat: /output vat/i,
  cwt: /creditable withholding/i,
  cash: /cash in bank/i,
  ap: /accounts payable/i,
  inputVat: /input vat/i,
  whtPayable: /withholding.*expanded|expanded.*withholding/i,
  depExpense: /depreciation expense/i,
  accumDep: /accumulated depreciation/i,
};

type Ref = { accountId: string; accountCode: string; accountName: string };

function resolver() {
  const accounts = loadAccounts();
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  const byName = new Map(accounts.map((a) => [a.name.trim().toLowerCase(), a]));
  const std = (k: keyof typeof STD): Ref => {
    const s = STD[k];
    const hint = NAME_HINTS[k];
    // A seeded account keeps its id for life ("acct-<seed code>"), so the id is
    // the handle that survives the chart being renumbered; the name is next;
    // the literal code is the last resort, since codes now move.
    const a = byId.get(`acct-${s.code}`) ?? (hint ? accounts.find((x) => !x.archived && hint.test(x.name)) : undefined) ?? byCode.get(s.code);
    return { accountId: a?.id ?? s.code, accountCode: a?.code ?? s.code, accountName: a?.name ?? s.name };
  };
  // A stored line carries the code and name as they were when it was written.
  // Report the account's CURRENT code and name, so a renumbered or renamed
  // account shows the same way in the journals and ledgers as in the chart.
  const live = (id: string, code: string, name: string): Ref => {
    const a = byId.get(id);
    return a ? { accountId: a.id, accountCode: a.code, accountName: a.name } : { accountId: id, accountCode: code, accountName: name };
  };
  // Map a payment's deposit account (by name) to a COA account, else fall back to Cash in Bank.
  const cashByName = (name: string): Ref => {
    const a = name ? byName.get(name.trim().toLowerCase()) : undefined;
    return a ? { accountId: a.id, accountCode: a.code, accountName: a.name } : std("cash");
  };
  // An account found by its exact name (the POS contra-revenue accounts,
  // created on first use), else the standard fallback.
  const named = (name: string, fallback: keyof typeof STD): Ref => {
    const a = byName.get(name.trim().toLowerCase());
    return a ? { accountId: a.id, accountCode: a.code, accountName: a.name } : std(fallback);
  };
  // An account chosen by id (e.g. per-asset overrides), else the standard fallback.
  const byIdOr = (id: string | undefined, fallback: keyof typeof STD): Ref => {
    const a = id ? byId.get(id) : undefined;
    return a ? { accountId: a.id, accountCode: a.code, accountName: a.name } : std(fallback);
  };
  return { std, cashByName, byIdOr, named, live };
}

/**
 * Every posting in the books: manual journal entries, plus auto-posted sales
 * (accrual) and collections. Invoices and payments are never written into the
 * journal — their ledger impact is derived here so the source data stays clean.
 */
export function allPostings(): Posting[] {
  const { std, cashByName, byIdOr, named, live } = resolver();
  const out: Posting[] = [];

  for (const e of loadEntries()) {
    for (const l of e.lines) {
      out.push({
        date: e.date,
        ...live(l.accountId, l.accountCode, l.accountName),
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        sourceType: "journal",
        source: e.number,
        memo: e.memo || l.description || "",
      });
    }
  }

  for (const inv of loadLiveInvoices()) {
    const t = invoiceTotals(inv);
    // A sales receipt is a cash sale: DR the deposit account, CR Sales, CR Output VAT — no receivable in between.
    if (inv.kind === "receipt") {
      if (t.total <= 0) continue;
      const p = (inv.payments ?? [])[0];
      const who = inv.customerName || "Walk-in";
      out.push({ date: inv.invoiceDate, ...cashByName(p?.accountName ?? ""), debit: r2(t.total), credit: 0, sourceType: "receipt", source: inv.number, memo: `Sales receipt — ${who}` });
      out.push({ date: inv.invoiceDate, ...std("sales"), debit: 0, credit: r2(t.subtotal), sourceType: "receipt", source: inv.number, memo: `Sales — ${who}` });
      if (t.vat > 0) out.push({ date: inv.invoiceDate, ...std("outputVat"), debit: 0, credit: r2(t.vat), sourceType: "receipt", source: inv.number, memo: `Output VAT — ${who}` });
      continue;
    }
    // Sale recognised when invoiced (accrual): DR AR, CR Sales, CR Output VAT.
    if (t.total > 0) {
      out.push({ date: inv.invoiceDate, ...std("ar"), debit: r2(t.total), credit: 0, sourceType: "invoice", source: inv.number, memo: `Invoice — ${inv.customerName}` });
      out.push({ date: inv.invoiceDate, ...std("sales"), debit: 0, credit: r2(t.subtotal), sourceType: "invoice", source: inv.number, memo: `Sales — ${inv.customerName}` });
      if (t.vat > 0)
        out.push({ date: inv.invoiceDate, ...std("outputVat"), debit: 0, credit: r2(t.vat), sourceType: "invoice", source: inv.number, memo: `Output VAT — ${inv.customerName}` });
    }
    // Collection: DR Cash, DR CWT (tax credit), CR AR for the applied amount.
    for (const p of inv.payments ?? []) {
      const cash = Number(p.amount) || 0;
      const cwt = Number(p.taxWithheld) || 0;
      const applied = r2(cash + cwt);
      if (applied <= 0) continue;
      if (cash > 0) out.push({ date: p.date, ...cashByName(p.accountName), debit: cash, credit: 0, sourceType: "payment", source: inv.number, memo: `Collection — ${inv.customerName}` });
      if (cwt > 0) out.push({ date: p.date, ...std("cwt"), debit: cwt, credit: 0, sourceType: "payment", source: inv.number, memo: `CWT (BIR 2307) — ${inv.customerName}` });
      out.push({ date: p.date, ...std("ar"), debit: 0, credit: applied, sourceType: "payment", source: inv.number, memo: `Collection — ${inv.customerName}` });
    }
  }

  for (const exp of loadExpenses()) {
    const t = expenseTotals(exp);
    // Bill recognised when recorded (accrual): DR expense accounts, DR Input VAT, CR Accounts Payable.
    if (t.total > 0) {
      for (const l of exp.lines) {
        const net = expenseLineAmounts(l, exp.amountsAre).net;
        if (net > 0)
          out.push({
            date: exp.date,
            ...live(l.accountId, l.accountCode, l.accountName),
            debit: r2(net),
            credit: 0,
            sourceType: "bill",
            source: exp.number,
            memo: `Expense — ${exp.supplierName}`,
          });
      }
      if (t.vat > 0) out.push({ date: exp.date, ...std("inputVat"), debit: r2(t.vat), credit: 0, sourceType: "bill", source: exp.number, memo: `Input VAT — ${exp.supplierName}` });
      // EWT accrued now (a liability); the supplier payable is the gross less EWT.
      const ewt = ewtAmount(exp);
      if (ewt > 0) out.push({ date: exp.date, ...std("whtPayable"), debit: 0, credit: r2(ewt), sourceType: "bill", source: exp.number, memo: `EWT (BIR 2307) — ${exp.supplierName}` });
      out.push({ date: exp.date, ...std("ap"), debit: 0, credit: r2(t.total - ewt), sourceType: "bill", source: exp.number, memo: `Bill — ${exp.supplierName}` });
    }
    // Bill payment: DR Accounts Payable, CR Cash/bank (cash only — EWT already accrued).
    for (const p of exp.payments ?? []) {
      const cash = Number(p.amount) || 0;
      if (cash <= 0) continue;
      out.push({ date: p.date, ...std("ap"), debit: cash, credit: 0, sourceType: "bill-payment", source: exp.number, memo: `Payment — ${exp.supplierName}` });
      out.push({ date: p.date, ...cashByName(p.accountName), debit: 0, credit: cash, sourceType: "bill-payment", source: exp.number, memo: `Payment — ${exp.supplierName}` });
    }
  }

  // POS Z-readings — cash sales. Tenders in; senior citizen and PWD discounts
  // and returns as contra-revenue; sales net of VAT and output VAT out. The
  // dialog refuses a reading that does not balance, so this always does.
  for (const z of loadPosSales()) {
    const who = `POS ${z.machine}`;
    for (const t of z.tenders) {
      const amt = Number(t.amount) || 0;
      if (amt <= 0) continue;
      out.push({ date: z.date, ...byIdOr(t.accountId, "cash"), debit: r2(amt), credit: 0, sourceType: "pos", source: z.number, memo: `${who} — ${TENDER_LABEL[t.method]}` });
    }
    if (z.scDiscount > 0) out.push({ date: z.date, ...named(SALES_CONTRA.sc, "sales"), debit: r2(z.scDiscount), credit: 0, sourceType: "pos", source: z.number, memo: `${who} — senior citizen discount` });
    if (z.pwdDiscount > 0) out.push({ date: z.date, ...named(SALES_CONTRA.pwd, "sales"), debit: r2(z.pwdDiscount), credit: 0, sourceType: "pos", source: z.number, memo: `${who} — PWD discount` });
    if (z.returns > 0) out.push({ date: z.date, ...named(SALES_CONTRA.returns, "sales"), debit: r2(z.returns), credit: 0, sourceType: "pos", source: z.number, memo: `${who} — returns and voids` });
    const net = r2((Number(z.vatable) || 0) + (Number(z.exempt) || 0) + (Number(z.zeroRated) || 0));
    if (net > 0) out.push({ date: z.date, ...std("sales"), debit: 0, credit: net, sourceType: "pos", source: z.number, memo: `${who} — Z-reading sales` });
    if (z.vat > 0) out.push({ date: z.date, ...std("outputVat"), debit: 0, credit: r2(z.vat), sourceType: "pos", source: z.number, memo: `${who} — output VAT` });
  }

  // Monthly straight-line depreciation, derived from the fixed-asset register
  // (full life — reports bound it by their own To date).
  for (const fa of loadAssets()) {
    const depExp = byIdOr(fa.depExpenseId, "depExpense");
    const accum = byIdOr(fa.accumDepId, "accumDep");
    for (const m of depSchedule(fa)) {
      out.push({ date: m.date, ...depExp, debit: m.amount, credit: 0, sourceType: "depreciation", source: fa.number, memo: `Depreciation — ${fa.name}` });
      out.push({ date: m.date, ...accum, debit: 0, credit: m.amount, sourceType: "depreciation", source: fa.number, memo: `Depreciation — ${fa.name}` });
    }
  }

  return out;
}

const byDate = (a: Posting, b: Posting) => a.date.localeCompare(b.date) || a.source.localeCompare(b.source);

export type LedgerRow = Posting & { balance: number };

/** One account's ledger over a period, with opening and closing balances (in normal-balance orientation). */
export function ledgerForAccount(accountId: string, from: string, to: string) {
  const account = loadAccounts().find((a) => a.id === accountId);
  const sign = account && normalBalanceFor(account.type) === "credit" ? -1 : 1;
  const posts = allPostings().filter((p) => p.accountId === accountId);

  let opening = 0;
  for (const p of posts) if (from && p.date < from) opening += sign * (p.debit - p.credit);

  const rows: LedgerRow[] = [];
  let bal = opening;
  for (const p of posts.filter((p) => (!from || p.date >= from) && (!to || p.date <= to)).sort(byDate)) {
    bal += sign * (p.debit - p.credit);
    rows.push({ ...p, balance: r2(bal) });
  }
  return { opening: r2(opening), rows, closing: r2(bal), normalBalance: account ? normalBalanceFor(account.type) : "debit" };
}

/** One entry of the General Journal: its lines, debits first, credits after. */
export type JournalEntryView = {
  key: string;
  date: string;
  source: string;
  sourceType: Posting["sourceType"];
  lines: Posting[];
  debit: number;
  credit: number;
};

/*
 * The General Journal is the book of original entry for whatever the special
 * journals do not carry. This app keeps the four standard ones, and each
 * posting type has exactly one home:
 *
 *   invoice       -> Sales Journal
 *   payment       -> Cash Receipts Journal
 *   pos           -> Sales Journal (the sale) and Cash Receipts Journal (the tenders)
 *   bill          -> Purchase Journal
 *   bill-payment  -> Cash Disbursements Journal
 *
 * What is left — manual entries and monthly depreciation — is the General
 * Journal. Adding any of the four above here would list the same transaction
 * in two books.
 */
const GENERAL_JOURNAL_SOURCES: ReadonlySet<Posting["sourceType"]> = new Set(["journal", "depreciation"]);

/**
 * Postings regrouped into the entries they came from, in date order. Postings
 * are flat, so an entry is rebuilt from (date, type, source): a JE number is
 * unique on its own, and depreciation posts one DR/CR pair per asset per
 * month, which is also what one entry should be.
 */
export function generalJournal(from: string, to: string): JournalEntryView[] {
  const groups = new Map<string, JournalEntryView>();
  for (const p of allPostings()) {
    if (!GENERAL_JOURNAL_SOURCES.has(p.sourceType)) continue;
    if ((from && p.date < from) || (to && p.date > to)) continue;
    const key = `${p.date}|${p.sourceType}|${p.source}`;
    const g = groups.get(key) ?? { key, date: p.date, source: p.source, sourceType: p.sourceType, lines: [], debit: 0, credit: 0 };
    g.lines.push(p);
    g.debit += p.debit;
    g.credit += p.credit;
    groups.set(key, g);
  }
  const entries = [...groups.values()];
  for (const g of entries) {
    // Journal form: debits above credits. Stable, so emission order survives within each side.
    g.lines = [...g.lines.filter((l) => l.debit > 0), ...g.lines.filter((l) => !(l.debit > 0))];
    g.debit = r2(g.debit);
    g.credit = r2(g.credit);
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date) || a.source.localeCompare(b.source, undefined, { numeric: true }));
}

export type TrialBalanceRow = { accountId: string; code: string; name: string; debit: number; credit: number };

/** Net balance of every account with activity as of a date, in debit/credit columns. */
export function trialBalance(asOf: string) {
  const agg = new Map<string, { code: string; name: string; net: number }>();
  for (const p of allPostings()) {
    if (asOf && p.date > asOf) continue;
    const cur = agg.get(p.accountId) ?? { code: p.accountCode, name: p.accountName, net: 0 };
    cur.net += p.debit - p.credit;
    agg.set(p.accountId, cur);
  }
  const rows: TrialBalanceRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;
  for (const [accountId, v] of agg) {
    const net = r2(v.net);
    if (Math.abs(net) < 0.005) continue;
    const debit = net > 0 ? net : 0;
    const credit = net < 0 ? -net : 0;
    totalDebit += debit;
    totalCredit += credit;
    rows.push({ accountId, code: v.code, name: v.name, debit, credit });
  }
  rows.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  return { rows, totalDebit: r2(totalDebit), totalCredit: r2(totalCredit), balanced: Math.abs(totalDebit - totalCredit) < 0.005 };
}
