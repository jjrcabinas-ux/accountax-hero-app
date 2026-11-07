/**
 * Sample books for the look-first build. Replaced by the user's live
 * Firestore data (same accounts as the web app) in the next phase.
 */
import type { Business, Customer, Deadline, Expense, Invoice } from './types';

export const business: Business = {
  name: 'Rivera Trading & Services',
  owner: 'Ana Rivera',
  tin: '123-456-789-000',
  address: 'Unit 4B, 88 Katipunan Ave., Quezon City',
  vatRegistered: true,
  openingCash: 412_580.4,
  equipment: 180_000,
  openingDate: '2026-08-01',
};

export const customers: Customer[] = [
  { name: 'Mabini Builders Inc.', email: 'ap@mabinibuilders.ph', tin: '204-118-552-000', address: 'Pasig City' },
  { name: 'Lumen Café Group', email: 'finance@lumencafe.ph', tin: '331-902-447-000', address: 'Makati City' },
  { name: 'Sampaguita Clinic', email: 'billing@sampaguitaclinic.ph', tin: '415-660-218-000', address: 'Quezon City' },
  { name: 'Bayanihan Logistics', email: 'accounts@bayanihanlog.ph', tin: '508-773-901-000', address: 'Parañaque City' },
  { name: 'Northpoint Realty', email: 'payables@northpoint.ph', tin: '612-045-338-000', address: 'Taguig City' },
];

export const invoices: Invoice[] = [
  {
    id: 'inv-1', number: 'INV-0041', customer: 'Mabini Builders Inc.', date: '2026-08-04', dueDate: '2026-09-03',
    lines: [{ description: 'Site supplies package', qty: 1, price: 86_500 }], vatable: true, paid: true, paidDate: '2026-08-29',
  },
  {
    id: 'inv-2', number: 'INV-0042', customer: 'Lumen Café Group', date: '2026-08-18', dueDate: '2026-09-17',
    lines: [{ description: 'Monthly bookkeeping retainer', qty: 1, price: 25_000 }, { description: 'POS setup', qty: 2, price: 7_500 }],
    vatable: true, paid: true, paidDate: '2026-09-15',
  },
  {
    id: 'inv-3', number: 'INV-0043', customer: 'Sampaguita Clinic', date: '2026-09-02', dueDate: '2026-10-02',
    lines: [{ description: 'Medical supplies', qty: 40, price: 1_150 }], vatable: true, paid: false,
  },
  {
    id: 'inv-4', number: 'INV-0044', customer: 'Bayanihan Logistics', date: '2026-09-21', dueDate: '2026-10-21',
    lines: [{ description: 'Warehouse racking', qty: 6, price: 9_800 }], vatable: true, paid: true, paidDate: '2026-10-19',
  },
  {
    id: 'inv-5', number: 'INV-0045', customer: 'Northpoint Realty', date: '2026-10-05', dueDate: '2026-10-20',
    lines: [{ description: 'Office fit-out materials', qty: 1, price: 128_000 }], vatable: true, paid: false,
  },
  {
    id: 'inv-6', number: 'INV-0046', customer: 'Lumen Café Group', date: '2026-10-18', dueDate: '2026-11-17',
    lines: [{ description: 'Monthly bookkeeping retainer', qty: 1, price: 25_000 }], vatable: true, paid: true, paidDate: '2026-11-03',
  },
  {
    id: 'inv-7', number: 'INV-0047', customer: 'Mabini Builders Inc.', date: '2026-11-02', dueDate: '2026-12-02',
    lines: [{ description: 'Site supplies package', qty: 1, price: 92_300 }, { description: 'Delivery', qty: 1, price: 3_500 }],
    vatable: true, paid: false,
  },
  {
    id: 'inv-8', number: 'INV-0048', customer: 'Sampaguita Clinic', date: '2026-11-05', dueDate: '2026-12-05',
    lines: [{ description: 'Medical supplies', qty: 25, price: 1_150 }], vatable: true, paid: false,
  },
];

export const expenses: Expense[] = [
  { id: 'exp-1', date: '2026-08-02', supplier: 'Ayala Land Offices', category: 'Rent', amount: 45_000, vatable: true },
  { id: 'exp-2', date: '2026-08-06', supplier: 'Wilcon Depot', category: 'Supplies', amount: 61_240, vatable: true },
  { id: 'exp-3', date: '2026-08-20', supplier: 'Meralco', category: 'Utilities', amount: 8_412.5, vatable: true },
  { id: 'exp-4', date: '2026-09-01', supplier: 'Ayala Land Offices', category: 'Rent', amount: 45_000, vatable: true },
  { id: 'exp-5', date: '2026-09-09', supplier: 'Medline PH', category: 'Supplies', amount: 33_600, vatable: true },
  { id: 'exp-6', date: '2026-09-19', supplier: 'Meralco', category: 'Utilities', amount: 7_985.3, vatable: true },
  { id: 'exp-7', date: '2026-09-25', supplier: 'Grab Philippines', category: 'Transportation', amount: 2_340, vatable: false },
  { id: 'exp-8', date: '2026-10-01', supplier: 'Ayala Land Offices', category: 'Rent', amount: 45_000, vatable: true },
  { id: 'exp-9', date: '2026-10-08', supplier: 'Handyman Do It Best', category: 'Supplies', amount: 72_150, vatable: true },
  { id: 'exp-10', date: '2026-10-14', supplier: 'Cruz & Reyes CPAs', category: 'Professional fees', amount: 15_000, vatable: true },
  { id: 'exp-11', date: '2026-10-21', supplier: 'Meralco', category: 'Utilities', amount: 8_120.75, vatable: true },
  { id: 'exp-12', date: '2026-10-28', supplier: 'Jollibee Katipunan', category: 'Meals', amount: 1_865, vatable: true },
  { id: 'exp-13', date: '2026-11-01', supplier: 'Ayala Land Offices', category: 'Rent', amount: 45_000, vatable: true },
  { id: 'exp-14', date: '2026-11-04', supplier: 'Shell Katipunan', category: 'Transportation', amount: 3_250, vatable: true },
  { id: 'exp-15', date: '2026-11-06', supplier: 'National Book Store', category: 'Supplies', amount: 1_428, vatable: true },
];

export const deadlines: Deadline[] = [
  { form: '0619-E', title: 'Expanded withholding tax — October', due: '2026-11-10' },
  { form: '1601-C', title: 'Withholding on compensation — October', due: '2026-11-10' },
  { form: '1701Q', title: 'Quarterly income tax — Q3', due: '2026-11-15' },
  { form: '0619-E', title: 'Expanded withholding tax — November', due: '2026-12-10' },
  { form: '1601-C', title: 'Withholding on compensation — November', due: '2026-12-10' },
];
