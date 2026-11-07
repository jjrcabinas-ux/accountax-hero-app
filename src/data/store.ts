/**
 * In-memory books store. Seeded from sample data so new expenses and invoices
 * show up everywhere at once. The next phase swaps this for the web app's
 * Firestore books (firms/{uid}) without changing the screens.
 */
import { useSyncExternalStore } from 'react';

import { round2, todayIso } from '@/utils/money';

import * as sample from './sample';
import type { Expense, Invoice, InvoiceStatus } from './types';

type State = { expenses: Expense[]; invoices: Invoice[] };

let state: State = { expenses: sample.expenses, invoices: sample.invoices };
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useBooks(): State {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}`;

export function addExpense(e: Omit<Expense, 'id'>): Expense {
  const expense = { ...e, id: newId('exp') };
  set({ expenses: [expense, ...state.expenses] });
  return expense;
}

export function addInvoice(i: Omit<Invoice, 'id' | 'number' | 'paid'>): Invoice {
  const invoice: Invoice = { ...i, id: newId('inv'), number: nextInvoiceNumber(), paid: false };
  set({ invoices: [invoice, ...state.invoices] });
  return invoice;
}

export function markInvoicePaid(id: string) {
  set({
    invoices: state.invoices.map((inv) =>
      inv.id === id ? { ...inv, paid: true, paidDate: todayIso() } : inv,
    ),
  });
}

export function nextInvoiceNumber(): string {
  const max = state.invoices.reduce((m, i) => Math.max(m, Number(i.number.replace(/\D/g, '')) || 0), 0);
  return `INV-${String(max + 1).padStart(4, '0')}`;
}

// ---------- derived figures ----------

export const VAT_RATE = 0.12;

export function expenseVat(e: Expense) {
  return e.vatable ? round2((e.amount * VAT_RATE) / (1 + VAT_RATE)) : 0;
}
export function expenseNet(e: Expense) {
  return round2(e.amount - expenseVat(e));
}

export function invoiceNet(i: Pick<Invoice, 'lines'>) {
  return round2(i.lines.reduce((s, l) => s + l.qty * l.price, 0));
}
export function invoiceVat(i: Pick<Invoice, 'lines' | 'vatable'>) {
  return i.vatable ? round2(invoiceNet(i) * VAT_RATE) : 0;
}
export function invoiceTotal(i: Pick<Invoice, 'lines' | 'vatable'>) {
  return round2(invoiceNet(i) + invoiceVat(i));
}

export function invoiceStatus(i: Invoice, today = todayIso()): InvoiceStatus {
  if (i.paid) return 'Paid';
  return i.dueDate < today ? 'Overdue' : 'Unpaid';
}

export const STATUS_TONE: Record<InvoiceStatus, 'positive' | 'negative' | 'warning'> = {
  Paid: 'positive',
  Overdue: 'negative',
  Unpaid: 'warning',
};

export type Period ={ key: string; label: string; from: string; to: string };

/** Periods offered on the dashboard and reports, relative to today. */
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

const within = (d: string, p: Period) => d >= p.from && d <= p.to;

export function summary(books: State, p: Period) {
  const inv = books.invoices.filter((i) => within(i.date, p));
  const exp = books.expenses.filter((e) => within(e.date, p));
  const sales = round2(inv.reduce((s, i) => s + invoiceNet(i), 0));
  const spend = round2(exp.reduce((s, e) => s + expenseNet(e), 0));
  return { sales, expenses: spend, netIncome: round2(sales - spend), invoiceCount: inv.length, expenseCount: exp.length };
}

export function cashOnHand(books: State) {
  const collected = books.invoices.filter((i) => i.paid).reduce((s, i) => s + invoiceTotal(i), 0);
  const paid = books.expenses.reduce((s, e) => s + e.amount, 0);
  return round2(sample.business.openingCash + collected - paid);
}

export function receivables(books: State) {
  const open = books.invoices.filter((i) => !i.paid);
  return { total: round2(open.reduce((s, i) => s + invoiceTotal(i), 0)), count: open.length };
}

export type ProfitAndLoss = {
  revenue: { label: string; amount: number }[];
  expenses: { label: string; amount: number }[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
};

export function profitAndLoss(books: State, p: Period): ProfitAndLoss {
  const inv = books.invoices.filter((i) => within(i.date, p));
  const totalRevenue = round2(inv.reduce((s, i) => s + invoiceNet(i), 0));
  const byCat = new Map<string, number>();
  books.expenses
    .filter((e) => within(e.date, p))
    .forEach((e) => byCat.set(e.category, round2((byCat.get(e.category) ?? 0) + expenseNet(e))));
  const expenses = [...byCat.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
  const totalExpenses = round2(expenses.reduce((s, e) => s + e.amount, 0));
  return {
    revenue: [{ label: 'Sales — goods and services', amount: totalRevenue }],
    expenses,
    totalRevenue,
    totalExpenses,
    netIncome: round2(totalRevenue - totalExpenses),
  };
}

export function balanceSheet(books: State) {
  const outputVat = round2(books.invoices.reduce((s, i) => s + invoiceVat(i), 0));
  const inputVat = round2(books.expenses.reduce((s, e) => s + expenseVat(e), 0));
  const allTime: Period = { key: 'all', label: 'All', from: '0000-01-01', to: '9999-12-31' };
  const { netIncome } = summary(books, allTime);
  const cash = cashOnHand(books);
  const ar = receivables(books).total;
  const capital = round2(sample.business.openingCash + sample.business.equipment);

  const assets = [
    { label: 'Cash and cash equivalents', amount: cash },
    { label: 'Trade receivables', amount: ar },
    { label: 'Input VAT', amount: inputVat },
    { label: 'Property and equipment', amount: sample.business.equipment },
  ];
  const liabilities = [{ label: 'Output VAT payable', amount: outputVat }];
  const equity = [
    { label: "Owner's capital", amount: capital },
    { label: 'Net income for the period', amount: netIncome },
  ];
  const sum = (rows: { amount: number }[]) => round2(rows.reduce((s, r) => s + r.amount, 0));
  return {
    assets, liabilities, equity,
    totalAssets: sum(assets),
    totalLiabilities: sum(liabilities),
    totalEquity: sum(equity),
  };
}

export const AGING_BUCKETS = ['Current', '1–30', '31–60', '61–90', '90+'] as const;

export function arAging(books: State, today = todayIso()) {
  const rows = new Map<string, number[]>();
  for (const inv of books.invoices) {
    if (inv.paid) continue;
    const late = Math.round((Date.parse(`${today}T00:00:00`) - Date.parse(`${inv.dueDate}T00:00:00`)) / 86_400_000);
    const bucket = late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4;
    const row = rows.get(inv.customer) ?? [0, 0, 0, 0, 0];
    row[bucket] = round2(row[bucket] + invoiceTotal(inv));
    rows.set(inv.customer, row);
  }
  const customers = [...rows.entries()]
    .map(([name, buckets]) => ({ name, buckets, total: round2(buckets.reduce((a, b) => a + b, 0)) }))
    .sort((a, b) => b.total - a.total);
  const totals = AGING_BUCKETS.map((_, i) => round2(customers.reduce((s, c) => s + c.buckets[i], 0)));
  return { customers, totals, grandTotal: round2(totals.reduce((a, b) => a + b, 0)) };
}
