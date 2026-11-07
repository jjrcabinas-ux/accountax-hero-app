/**
 * Read-side helpers for the screens, built on the web app's own modules
 * (src/books), so every figure matches what the web app shows.
 */
import { useSyncExternalStore } from 'react';

import { loadAccounts, isCashAccount, type Account } from '@/books/coa';
import { nextDeadlines } from '@/books/compliance';
import { companyName, loadProfile } from '@/books/eis';
import { expenseTotals, loadExpenses, statusOf as expenseStatus } from '@/books/expenses';
import { invoiceBadge, invoiceBalance, invoiceTotals, isOverdue, loadInvoicesOnly, type Invoice } from '@/books/invoices';
import { trialBalance } from '@/books/ledger';
import { booksVersion, subscribeBooks } from '@/books/sync';
import { round2, todayIso } from '@/utils/money';

/** Re-render whenever any store changes (a listener fired or a save happened). */
export function useBooksVersion() {
  return useSyncExternalStore(subscribeBooks, booksVersion, booksVersion);
}

export const business = () => {
  const p = loadProfile();
  return { name: companyName(), tin: p.tin, address: p.registeredAddress };
};

export const liveInvoices = (): Invoice[] =>
  loadInvoicesOnly()
    .filter((i) => !i.voided)
    .sort((a, b) => (a.invoiceDate < b.invoiceDate ? 1 : a.invoiceDate > b.invoiceDate ? -1 : b.number.localeCompare(a.number)));

export const liveExpenses = () =>
  loadExpenses().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.number.localeCompare(a.number)));

export const activeAccounts = (): Account[] => loadAccounts().filter((a) => !a.archived);
export const cashAccounts = () => activeAccounts().filter(isCashAccount).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
export const expenseAccounts = () =>
  activeAccounts()
    .filter((a) => a.type === 'expense')
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

/** Cash and bank: the balance of every cash account as of today, from the ledger. */
export function cashOnHand(asOf = todayIso()) {
  const cash = new Set(cashAccounts().map((a) => a.id));
  const { rows } = trialBalance(asOf);
  return round2(rows.filter((r) => cash.has(r.accountId)).reduce((s, r) => s + r.debit - r.credit, 0));
}

export function receivables(asOf = todayIso()) {
  const open = liveInvoices().filter((i) => invoiceBalance(i) > 0.005);
  return {
    total: round2(open.reduce((s, i) => s + invoiceBalance(i), 0)),
    count: open.length,
    overdue: open.filter((i) => isOverdue(i, asOf)),
  };
}

export type Tone = 'positive' | 'negative' | 'warning' | 'neutral';
const TONE = { green: 'positive', red: 'negative', amber: 'warning', slate: 'neutral' } as const;

export function invoiceStatus(inv: Invoice, asOf = todayIso()): { label: string; tone: Tone } {
  const b = invoiceBadge(inv, asOf);
  return { label: b.label, tone: TONE[b.tone] };
}

export function expenseStatusLabel(e: Parameters<typeof expenseStatus>[0]): { label: string; tone: Tone } {
  const s = expenseStatus(e);
  return s === 'paid' ? { label: 'Paid', tone: 'positive' } : s === 'partial' ? { label: 'Partial', tone: 'warning' } : { label: 'Unpaid', tone: 'neutral' };
}

export const invoiceTotal = (i: Invoice) => invoiceTotals(i).total;
export const expenseTotal = (e: Parameters<typeof expenseTotals>[0]) => expenseTotals(e).total;

export function upcomingDeadlines(n = 3, today = todayIso()) {
  return nextDeadlines(today).slice(0, n);
}

export const AGING_BUCKETS = ['Current', '1–30', '31–60', '61–90', '90+'] as const;

export function arAging(asOf = todayIso()) {
  const rows = new Map<string, number[]>();
  for (const inv of liveInvoices()) {
    const bal = invoiceBalance(inv);
    if (bal <= 0.005) continue;
    const late = Math.round((Date.parse(`${asOf}T00:00:00`) - Date.parse(`${inv.dueDate}T00:00:00`)) / 86_400_000);
    const bucket = late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4;
    const name = inv.customerName || 'No customer';
    const row = rows.get(name) ?? [0, 0, 0, 0, 0];
    row[bucket] = round2(row[bucket] + bal);
    rows.set(name, row);
  }
  const customers = [...rows.entries()]
    .map(([name, buckets]) => ({ name, buckets, total: round2(buckets.reduce((a, b) => a + b, 0)) }))
    .sort((a, b) => b.total - a.total);
  const totals = AGING_BUCKETS.map((_, i) => round2(customers.reduce((s, c) => s + c.buckets[i], 0)));
  return { customers, totals, grandTotal: round2(totals.reduce((a, b) => a + b, 0)) };
}

export type Period = { key: string; label: string; from: string; to: string };

export function periods(today = todayIso()): Period[] {
  const [y, m] = today.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = (yy: number, mm: number) => new Date(yy, mm, 0).getDate();
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  const qStart = Math.floor((m - 1) / 3) * 3 + 1;
  return [
    { key: 'month', label: 'This month', from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${lastDay(y, m)}` },
    { key: 'last', label: 'Last month', from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${lastDay(py, pm)}` },
    { key: 'quarter', label: 'This quarter', from: `${y}-${pad(qStart)}-01`, to: `${y}-${pad(qStart + 2)}-${lastDay(y, qStart + 2)}` },
    { key: 'year', label: 'Year to date', from: `${y}-01-01`, to: today },
  ];
}
