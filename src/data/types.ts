export type ExpenseCategory =
  | 'Supplies'
  | 'Transportation'
  | 'Meals'
  | 'Utilities'
  | 'Rent'
  | 'Professional fees'
  | 'Repairs'
  | 'Others';

export type Expense = {
  id: string;
  date: string; // ISO yyyy-mm-dd
  supplier: string;
  category: ExpenseCategory;
  /** Amount paid, VAT-inclusive when `vatable` is true. */
  amount: number;
  vatable: boolean;
  receiptUri?: string;
  note?: string;
};

export type InvoiceLine = {
  description: string;
  qty: number;
  price: number; // net of VAT
};

export type Invoice = {
  id: string;
  number: string;
  customer: string;
  date: string;
  dueDate: string;
  lines: InvoiceLine[];
  vatable: boolean;
  paid: boolean;
  paidDate?: string;
};

export type InvoiceStatus = 'Paid' | 'Unpaid' | 'Overdue';

export type Customer = {
  name: string;
  email: string;
  tin: string;
  address: string;
};

export type Deadline = {
  form: string;
  title: string;
  due: string;
};

export type Business = {
  name: string;
  owner: string;
  tin: string;
  address: string;
  vatRegistered: boolean;
  openingCash: number;
  equipment: number;
  openingDate: string;
};
