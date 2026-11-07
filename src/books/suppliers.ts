// Copied from the web app (src/lib/suppliers.ts) by scripts/sync-books.mjs — edit it there, not here.
import { Rec, queuePush, stampChanged } from "@/books/sync";

export type PayeeType = "individual" | "corporation";
/** VAT-registered or not. A non-VAT supplier's bills carry no input VAT. */
export type VatStatus = "vat" | "nonvat";

export type Supplier = {
  id: string;
  name: string;
  tin: string;
  /** Individual or corporation — picks the WI / WC alphanumeric tax code on the 1601-EQ. Older records have none and count as corporations. */
  payeeType?: PayeeType;
  /** Older records have none and count as VAT-registered. */
  vatStatus?: VatStatus;
  address: string;
  contactPerson: string;
  contactNumber: string;
  /** Amount payable — filled in as bills/expenses are recorded. */
  balance: number;
  createdAt: string;
};

const KEY = "ath:suppliers";

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function loadSuppliers(): Supplier[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Supplier[]) : [];
  } catch {
    return [];
  }
}

export function saveSuppliers(list: Supplier[]) {
  if (typeof window === "undefined") return;
  // Local first, then pushed in the background — see lib/sync.ts.
  const stamped = stampChanged("suppliers", list as unknown as Rec[]);
  localStorage.setItem(KEY, JSON.stringify(stamped));
  queuePush("suppliers", stamped);
}

export function upsertSupplier(s: Supplier): Supplier[] {
  const list = loadSuppliers();
  const i = list.findIndex((x) => x.id === s.id);
  if (i >= 0) list[i] = s;
  else list.push(s);
  saveSuppliers(list);
  return list;
}

export function deleteSupplier(id: string): Supplier[] {
  const list = loadSuppliers().filter((s) => s.id !== id);
  saveSuppliers(list);
  return list;
}
