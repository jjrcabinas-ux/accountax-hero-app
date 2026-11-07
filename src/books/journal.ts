// Copied from the web app (src/lib/journal.ts) by scripts/sync-books.mjs — edit it there, not here.
import { Rec, queuePush, stampChanged } from "@/books/sync";

/** Manual journal entries — the general ledger's book of original entry. */
export type JournalLine = {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  description: string;
  debit: number;
  credit: number;
};

export type JournalEntry = {
  id: string;
  number: string; // JE-0001
  date: string; // yyyy-mm-dd
  reference: string; // external ref / document no. (optional)
  memo: string;
  lines: JournalLine[];
  createdAt: string;
};

const KEY = "ath:journal";

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function loadEntries(): JournalEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as JournalEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveEntries(list: JournalEntry[]) {
  if (typeof window === "undefined") return;
  // Local first, then pushed in the background — see lib/sync.ts.
  const stamped = stampChanged("journal", list as unknown as Rec[]);
  localStorage.setItem(KEY, JSON.stringify(stamped));
  queuePush("journal", stamped);
}

export function upsertEntry(entry: JournalEntry): JournalEntry[] {
  const list = loadEntries();
  const i = list.findIndex((x) => x.id === entry.id);
  if (i >= 0) list[i] = entry;
  else list.push(entry);
  saveEntries(list);
  return list;
}

export function deleteEntry(id: string): JournalEntry[] {
  const list = loadEntries().filter((e) => e.id !== id);
  saveEntries(list);
  return list;
}

export const getEntry = (id: string): JournalEntry | null => loadEntries().find((e) => e.id === id) || null;

export function nextEntryNumber(): string {
  const nums = loadEntries()
    .map((e) => parseInt((e.number.match(/(\d+)$/) || [])[1] || "", 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `JE-${String(next).padStart(4, "0")}`;
}

/** Debit/credit totals and whether the entry balances. */
export function entryTotals(lines: Pick<JournalLine, "debit" | "credit">[]) {
  let debit = 0;
  let credit = 0;
  for (const l of lines) {
    debit += Number(l.debit) || 0;
    credit += Number(l.credit) || 0;
  }
  debit = round2(debit);
  credit = round2(credit);
  return { debit, credit, difference: round2(debit - credit), balanced: Math.abs(debit - credit) < 0.005 && debit > 0 };
}

export const peso = (n: number) =>
  "₱" + (Number(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
