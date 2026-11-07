// Copied from the web app (src/lib/lineItems.ts) by scripts/sync-books.mjs — edit it there, not here.
import type { Account, AccountType } from "@/books/coa";

/*
 * ============================================================
 * Financial-statement line items — PFRS for SMEs.
 *
 * The statements are built from a FIXED catalogue of line items (Section 4.2
 * for the Statement of Financial Position, Section 5.5 for the Statement of
 * Comprehensive Income). The owner never edits this list: an account is filed
 * under exactly one line item, the statements present line items — not
 * accounts — on their face, and a line item that has nothing under it simply
 * does not print. That is what makes two different SMEs' statements
 * comparable and what keeps the face of the statement to the minimum items
 * the standard asks for; account-level detail belongs to the ledger, the
 * trial balance and the notes.
 *
 * Each line item also owns a block of account numbers, so a new account's
 * code is assigned, not typed: the code range is what keeps the chart
 * navigable as it grows, and it means a code alone tells you where an
 * account lands on the statements. Ranges were laid out around the seeded
 * chart so every default account already sits inside its own block.
 *
 * `cf` is the account's home on the indirect-method cash flow: which line
 * items are working capital (operating), which are investment in the
 * business (investing) and which are how it is funded (financing).
 * ============================================================
 */

export type Section =
  | "current-asset"
  | "non-current-asset"
  | "current-liability"
  | "non-current-liability"
  | "equity"
  | "revenue"
  | "cost-of-sales"
  | "other-operating-income"
  | "distribution-costs"
  | "administrative-expenses"
  | "other-operating-expenses"
  | "finance-income"
  | "finance-costs"
  | "associates"
  | "income-tax"
  | "discontinued"
  | "oci";

export type CashFlowClass = "cash" | "operating" | "investing" | "financing";

export type LineItem = {
  id: string;
  label: string;
  type: AccountType;
  section: Section;
  /** Inclusive block of account numbers new accounts under this item draw from. */
  range: [number, number];
  cf: CashFlowClass;
  /** PFRS for SMEs paragraph, where the item is a mandated minimum. */
  ref?: string;
  note?: string;
};

export const SECTION_LABEL: Record<Section, string> = {
  "current-asset": "Current assets",
  "non-current-asset": "Non-current assets",
  "current-liability": "Current liabilities",
  "non-current-liability": "Non-current liabilities",
  equity: "Equity",
  revenue: "Revenue",
  "cost-of-sales": "Cost of sales",
  "other-operating-income": "Other operating income",
  "distribution-costs": "Distribution costs",
  "administrative-expenses": "Administrative expenses",
  "other-operating-expenses": "Other operating expenses",
  "finance-income": "Finance income",
  "finance-costs": "Finance costs",
  associates: "Share in profit or loss of associates and jointly controlled entities",
  "income-tax": "Income tax expense",
  discontinued: "Discontinued operations",
  oci: "Other comprehensive income",
};

/* Presentation order is the array order: SFP top to bottom, then SCI. */
export const LINE_ITEMS: LineItem[] = [
  /* ---- Current assets ---- */
  { id: "cash", label: "Cash and cash equivalents", type: "asset", section: "current-asset", range: [1000, 1099], cf: "cash", ref: "4.2(a)" },
  { id: "financial-assets", label: "Financial assets", type: "asset", section: "current-asset", range: [1100, 1199], cf: "investing", ref: "4.2(c)", note: "Other than cash, receivables and equity-method investments" },
  { id: "receivables", label: "Trade and other receivables", type: "asset", section: "current-asset", range: [1200, 1299], cf: "operating", ref: "4.2(b)" },
  { id: "current-tax-asset", label: "Current tax asset", type: "asset", section: "current-asset", range: [1300, 1349], cf: "operating", ref: "4.2(n)", note: "Creditable withholding tax and other income-tax credits" },
  { id: "bio-fvtpl", label: "Biological assets at fair value through profit or loss", type: "asset", section: "current-asset", range: [1350, 1399], cf: "operating", ref: "4.2(i)" },
  { id: "inventories", label: "Inventories", type: "asset", section: "current-asset", range: [1400, 1499], cf: "operating", ref: "4.2(d)" },
  { id: "prepayments", label: "Prepayments and other current assets", type: "asset", section: "current-asset", range: [1500, 1699], cf: "operating", note: "Prepaid expenses, input VAT, advances" },

  /* ---- Non-current assets ---- */
  { id: "ppe", label: "Property, plant and equipment", type: "asset", section: "non-current-asset", range: [1700, 1799], cf: "investing", ref: "4.2(e)", note: "Cost accounts and their accumulated depreciation" },
  { id: "investment-property", label: "Investment property at fair value through profit or loss", type: "asset", section: "non-current-asset", range: [1800, 1849], cf: "investing", ref: "4.2(f)" },
  { id: "bio-cost", label: "Biological assets at cost less accumulated depreciation and impairment", type: "asset", section: "non-current-asset", range: [1850, 1869], cf: "investing", ref: "4.2(h)" },
  { id: "intangibles", label: "Intangible assets", type: "asset", section: "non-current-asset", range: [1870, 1899], cf: "investing", ref: "4.2(g)" },
  { id: "associates-inv", label: "Investments in associates", type: "asset", section: "non-current-asset", range: [1900, 1919], cf: "investing", ref: "4.2(j)" },
  { id: "jce-inv", label: "Investments in jointly controlled entities", type: "asset", section: "non-current-asset", range: [1920, 1939], cf: "investing", ref: "4.2(k)" },
  { id: "deferred-tax-asset", label: "Deferred tax asset", type: "asset", section: "non-current-asset", range: [1940, 1959], cf: "operating", ref: "4.2(o)" },
  { id: "other-nca", label: "Other non-current assets", type: "asset", section: "non-current-asset", range: [1960, 1999], cf: "investing" },

  /* ---- Current liabilities ---- */
  { id: "trade-payables", label: "Trade and other payables", type: "liability", section: "current-liability", range: [2000, 2399], cf: "operating", ref: "4.2(l)", note: "Trade payables, accruals, statutory payables (VAT, withholding, SSS/PhilHealth/Pag-IBIG), deferred income" },
  { id: "current-tax-liability", label: "Current tax liability", type: "liability", section: "current-liability", range: [2400, 2449], cf: "operating", ref: "4.2(n)" },
  { id: "provisions", label: "Provisions", type: "liability", section: "current-liability", range: [2450, 2499], cf: "operating", ref: "4.2(p)" },
  { id: "financial-liabilities", label: "Financial liabilities", type: "liability", section: "current-liability", range: [2600, 2649], cf: "financing", ref: "4.2(m)", note: "Loans and notes payable, current portion of long-term debt" },
  { id: "lease-current", label: "Lease liabilities — current portion", type: "liability", section: "current-liability", range: [2650, 2699], cf: "financing" },
  { id: "other-cl", label: "Other current liabilities", type: "liability", section: "current-liability", range: [2700, 2749], cf: "operating" },

  /* ---- Non-current liabilities ---- */
  { id: "loans-noncurrent", label: "Loans payable — net of current portion", type: "liability", section: "non-current-liability", range: [2500, 2599], cf: "financing" },
  { id: "lease-noncurrent", label: "Lease liabilities — net of current portion", type: "liability", section: "non-current-liability", range: [2750, 2799], cf: "financing" },
  { id: "retirement", label: "Retirement benefit obligation", type: "liability", section: "non-current-liability", range: [2800, 2849], cf: "operating" },
  { id: "deferred-tax-liability", label: "Deferred tax liability", type: "liability", section: "non-current-liability", range: [2850, 2899], cf: "operating", ref: "4.2(o)" },
  { id: "provisions-noncurrent", label: "Provisions — non-current portion", type: "liability", section: "non-current-liability", range: [2900, 2949], cf: "operating", ref: "4.2(p)" },

  /* ---- Equity ---- */
  { id: "share-capital", label: "Share capital", type: "equity", section: "equity", range: [3000, 3099], cf: "financing", ref: "4.2(r)", note: "Owner's capital for a sole proprietorship or partnership" },
  { id: "subscribed-capital", label: "Subscribed share capital, net of subscriptions receivable", type: "equity", section: "equity", range: [3100, 3149], cf: "financing" },
  { id: "share-premium", label: "Share premium", type: "equity", section: "equity", range: [3150, 3199], cf: "financing" },
  { id: "retained-earnings", label: "Retained earnings", type: "equity", section: "equity", range: [3200, 3299], cf: "financing", note: "Appropriated and unappropriated; drawings and dividends are filed here" },
  { id: "deposits-subscriptions", label: "Deposits for future stock subscriptions", type: "equity", section: "equity", range: [3300, 3349], cf: "financing" },
  { id: "revaluation-surplus", label: "Revaluation surplus", type: "equity", section: "equity", range: [3350, 3399], cf: "financing", note: "Only under the revaluation model for PPE" },
  { id: "treasury-shares", label: "Treasury shares", type: "equity", section: "equity", range: [3400, 3449], cf: "financing" },
  { id: "nci", label: "Non-controlling interests", type: "equity", section: "equity", range: [3450, 3499], cf: "financing", ref: "4.2(q)", note: "Consolidated statements only" },

  /* ---- Statement of Comprehensive Income ---- */
  { id: "revenue", label: "Revenue", type: "income", section: "revenue", range: [4000, 4099], cf: "operating", ref: "5.5(a)" },
  { id: "cost-of-sales", label: "Cost of sales / cost of services", type: "expense", section: "cost-of-sales", range: [5000, 5099], cf: "operating" },
  { id: "other-operating-income", label: "Other operating income", type: "income", section: "other-operating-income", range: [4100, 4199], cf: "operating" },
  { id: "distribution-costs", label: "Distribution costs", type: "expense", section: "distribution-costs", range: [6000, 6499], cf: "operating", note: "Selling, marketing, delivery" },
  { id: "admin-expenses", label: "Administrative expenses", type: "expense", section: "administrative-expenses", range: [5100, 5999], cf: "operating" },
  { id: "other-opex", label: "Other operating expenses", type: "expense", section: "other-operating-expenses", range: [6500, 6999], cf: "operating" },
  { id: "finance-income", label: "Finance income", type: "income", section: "finance-income", range: [4200, 4299], cf: "operating" },
  { id: "finance-costs", label: "Finance costs", type: "expense", section: "finance-costs", range: [7000, 7199], cf: "operating", ref: "5.5(b)" },
  { id: "associates", label: "Share in profit or loss of associates and jointly controlled entities", type: "income", section: "associates", range: [4300, 4349], cf: "operating", ref: "5.5(c)", note: "Equity method; a loss is entered as a debit" },
  { id: "income-tax", label: "Income tax expense", type: "expense", section: "income-tax", range: [7500, 7599], cf: "operating", ref: "5.5(d)" },
  { id: "discontinued", label: "Discontinued operations", type: "income", section: "discontinued", range: [7900, 7999], cf: "operating", ref: "5.5(e)", note: "Single line: post-tax result plus post-tax gain or loss on disposal" },
  /* OCI — the only four items the standard lets an SME put here. */
  { id: "oci-fx", label: "Exchange differences on translating a foreign operation", type: "income", section: "oci", range: [4400, 4419], cf: "operating" },
  { id: "oci-actuarial", label: "Remeasurement gains and losses on defined benefit plans", type: "income", section: "oci", range: [4420, 4439], cf: "operating" },
  { id: "oci-hedging", label: "Changes in fair value of hedging instruments", type: "income", section: "oci", range: [4440, 4459], cf: "operating" },
  { id: "oci-revaluation", label: "Revaluation surplus on property, plant and equipment", type: "income", section: "oci", range: [4460, 4479], cf: "operating" },
];

export const LINE_ITEM_BY_ID = new Map(LINE_ITEMS.map((li) => [li.id, li]));

export const lineItemsFor = (type: AccountType) => LINE_ITEMS.filter((li) => li.type === type);

export const fmtRange = (li: LineItem) => `${li.range[0]}–${li.range[1]}`;

/**
 * The legacy free-text `category` an account used to carry, derived from its
 * line item. Kept populated because the string is still read in a few places
 * (search, older records on other devices) and it costs nothing to keep it
 * truthful.
 */
export function categoryFor(li: LineItem): string {
  switch (li.section) {
    case "current-asset": return "Current Asset";
    case "non-current-asset": return "Non-current Asset";
    case "current-liability": return "Current Liability";
    case "non-current-liability": return "Non-current Liability";
    case "equity": return "Equity";
    case "revenue": return "Revenue";
    case "cost-of-sales": return "Cost of Sales";
    case "other-operating-income":
    case "finance-income":
    case "associates":
    case "discontinued":
    case "oci":
      return "Other Income";
    default:
      return "Operating Expense";
  }
}

type Acct = Pick<Account, "type" | "code" | "name"> & Partial<Pick<Account, "category" | "lineItem">>;

/**
 * Where an account without a line item belongs. Runs once per legacy record
 * (the chart pre-dates line items) and for accounts inferred from orphaned
 * postings. Order matters: the seeded chart is mapped by code exactly, then
 * a name is usually decisive, then the code range, then a per-type default —
 * so nothing is ever left unfiled and the statements never drop a balance.
 */
export function assignLineItem(a: Acct): string {
  const seed = SEED_BY_CODE[a.code];
  if (seed) return seed;

  const n = a.name.toLowerCase();
  const cat = (a.category ?? "").toLowerCase();
  const current = cat.includes("current") && !cat.includes("non");
  const nonCurrent = cat.includes("non-current") || cat.includes("noncurrent");

  switch (a.type) {
    case "asset":
      if (/\b(cash|bank|petty|gcash|maya|paypal)\b/.test(n)) return "cash";
      if (/receivable|\bar\b|advances to/.test(n)) return "receivables";
      if (/creditable|withholding|\bcwt\b|tax credit/.test(n)) return "current-tax-asset";
      if (/inventor|merchandise|stock|raw material|finished goods|work in pro/.test(n)) return "inventories";
      if (/prepaid|input vat|deposit|advance/.test(n)) return "prepayments";
      if (/intangible|software|goodwill|licen|trademark|franchise/.test(n)) return "intangibles";
      if (/deferred tax/.test(n)) return "deferred-tax-asset";
      if (/investment propert/.test(n)) return "investment-property";
      if (/associate/.test(n)) return "associates-inv";
      if (/joint/.test(n)) return "jce-inv";
      if (/accum|property|plant|equipment|building|improvement|vehicle|furniture|fixture|computer|machinery|land|depreciation/.test(n)) return "ppe";
      if (/investment|placement|time deposit|marketable|securities/.test(n)) return "financial-assets";
      break;
    case "liability":
      if (/income tax payable/.test(n)) return "current-tax-liability";
      if (/deferred tax/.test(n)) return "deferred-tax-liability";
      if (/retirement|pension|gratuity/.test(n)) return "retirement";
      if (/provision|warranty/.test(n)) return nonCurrent ? "provisions-noncurrent" : "provisions";
      if (/lease/.test(n)) return nonCurrent ? "lease-noncurrent" : "lease-current";
      if (/loan|note|borrow|mortgage|credit line|overdraft/.test(n)) return current ? "financial-liabilities" : "loans-noncurrent";
      if (/payable|accru|vat|withholding|sss|philhealth|pag-?ibig|hdmf|deferred income|unearned|customer deposit/.test(n)) return "trade-payables";
      break;
    case "equity":
      if (/premium|paid-in|apic/.test(n)) return "share-premium";
      if (/subscribed|subscription receivable/.test(n)) return "subscribed-capital";
      if (/deposit/.test(n)) return "deposits-subscriptions";
      if (/revaluation/.test(n)) return "revaluation-surplus";
      if (/treasury/.test(n)) return "treasury-shares";
      if (/non-?controlling|minority/.test(n)) return "nci";
      if (/drawing|dividend|retained|earning|deficit|withdrawal/.test(n)) return "retained-earnings";
      if (/capital|share|stock|equity/.test(n)) return "share-capital";
      break;
    case "income":
      if (/interest income|dividend income|finance income|forex gain|foreign exchange gain/.test(n)) return "finance-income";
      if (/associate|joint/.test(n)) return "associates";
      if (/discontinued/.test(n)) return "discontinued";
      if (/other income|miscellaneous|gain|rent income|scrap|rebate|discount/.test(n)) return "other-operating-income";
      if (cat === "other income") return "other-operating-income";
      break;
    case "expense":
      if (cat === "cost of sales" || /cost of (sales|goods|services)|cogs|direct (labor|labour|material)|purchases/.test(n)) return "cost-of-sales";
      if (/income tax/.test(n)) return "income-tax";
      if (/interest|bank charge|finance (cost|charge)|loan fee|forex loss|foreign exchange loss/.test(n)) return "finance-costs";
      if (/selling|distribution|marketing|advertis|promotion|freight|delivery|commission|shipping/.test(n)) return "distribution-costs";
      if (/impairment|loss on|write-?off|donation|penalt|surcharge/.test(n)) return "other-opex";
      break;
  }

  // Inside one of this type's blocks? File it there.
  const code = parseInt(a.code, 10);
  if (!isNaN(code)) {
    const hit = LINE_ITEMS.find((li) => li.type === a.type && code >= li.range[0] && code <= li.range[1]);
    if (hit) return hit.id;
  }

  // The catch-all for each type — the statements still show every peso.
  switch (a.type) {
    case "asset": return nonCurrent ? "other-nca" : "prepayments";
    case "liability": return nonCurrent ? "loans-noncurrent" : "other-cl";
    case "equity": return "retained-earnings";
    case "income": return "other-operating-income";
    default: return "admin-expenses";
  }
}

/** The seeded chart, filed exactly. Keeps every default's existing code. */
const SEED_BY_CODE: Record<string, string> = {
  "1000": "cash", "1010": "cash",
  "1200": "receivables",
  "1300": "current-tax-asset",
  "1400": "inventories",
  "1500": "prepayments", "1600": "prepayments",
  "1700": "ppe", "1710": "ppe",
  "2000": "trade-payables", "2100": "trade-payables", "2200": "trade-payables", "2300": "trade-payables",
  "2400": "current-tax-liability",
  "2500": "loans-noncurrent",
  "3000": "share-capital",
  "3100": "retained-earnings", // Owner's Drawings — a distribution, so it moves retained earnings
  "3200": "retained-earnings",
  "4000": "revenue",
  "4100": "other-operating-income",
  "4200": "finance-income",
  "5000": "cost-of-sales",
  "5100": "admin-expenses", "5200": "admin-expenses", "5300": "admin-expenses", "5400": "admin-expenses", "5500": "admin-expenses",
  "5600": "admin-expenses", "5700": "admin-expenses", "5800": "admin-expenses", "5900": "admin-expenses",
};

/** The line item an account is filed under — resolving a legacy record on the fly. */
export function lineItemOf(a: Acct): LineItem {
  const li = a.lineItem ? LINE_ITEM_BY_ID.get(a.lineItem) : undefined;
  if (li && li.type === a.type) return li;
  return LINE_ITEM_BY_ID.get(assignLineItem(a))!;
}

export const sectionOf = (a: Acct): Section => lineItemOf(a).section;

/**
 * Give every record a line item. Pure, deterministic, and run on every device
 * on load — which is why it can be persisted without a sync stamp: two
 * devices migrating the same chart arrive at the same answer, so there is
 * nothing to reconcile and no risk of a freshly stamped seed outranking the
 * real chart on the server.
 */
export function ensureLineItems<T extends Acct>(list: T[]): { list: T[]; changed: boolean } {
  let changed = false;
  const out = list.map((a) => {
    const li = a.lineItem ? LINE_ITEM_BY_ID.get(a.lineItem) : undefined;
    if (li && li.type === a.type) return a;
    changed = true;
    return { ...a, lineItem: assignLineItem(a) };
  });
  return { list: out, changed };
}

/**
 * The next account number under a line item: the lowest number in its block
 * not already taken. Codes are consecutive by rule — the chart is renumbered
 * to be gapless (see renumberAccounts) — so this is normally one past the
 * block's last account, and a hole left by a deletion is refilled rather than
 * skipped. Reusing a deleted account's number is safe: an account can only
 * be deleted while it has no activity (otherwise it is archived and keeps
 * its number), so no posting can ever point at a reused code. Never returns
 * nothing — a full block spills past the chart's highest code so the account
 * can still be created, and the owner can see the block has run out.
 */
export function nextCodeFor(lineItemId: string, accounts: Pick<Account, "code">[]): string {
  const li = LINE_ITEM_BY_ID.get(lineItemId);
  const used = new Set(accounts.map((a) => parseInt(a.code, 10)).filter((n) => !isNaN(n)));
  if (!li) return String((used.size ? Math.max(...used) : 999) + 1);
  const [lo, hi] = li.range;
  for (let c = lo; c <= hi; c++) if (!used.has(c)) return String(c);
  return String(Math.max(...used) + 1);
}

type Numbered = Pick<Account, "id" | "type" | "code" | "name"> & Partial<Pick<Account, "category" | "lineItem" | "parentId">>;

/**
 * Make every line item's accounts consecutive from the first number of its
 * block, with no gaps. Order within a block is the chart's own reading
 * order: parents by their current code, each followed by its sub-accounts,
 * and any legacy account that sat outside the block filed after those that
 * were already in it. Pure — the caller decides whether to save. Stable: a
 * chart that is already gapless comes back unchanged, so this can be applied
 * after any deletion to close the hole.
 *
 * Account ids never change, and everything that matters resolves by id (the
 * ledger, the statements, the seeded standard accounts), so renumbering
 * cannot detach history from an account.
 */
export function renumberAccounts<T extends Numbered>(list: T[]): { list: T[]; changes: { id: string; from: string; to: string }[] } {
  const num = (a: Numbered) => parseInt(a.code, 10);
  const out = new Map(list.map((a) => [a.id, a]));
  const changes: { id: string; from: string; to: string }[] = [];
  for (const li of LINE_ITEMS) {
    const members = list.filter((a) => a.type === li.type && lineItemOf(a).id === li.id);
    if (!members.length) continue;
    const ids = new Set(members.map((a) => a.id));
    const [lo, hi] = li.range;
    const inBlock = (a: Numbered) => {
      const n = num(a);
      return !isNaN(n) && n >= lo && n <= hi ? 0 : 1;
    };
    const order = (x: Numbered, y: Numbered) =>
      inBlock(x) - inBlock(y) || (num(x) || 0) - (num(y) || 0) || x.name.localeCompare(y.name);
    const tops = members.filter((a) => !a.parentId || !ids.has(a.parentId)).sort(order);
    const seq: T[] = [];
    for (const t of tops) {
      seq.push(t);
      seq.push(...members.filter((a) => a.parentId === t.id).sort(order));
    }
    let next = lo;
    for (const a of seq) {
      const code = String(next++);
      if (a.code !== code) {
        changes.push({ id: a.id, from: a.code, to: code });
        out.set(a.id, { ...a, code });
      }
    }
    void hi; // a block that overflows simply keeps counting past its top
  }
  return { list: list.map((a) => out.get(a.id)!), changes };
}
