// Copied from the web app (src/lib/eis.ts) by scripts/sync-books.mjs — edit it there, not here.
import { Rec, isConfigured, queuePush, stampChanged } from "@/books/sync";

/*
 * The business's tax profile: who it is to the BIR (name, TIN, RDO, address,
 * accounting period) and its EOPT size bracket, which the 2550Q prints as the
 * taxpayer classification. (The file keeps its old name; it once also held an
 * e-invoicing coverage checker, since removed.)
 */

/** EOPT size brackets, by annual gross sales (RA 11976, RR 8-2024). */
export type SizeBracket = "micro" | "small" | "medium" | "large";

export const BRACKETS: { key: SizeBracket; label: string; floor: number; ceiling: number | null }[] = [
  { key: "micro", label: "Micro", floor: 0, ceiling: 3_000_000 },
  { key: "small", label: "Small", floor: 3_000_000, ceiling: 20_000_000 },
  { key: "medium", label: "Medium", floor: 20_000_000, ceiling: 1_000_000_000 },
  { key: "large", label: "Large", floor: 1_000_000_000, ceiling: null },
];

export const bracketFor = (grossSales: number): SizeBracket =>
  grossSales >= 1_000_000_000 ? "large" : grossSales >= 20_000_000 ? "medium" : grossSales >= 3_000_000 ? "small" : "micro";

export const bracketLabel = (b: SizeBracket) => BRACKETS.find((x) => x.key === b)!.label;

/** The business as the BIR knows it. Older saved profiles may carry extra fields from removed features; they're ignored. */
export type TaxProfile = {
  businessName: string;
  /** Settings › Accounting. Calendar = January to December; absent on older profiles, which are calendar. */
  accountingPeriod?: "calendar" | "fiscal";
  /** For a fiscal year: the month (1–11) it ends in. */
  fiscalYearEndMonth?: number;
  /** The seller's own TIN — printed on invoices and BIR returns. */
  tin: string;
  registeredAddress: string;
  rdoCode: string;
  /** Part I of BIR returns: ZIP, contact number, email. Optional — older profiles predate them. */
  zipCode?: string;
  contactNumber?: string;
  email?: string;
  /** Annual gross sales, most recent year — sets the EOPT size bracket. */
  grossSales: number;
};

/** Used until the owner sets their own in Settings. */
export const DEFAULT_BUSINESS_NAME = "JC APEX Solutions Inc.";

export const BLANK_PROFILE: TaxProfile = {
  businessName: "",
  tin: "",
  registeredAddress: "",
  rdoCode: "",
  zipCode: "",
  contactNumber: "",
  email: "",
  grossSales: 0,
};

/*
 * The profile lives as a single fixed-id record inside the synced "meta"
 * collection, so the business identity (name, TIN, address) follows the
 * account to every device through the exact same merge/push/listen machinery
 * as the ledger — instead of dying with this browser's cache.
 */
const KEY = "ath:meta";
const LEGACY_KEY = "ath:tax-profile";
export const PROFILE_ID = "tax-profile";

function readMeta(): Rec[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? (v as Rec[]) : [];
  } catch {
    return [];
  }
}

export function loadProfile(): TaxProfile {
  if (typeof window === "undefined") return BLANK_PROFILE;
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const p = { ...BLANK_PROFILE, ...(JSON.parse(legacy) as Partial<TaxProfile>) };
      // Migrate off the render path: saveProfile touches sync state, which
      // must not run while React is rendering a component that called us.
      setTimeout(() => {
        saveProfile(p);
        localStorage.removeItem(LEGACY_KEY);
      }, 0);
      return p;
    }
    const rec = readMeta().find((r) => r?.id === PROFILE_ID);
    return rec ? { ...BLANK_PROFILE, ...(rec as Partial<TaxProfile>) } : BLANK_PROFILE;
  } catch {
    return BLANK_PROFILE;
  }
}

export function saveProfile(p: TaxProfile) {
  if (typeof window === "undefined") return;
  const others = readMeta().filter((r) => r?.id !== PROFILE_ID);
  const stamped = stampChanged("meta", [...others, { ...p, id: PROFILE_ID }] as Rec[]);
  localStorage.setItem(KEY, JSON.stringify(stamped));
  queuePush("meta", stamped);
}

/** The name that heads printed statements — the owner's, once they set one. */
/** Printed where a company has no name yet — neutral, so no customer's books ever carry someone else's name. */
export const PLACEHOLDER_BUSINESS_NAME = "Your Business Name";

/**
 * The name to print when the open company's profile has none: the neutral
 * placeholder for every account (local development keeps JC APEX Solutions Inc.).
 */
export function fallbackBusinessName(): string {
  if (!isConfigured()) return DEFAULT_BUSINESS_NAME;
  return PLACEHOLDER_BUSINESS_NAME;
}

export const companyName = (): string => loadProfile().businessName.trim() || fallbackBusinessName();
