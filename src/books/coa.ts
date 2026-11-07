// Copied from the web app (src/lib/coa.ts) by scripts/sync-books.mjs — edit it there, not here.
import { Rec, queuePush, stampChanged } from "@/books/sync";
import { ensureLineItems, lineItemOf, sectionOf } from "@/books/lineItems";

/**
 * Chart of Accounts — the master list of ledger accounts. Foundation for the
 * journal / general ledger and, later, the financial statements.
 */
export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
export type NormalBalance = "debit" | "credit";

export type Account = {
  id: string;
  code: string; // account number, e.g. "1000"
  name: string;
  type: AccountType;
  /**
   * The PFRS-for-SMEs line item this account reports under (see lineItems.ts).
   * Optional only for records written before line items existed; loadAccounts
   * fills it in, so everywhere downstream can rely on lineItemOf().
   */
  lineItem?: string;
  category: string; // legacy grouping label, now derived from the line item — kept for search and older records
  parentId?: string; // roll this sub-account up under a parent in the ledger
  cash?: boolean; // a cash/bank account — offered as a "Deposit to" on payments
  description?: string;
  archived?: boolean;
  createdAt: string;
};

/**
 * Cash & bank accounts (the "Deposit to" list, and cash on the cash flow):
 * flagged, or filed under Cash and cash equivalents. Not a name pattern any
 * more — "Cash Advances to Employees" is a receivable, and matching it on
 * the word would have offered it as a deposit account and dropped it from
 * working capital.
 */
export const isCashAccount = (a: Account) =>
  a.type === "asset" && !a.archived && (a.cash === true || lineItemOf(a).id === "cash");

const KEY = "ath:coa";

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Assets and expenses increase on the debit side; everything else on the credit side. */
export const normalBalanceFor = (type: AccountType): NormalBalance =>
  type === "asset" || type === "expense" ? "debit" : "credit";

export const TYPE_ORDER: AccountType[] = ["asset", "liability", "equity", "income", "expense"];

export const TYPE_LABEL: Record<AccountType, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  income: "Income",
  expense: "Expenses",
};

const DEFAULTS: Omit<Account, "id" | "createdAt">[] = [
  // Assets
  { code: "1000", name: "Cash on Hand", type: "asset", category: "Current Asset", cash: true },
  { code: "1010", name: "Cash in Bank", type: "asset", category: "Current Asset", cash: true },
  { code: "1200", name: "Accounts Receivable", type: "asset", category: "Current Asset" },
  { code: "1300", name: "Creditable Withholding Tax", type: "asset", category: "Current Asset", description: "CWT credits from customers' BIR 2307" },
  { code: "1400", name: "Inventory", type: "asset", category: "Current Asset" },
  { code: "1500", name: "Input VAT", type: "asset", category: "Current Asset" },
  { code: "1600", name: "Prepaid Expenses", type: "asset", category: "Current Asset" },
  { code: "1700", name: "Property, Plant & Equipment", type: "asset", category: "Non-current Asset" },
  { code: "1710", name: "Accumulated Depreciation", type: "asset", category: "Non-current Asset", description: "Contra-asset" },
  // Liabilities
  { code: "2000", name: "Accounts Payable", type: "liability", category: "Current Liability" },
  { code: "2100", name: "Output VAT", type: "liability", category: "Current Liability" },
  { code: "2200", name: "Withholding Tax Payable - Expanded", type: "liability", category: "Current Liability" },
  { code: "2300", name: "SSS / PhilHealth / Pag-IBIG Payable", type: "liability", category: "Current Liability" },
  { code: "2400", name: "Income Tax Payable", type: "liability", category: "Current Liability" },
  { code: "2500", name: "Loans Payable", type: "liability", category: "Non-current Liability" },
  // Equity
  { code: "3000", name: "Owner's Capital", type: "equity", category: "Equity" },
  { code: "3100", name: "Owner's Drawings", type: "equity", category: "Equity" },
  { code: "3200", name: "Retained Earnings", type: "equity", category: "Equity" },
  // Income
  { code: "4000", name: "Sales / Service Revenue", type: "income", category: "Revenue" },
  { code: "4100", name: "Other Income", type: "income", category: "Other Income" },
  { code: "4200", name: "Interest Income", type: "income", category: "Other Income" },
  // Expenses
  { code: "5000", name: "Cost of Sales", type: "expense", category: "Cost of Sales" },
  { code: "5100", name: "Salaries and Wages", type: "expense", category: "Operating Expense" },
  { code: "5200", name: "Rent Expense", type: "expense", category: "Operating Expense" },
  { code: "5300", name: "Utilities Expense", type: "expense", category: "Operating Expense" },
  { code: "5400", name: "Supplies Expense", type: "expense", category: "Operating Expense" },
  { code: "5500", name: "Depreciation Expense", type: "expense", category: "Operating Expense" },
  { code: "5600", name: "Taxes and Licenses", type: "expense", category: "Operating Expense" },
  { code: "5700", name: "Professional Fees", type: "expense", category: "Operating Expense" },
  { code: "5800", name: "Transportation and Travel", type: "expense", category: "Operating Expense" },
  { code: "5900", name: "Miscellaneous Expense", type: "expense", category: "Operating Expense" },
];

/** Load accounts, seeding the standard PH small-business chart the first time. */
export function loadAccounts(): Account[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      /*
       * Records from before line items existed get one here, silently. Not
       * through saveAccounts: that would stamp every record "now", and on a
       * device that has not synced yet "every record" is the seed — which
       * would then outrank the owner's real chart on the server (the same
       * hazard the seeding below avoids). The migration is deterministic, so
       * every device reaches the same result on its own.
       */
      const { list, changed } = ensureLineItems(JSON.parse(raw) as Account[]);
      if (changed) localStorage.setItem(KEY, JSON.stringify(list));
      return list;
    }
  } catch {
    /* fall through to seed */
  }
  /*
   * Seed the default chart WITHOUT stamping or pushing it.
   *
   * On a second device this runs before the first sync lands. Stamping the
   * seed with "now" would make it newer than the real chart on the server, so
   * the merge would prefer these defaults and overwrite accounts the owner had
   * renamed, archived or added — then push that back up. Writing the seed at
   * updatedAt 0 means any server copy always wins, while a genuinely new
   * account (empty server) still gets pushed by the first sync, because the
   * shadow starts empty and every record counts as unsent.
   */
  const seeded = ensureLineItems(
    DEFAULTS.map((a) => ({
      ...a,
      id: `acct-${a.code}`,
      createdAt: new Date().toISOString(),
      updatedAt: 0,
    })) as Account[]
  ).list;
  localStorage.setItem(KEY, JSON.stringify(seeded));
  return seeded;
}

export function saveAccounts(list: Account[]) {
  if (typeof window === "undefined") return;
  // Local first, then pushed in the background — see lib/sync.ts.
  const stamped = stampChanged("coa", list as unknown as Rec[]);
  localStorage.setItem(KEY, JSON.stringify(stamped));
  queuePush("coa", stamped);
}

export function upsertAccount(a: Account): Account[] {
  const list = loadAccounts();
  const i = list.findIndex((x) => x.id === a.id);
  if (i >= 0) list[i] = a;
  else list.push(a);
  saveAccounts(list);
  return list;
}

export function deleteAccount(id: string): Account[] {
  const list = loadAccounts().filter((a) => a.id !== id);
  saveAccounts(list);
  return list;
}

export const getAccount = (id: string): Account | null => loadAccounts().find((a) => a.id === id) || null;

/** Sort by account code, numerically where possible. */
export const byCode = (a: Account, b: Account) =>
  a.code.localeCompare(b.code, undefined, { numeric: true });

/** Accounts that can be a parent for a sub-account on the same line item (top-level, not self). */
export const parentOptions = (accounts: Account[], type: AccountType, lineItem: string, selfId?: string) =>
  accounts.filter((a) => a.type === type && a.lineItem === lineItem && !a.parentId && !a.archived && a.id !== selfId).sort(byCode);

/**
 * Order accounts for display: each parent followed by its children (indented),
 * with a `depth` for rendering. Only one level of nesting is supported.
 */
export function withHierarchy(accounts: Account[]): { account: Account; depth: number }[] {
  const tops = accounts.filter((a) => !a.parentId || !accounts.some((p) => p.id === a.parentId)).sort(byCode);
  const out: { account: Account; depth: number }[] = [];
  for (const t of tops) {
    out.push({ account: t, depth: 0 });
    for (const c of accounts.filter((a) => a.parentId === t.id).sort(byCode)) out.push({ account: c, depth: 1 });
  }
  return out;
}

/* ---- Property & equipment ----
 * Shared by the fixed-asset register and the acquisition flow so both agree on
 * exactly which accounts count as capitalisable PPE cost accounts.
 */

export const nonCurrentAssets = (list: Account[]) => list.filter((a) => a.type === "asset" && sectionOf(a) === "non-current-asset");

export const isAccumLike = (a: Account) => /accum/i.test(a.name);

/** PPE cost accounts are the sub-accounts — never the mother account, never accumulated depreciation. */
export const ppeCostAccounts = (list: Account[]) => {
  const parents = new Set(list.map((a) => a.parentId).filter(Boolean));
  return nonCurrentAssets(list).filter(
    (a) => !isAccumLike(a) && !parents.has(a.id) && !(!a.parentId && (a.code === "1700" || /property|plant|ppe/i.test(a.name)))
  );
};

export const accumAccounts = (list: Account[]) => {
  const hits = nonCurrentAssets(list).filter(isAccumLike);
  return hits.length ? hits : nonCurrentAssets(list);
};
