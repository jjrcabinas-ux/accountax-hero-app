// Copied from the web app (src/lib/statements.ts) by scripts/sync-books.mjs — edit it there, not here.
import { Account, AccountType, isCashAccount, loadAccounts, normalBalanceFor } from "@/books/coa";
import { LINE_ITEMS, LINE_ITEM_BY_ID, LineItem, Section, assignLineItem, lineItemOf } from "@/books/lineItems";
import { addDays } from "@/books/invoices";
import { LedgerRow, allPostings, ledgerForAccount } from "@/books/ledger";
import { accumDepAccountIds } from "@/books/assets";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const byCode = (a: { code: string }, b: { code: string }) => a.code.localeCompare(b.code, undefined, { numeric: true });
const sum = (lines: { amount: number }[]) => r2(lines.reduce((s, l) => s + l.amount, 0));

/**
 * A posting whose account can't be found in the current Chart of Accounts
 * (deleted, or a code mismatch the ledger's resolver couldn't work around)
 * must still count — dropping it would silently throw the statements out of
 * balance. Infer the type from the account-code convention this app seeds
 * (1xxx asset … 5xxx+ expense) and file it under a line item the same way a
 * legacy record is, so it lands in a sane place instead of vanishing.
 */
function inferAccount(code: string, name: string): Account {
  const lead = code.trim().charAt(0);
  const type: AccountType = lead === "1" ? "asset" : lead === "2" ? "liability" : lead === "3" ? "equity" : lead === "4" ? "income" : "expense";
  const base = { id: `missing-${code || name}`, code: code || "9999", name, type, category: "", createdAt: "" };
  return { ...base, lineItem: assignLineItem(base) };
}

/* ---- Statement lines ----
 * StmtLine is an account-level line (the cash flow, the dashboard and the
 * ledger-style helpers). LineAmt is a line-item-level line — what the face of
 * the SFP and SCI is made of.
 */
export type StmtLine = { id: string; code: string; name: string; amount: number; /** the line item the account files under */ lineItemId?: string };
export type LineAmt = { id: string; label: string; amount: number };

/** Union of plain statement lines across periods, one value per period (no parent roll-up). */
export function unionCompare(sets: StmtLine[][]): { id: string; code: string; name: string; amounts: number[] }[] {
  const meta = new Map<string, { code: string; name: string }>();
  const vals = new Map<string, number[]>();
  sets.forEach((lines, i) => {
    for (const l of lines) {
      if (!meta.has(l.id)) meta.set(l.id, { code: l.code, name: l.name });
      const arr = vals.get(l.id) ?? Array(sets.length).fill(0);
      arr[i] = l.amount;
      vals.set(l.id, arr);
    }
  });
  return [...meta.entries()]
    .map(([id, m]) => ({ id, ...m, amounts: vals.get(id)! }))
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}

/**
 * Line items across comparison periods, in catalogue order, one value per
 * period. A line item that is zero in every period is dropped — that is the
 * "hide if not used" rule for the face of the statements.
 */
export function compareLines(sets: LineAmt[][]): { id: string; label: string; amounts: number[] }[] {
  const order = new Map(LINE_ITEMS.map((li, i) => [li.id, i]));
  const meta = new Map<string, string>();
  const vals = new Map<string, number[]>();
  sets.forEach((lines, i) => {
    for (const l of lines) {
      if (!meta.has(l.id)) meta.set(l.id, l.label);
      const arr = vals.get(l.id) ?? Array(sets.length).fill(0);
      arr[i] = l.amount;
      vals.set(l.id, arr);
    }
  });
  return [...meta.entries()]
    .map(([id, label]) => ({ id, label, amounts: vals.get(id)! }))
    .filter((r) => r.amounts.some((v) => Math.abs(v) > 0.005))
    .sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
}

/** Net movement (debit − credit) per account for postings within [from, to]. */
function aggregate(from: string, to: string) {
  const accounts = loadAccounts();
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const byCodeMap = new Map(accounts.map((a) => [a.code, a]));
  const m = new Map<string, { account: Account; net: number }>();
  for (const p of allPostings()) {
    if (from && p.date < from) continue;
    if (to && p.date > to) continue;
    const acct = byId.get(p.accountId) ?? byCodeMap.get(p.accountCode) ?? inferAccount(p.accountCode, p.accountName);
    const cur = m.get(acct.id) ?? { account: acct, net: 0 };
    cur.net += p.debit - p.credit;
    m.set(acct.id, cur);
  }
  return m;
}

/** Balance in the account's natural (positive) orientation. */
const natural = (a: Account, net: number) => r2(normalBalanceFor(a.type) === "debit" ? net : -net);

/** Cash for the cash-flow statement: flagged/named cash accounts, and anything filed under Cash and cash equivalents. */
const isCash = (a: Account) => isCashAccount(a) || lineItemOf(a).id === "cash";

const linesIn = (amounts: Map<string, number>, pick: (li: LineItem) => boolean): LineAmt[] =>
  LINE_ITEMS.filter(pick).map((li) => ({ id: li.id, label: li.label, amount: amounts.get(li.id) ?? 0 })).filter((l) => Math.abs(l.amount) > 0.005);

const sectionTotal = (amounts: Map<string, number>, ...sections: Section[]) =>
  r2(LINE_ITEMS.filter((li) => sections.includes(li.section)).reduce((s, li) => s + (amounts.get(li.id) ?? 0), 0));

/* ---- Statement of Comprehensive Income (Section 5) ---- */

export function incomeStatement(from: string, to: string) {
  // Account-level lines are still what the dashboard names ("main reason:
  // Rent Expense"); the face of the statement is built from the line items.
  const revenue: StmtLine[] = [];
  const cos: StmtLine[] = [];
  const opex: StmtLine[] = [];
  const a = new Map<string, number>();
  for (const { account, net } of aggregate(from, to).values()) {
    if (account.type !== "income" && account.type !== "expense") continue;
    const amount = natural(account, net);
    if (Math.abs(amount) < 0.005) continue;
    const li = lineItemOf(account);
    a.set(li.id, r2((a.get(li.id) ?? 0) + amount));
    const line: StmtLine = { id: account.id, code: account.code, name: account.name, amount, lineItemId: li.id };
    if (account.type === "income") revenue.push(line);
    else if (li.id === "cost-of-sales") cos.push(line);
    else opex.push(line);
  }
  revenue.sort(byCode);
  cos.sort(byCode);
  opex.sort(byCode);

  const t = (s: Section) => sectionTotal(a, s);
  const totalRevenue = t("revenue");
  const totalCOS = t("cost-of-sales");
  const grossProfit = r2(totalRevenue - totalCOS);
  const otherOperatingIncome = t("other-operating-income");
  const distributionCosts = t("distribution-costs");
  const adminExpenses = t("administrative-expenses");
  const otherOpex = t("other-operating-expenses");
  const operatingProfit = r2(grossProfit + otherOperatingIncome - distributionCosts - adminExpenses - otherOpex);
  const financeIncome = t("finance-income");
  const financeCosts = t("finance-costs");
  const associates = t("associates"); // credit-natural: a share of loss comes through negative
  const profitBeforeTax = r2(operatingProfit + financeIncome - financeCosts + associates);
  const incomeTax = t("income-tax");
  const discontinued = t("discontinued");
  const netIncome = r2(profitBeforeTax - incomeTax + discontinued);
  const oci = linesIn(a, (li) => li.section === "oci");
  const totalOci = sum(oci);
  const totalComprehensiveIncome = r2(netIncome + totalOci);

  return {
    /* line items with a balance, by section, for the face of the statement */
    lines: {
      revenue: linesIn(a, (li) => li.section === "revenue"),
      cos: linesIn(a, (li) => li.section === "cost-of-sales"),
      otherOperatingIncome: linesIn(a, (li) => li.section === "other-operating-income"),
      operatingExpenses: linesIn(a, (li) => ["distribution-costs", "administrative-expenses", "other-operating-expenses"].includes(li.section)),
      oci,
    },
    /* account-level lines */
    revenue,
    cos,
    opex,
    /* subtotals in statement order */
    totalRevenue,
    totalCOS,
    grossProfit,
    otherOperatingIncome,
    distributionCosts,
    adminExpenses,
    otherOpex,
    operatingProfit,
    financeIncome,
    financeCosts,
    associates,
    profitBeforeTax,
    incomeTax,
    discontinued,
    netIncome,
    totalOci,
    totalComprehensiveIncome,
    /* every expense below cost of sales — what the dashboard's Expenses tile adds to COS */
    totalOpex: r2(distributionCosts + adminExpenses + otherOpex + financeCosts + incomeTax),
  };
}

/* ---- Statement of Financial Position (Section 4) ---- */

export function balanceSheet(asOf: string) {
  const a = new Map<string, number>();
  let income = 0;
  let expense = 0;
  for (const { account, net } of aggregate("", asOf).values()) {
    const amount = natural(account, net);
    const li = lineItemOf(account);
    if (li.section === "oci") {
      // Other comprehensive income accumulates in equity, never in profit:
      // a revaluation to its own surplus, the other three items to retained earnings.
      const eq = li.id === "oci-revaluation" ? "revaluation-surplus" : "retained-earnings";
      a.set(eq, r2((a.get(eq) ?? 0) + amount));
    } else if (account.type === "income") income += amount;
    else if (account.type === "expense") expense += amount;
    else a.set(li.id, r2((a.get(li.id) ?? 0) + amount));
  }
  /*
   * The books are never formally closed, so profit since inception lives in
   * the income and expense accounts. On the face of the statement it belongs
   * in retained earnings — the one line item, not a synthetic row beside the
   * retained-earnings accounts — so the plug is folded into that line here.
   */
  const netIncome = r2(income - expense);
  a.set("retained-earnings", r2((a.get("retained-earnings") ?? 0) + netIncome));

  const currentAssets = linesIn(a, (li) => li.section === "current-asset");
  const nonCurrentAssets = linesIn(a, (li) => li.section === "non-current-asset");
  const currentLiab = linesIn(a, (li) => li.section === "current-liability");
  const nonCurrentLiab = linesIn(a, (li) => li.section === "non-current-liability");
  const equity = linesIn(a, (li) => li.section === "equity");

  const totalCurrentAssets = sectionTotal(a, "current-asset");
  const totalNonCurrentAssets = sectionTotal(a, "non-current-asset");
  const totalAssets = r2(totalCurrentAssets + totalNonCurrentAssets);
  const totalCurrentLiab = sectionTotal(a, "current-liability");
  const totalNonCurrentLiab = sectionTotal(a, "non-current-liability");
  const totalLiabilities = r2(totalCurrentLiab + totalNonCurrentLiab);
  const totalEquity = sectionTotal(a, "equity");
  const totalLiabAndEquity = r2(totalLiabilities + totalEquity);
  return {
    currentAssets,
    nonCurrentAssets,
    currentLiab,
    nonCurrentLiab,
    equity,
    netIncome,
    totalCurrentAssets,
    totalNonCurrentAssets,
    totalAssets,
    totalCurrentLiab,
    totalNonCurrentLiab,
    totalLiabilities,
    totalEquity,
    totalLiabAndEquity,
    balanced: Math.abs(totalAssets - totalLiabAndEquity) < 0.005,
  };
}

/* ---- Statement of Changes in Equity (Section 6) ---- */

const CAPITAL_ITEMS = new Set(["share-capital", "subscribed-capital", "share-premium", "deposits-subscriptions"]);
const DISTRIBUTION_ITEMS = new Set(["retained-earnings", "treasury-shares"]);

export function changesInEquity(from: string, to: string) {
  const beginning = from ? balanceSheet(addDays(from, -1)).totalEquity : 0;
  const ending = balanceSheet(to).totalEquity;
  const netIncome = incomeStatement(from, to).netIncome;
  let cap = 0;
  let dist = 0;
  for (const { account, net } of aggregate(from, to).values()) {
    if (account.type !== "equity") continue;
    const li = lineItemOf(account).id;
    if (CAPITAL_ITEMS.has(li)) cap += net; // capital is credited in: debit − credit is negative
    else if (DISTRIBUTION_ITEMS.has(li)) dist += net; // drawings, dividends, buy-backs are debits
  }
  const investments = r2(-cap);
  const drawings = r2(dist);
  // Whatever else moved equity — other comprehensive income, prior-period
  // corrections, revaluation — lands here rather than being lost.
  const other = r2(ending - beginning - netIncome - investments + drawings);
  return { beginning, netIncome, investments, drawings, other, ending };
}

/* ---- Statement of Cash Flows (Section 7, indirect method) ---- */

function cashBalance(asOf: string) {
  let s = 0;
  for (const { account, net } of aggregate("", asOf).values()) if (isCash(account)) s += net;
  return r2(s);
}

export function cashFlow(from: string, to: string) {
  const netIncome = incomeStatement(from, to).netIncome;
  const accumIds = accumDepAccountIds(loadAccounts());
  // One line per line item, so the statement reads "increase in Trade and
  // other receivables" rather than one line per account.
  const buckets: Record<"operating" | "investing" | "financing", Map<string, StmtLine>> = { operating: new Map(), investing: new Map(), financing: new Map() };
  const add = (b: keyof typeof buckets, id: string, code: string, name: string, amount: number) => {
    const cur = buckets[b].get(id) ?? { id, code, name, amount: 0 };
    cur.amount = r2(cur.amount + amount);
    buckets[b].set(id, cur);
  };
  for (const { account, net } of aggregate(from, to).values()) {
    if (isCash(account) || account.type === "income" || account.type === "expense") continue;
    const amount = r2(-net); // cash effect = credit − debit
    if (Math.abs(amount) < 0.005) continue;
    // Accumulated depreciation is the non-cash add-back, wherever it's named
    // — kept as its own operating line so the page can label it as such.
    if (account.type === "asset" && (accumIds.has(account.id) || /accumulated deprec/i.test(account.name))) {
      add("operating", "accum-dep", "1710", "Accumulated depreciation", amount);
      continue;
    }
    const li = lineItemOf(account);
    const b = li.cf === "cash" ? "operating" : li.cf;
    add(b, li.id, String(li.range[0]), li.label, amount);
  }
  const strip = (m: Map<string, StmtLine>) => [...m.values()].filter((l) => Math.abs(l.amount) > 0.005).sort(byCode);
  const operating = strip(buckets.operating);
  const investing = strip(buckets.investing);
  const financing = strip(buckets.financing);
  const operatingTotal = r2(netIncome + sum(operating));
  const investingTotal = sum(investing);
  const financingTotal = sum(financing);
  const netChange = r2(operatingTotal + investingTotal + financingTotal);
  const beginCash = from ? cashBalance(addDays(from, -1)) : 0;
  const endCash = cashBalance(to);
  return {
    netIncome,
    operating,
    operatingTotal,
    investing,
    investingTotal,
    financing,
    financingTotal,
    netChange,
    beginCash,
    endCash,
    ties: Math.abs(beginCash + netChange - endCash) < 0.05,
  };
}

/* ---- Drill-down: the accounts behind one line item ---- */

export type LineLedger = {
  item: LineItem;
  /** Every account filed under the line item that has a balance or activity in the window, with its ledger. */
  accounts: { account: Account; opening: number; movement: number; closing: number; rows: LedgerRow[] }[];
  /** Amounts on the line that no account holds — profit since inception folded into Retained earnings. */
  extra: { label: string; amount: number }[];
  /** What the statement printed for this line: closing balances (balance) or period movement (movement). */
  total: number;
};

/**
 * What sits behind an amount on the face of a statement. A line item is the
 * sum of its accounts, so this is each of those accounts' ledger over the
 * period — opening, postings, closing — in the same natural orientation the
 * statement uses, and a total that ties back to the figure that was clicked.
 * Retained earnings also carries profit since inception (the books are never
 * formally closed); that part is reported as an extra row, not an account.
 */
export function lineItemLedger(lineItemId: string, from: string, to: string, basis: "balance" | "movement"): LineLedger {
  const item = LINE_ITEM_BY_ID.get(lineItemId)!;
  const accounts = loadAccounts()
    .filter((a) => lineItemOf(a).id === lineItemId)
    .map((account) => {
      const l = ledgerForAccount(account.id, from, to);
      return { account, opening: l.opening, closing: l.closing, movement: r2(l.closing - l.opening), rows: l.rows };
    })
    .filter((a) => a.rows.length > 0 || Math.abs(a.opening) > 0.005 || Math.abs(a.closing) > 0.005)
    .sort((x, y) => byCode(x.account, y.account));
  const extra: { label: string; amount: number }[] = [];
  if (lineItemId === "retained-earnings" && basis === "balance") {
    const profit = incomeStatement("", to).netIncome;
    if (Math.abs(profit) > 0.005) extra.push({ label: "Profit since inception, not yet closed to retained earnings", amount: profit });
  }
  const total = r2(accounts.reduce((s, a) => s + (basis === "balance" ? a.closing : a.movement), 0) + extra.reduce((s, x) => s + x.amount, 0));
  return { item, accounts, extra, total };
}
