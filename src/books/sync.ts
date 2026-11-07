/**
 * The phone's stand-in for the web app's src/lib/sync.ts.
 *
 * The accounting modules copied from the web (ledger, invoices, expenses…)
 * read and write `localStorage` synchronously and call stampChanged/queuePush
 * on save. Here `localStorage` is an in-memory map filled by live Firestore
 * listeners on firms/{firm}/{store}, and queuePush writes changed records
 * straight back. Same documents, same ids, same updatedAt stamps as the web,
 * so both apps read and write one set of books.
 *
 * Deliberate differences from the web:
 *  - the phone never deletes server records (no delete actions on the phone);
 *  - nothing is pushed for a store until its first snapshot has arrived, so a
 *    half-loaded cache can't seed defaults (e.g. a fresh chart of accounts)
 *    over real books.
 */
import { collection, doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';

import { db } from '@/lib/firebase';

export const SYNCED = ['invoices', 'expenses', 'purchaseOrders', 'customers', 'suppliers', 'products', 'journal', 'assets', 'coa', 'pos', 'tax', 'meta'] as const;
export type SyncedKey = (typeof SYNCED)[number];
export type Rec = { id: string; updatedAt?: number; [k: string]: unknown };
export type Role = 'owner' | 'ar' | 'ap';

export const isConfigured = () => true;

/* ---- the in-memory localStorage ---- */

const mem = new Map<string, string>();
let version = 0;
const listeners = new Set<() => void>();
const bump = () => {
  version++;
  listeners.forEach((l) => l());
};

const storage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => {
    mem.set(k, String(v));
    bump();
  },
  removeItem: (k: string) => {
    mem.delete(k);
    bump();
  },
  clear: () => {
    mem.clear();
    bump();
  },
  key: (i: number) => [...mem.keys()][i] ?? null,
  get length() {
    return mem.size;
  },
};
try {
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
} catch {
  (globalThis as unknown as { localStorage: typeof storage }).localStorage = storage;
}

export const subscribeBooks = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const booksVersion = () => version;

/* ---- which books, and what this person may touch (mirrors the web's MEMBER_STORES and the rules) ---- */

const READ: Record<Role, readonly SyncedKey[]> = {
  owner: ['invoices', 'expenses', 'customers', 'suppliers', 'journal', 'assets', 'coa', 'pos', 'meta'],
  ar: ['invoices', 'customers', 'coa', 'meta'],
  ap: ['expenses', 'suppliers', 'coa', 'meta'],
};
const WRITE: Record<Role, readonly SyncedKey[]> = {
  owner: READ.owner,
  ar: ['invoices', 'customers', 'meta'],
  ap: ['expenses', 'suppliers'],
};

let firm: string | null = null;
let role: Role = 'owner';
let unsubs: Unsubscribe[] = [];
const loaded = new Set<SyncedKey>();
const failed = new Map<SyncedKey, string>();
/** What the server holds, per store: id → updatedAt. A save pushes only records that differ. */
const shadow = new Map<SyncedKey, Map<string, number>>();
let pushError: string | null = null;

export const canRead = (k: SyncedKey) => READ[role].includes(k);
export const canWrite = (k: SyncedKey) => WRITE[role].includes(k);
export const currentRole = () => role;
export const activeFirmId = () => firm;

export function syncStatus() {
  const wanted = READ[role];
  return {
    ready: firm !== null && wanted.every((k) => loaded.has(k)),
    errors: [...failed.entries()],
    pushError,
  };
}

/** Open a set of books: listen to every store this role can read. */
export function attachBooks(firmId: string, r: Role) {
  detachBooks();
  firm = firmId;
  role = r;
  for (const k of READ[r]) {
    unsubs.push(
      onSnapshot(
        collection(db, 'firms', firmId, k),
        (snap) => {
          const recs = snap.docs.map((d) => ({ ...(d.data() as Rec), id: d.id }));
          mem.set(`ath:${k}`, JSON.stringify(recs));
          shadow.set(k, new Map(recs.map((x) => [x.id, Number(x.updatedAt) || 0])));
          loaded.add(k);
          failed.delete(k);
          bump();
        },
        (err) => {
          failed.set(k, err.message);
          loaded.add(k);
          bump();
        },
      ),
    );
  }
  bump();
}

/** Close the books and forget everything cached (sign-out). */
export function detachBooks() {
  unsubs.forEach((u) => u());
  unsubs = [];
  firm = null;
  loaded.clear();
  failed.clear();
  shadow.clear();
  pushError = null;
  mem.clear();
  bump();
}

/* ---- the two calls the copied modules make on save ---- */

const withoutStamp = (r: Rec) => {
  const { updatedAt, ...rest } = r;
  void updatedAt;
  return JSON.stringify(rest);
};

function readLocal(k: SyncedKey): Rec[] {
  try {
    const v = JSON.parse(mem.get(`ath:${k}`) || '[]');
    return Array.isArray(v) ? (v as Rec[]) : [];
  } catch {
    return [];
  }
}

/** Stamp only records that changed against the cache (same rule as the web). */
export function stampChanged<T extends Rec>(k: SyncedKey, list: T[]): T[] {
  const prev = new Map(readLocal(k).map((r) => [r.id, r]));
  const t = Date.now();
  return list.map((r) => {
    const old = prev.get(r.id);
    if (old && withoutStamp(old) === withoutStamp(r)) return { ...r, updatedAt: Number(old.updatedAt) || 0 } as T;
    return { ...r, updatedAt: t } as T;
  });
}

/** Write the records that differ from the server's copy. Never deletes. */
export function queuePush(k: SyncedKey, recs: Rec[]) {
  if (!firm || !canWrite(k) || !loaded.has(k) || failed.has(k)) return;
  const sh = shadow.get(k) ?? new Map<string, number>();
  const changed = recs.filter((r) => r?.id && sh.get(r.id) !== (Number(r.updatedAt) || 0));
  const target = firm;
  for (const r of changed) {
    sh.set(r.id, Number(r.updatedAt) || 0);
    setDoc(doc(db, 'firms', target, k, r.id), r).catch((e: Error) => {
      pushError = e.message;
      bump();
    });
  }
  shadow.set(k, sh);
}
