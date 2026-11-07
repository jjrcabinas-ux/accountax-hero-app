// Copied from the web app (src/lib/customers.ts) by scripts/sync-books.mjs — edit it there, not here.
import { Rec, queuePush, stampChanged } from "@/books/sync";

export type Customer = {
  id: string;
  name: string;
  tin: string;
  address: string;
  contactPerson: string;
  contactNumber: string;
  /** Optional — older records predate the field. */
  email?: string;
  /** Filled in from invoices later; every new customer starts at zero. */
  balance: number;
  createdAt: string;
};

const KEY = "ath:customers";

export const newId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Stored in this browser for now — moves to Firestore once auth is rebuilt. */
export function loadCustomers(): Customer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Customer[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomers(list: Customer[]) {
  if (typeof window === "undefined") return;
  // Local first, then pushed in the background — see lib/sync.ts.
  const stamped = stampChanged("customers", list as unknown as Rec[]);
  localStorage.setItem(KEY, JSON.stringify(stamped));
  queuePush("customers", stamped);
}

/** Insert or update by id, then return the full list. */
export function upsertCustomer(c: Customer): Customer[] {
  const list = loadCustomers();
  const i = list.findIndex((x) => x.id === c.id);
  if (i >= 0) list[i] = c;
  else list.push(c);
  saveCustomers(list);
  return list;
}

export function deleteCustomer(id: string): Customer[] {
  const list = loadCustomers().filter((c) => c.id !== id);
  saveCustomers(list);
  return list;
}

/** PH TIN is 9 digits plus a 3-digit branch code — shown as 000-000-000-000. */
export function formatTin(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 12);
  return d.replace(/(\d{3})(?=\d)/g, "$1-");
}

/** Accepts a blank TIN; otherwise wants 9 or 12 digits. */
export function tinError(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (!d) return null;
  if (d.length !== 9 && d.length !== 12) return "TIN should be 9 digits, or 12 with the branch code.";
  return null;
}
