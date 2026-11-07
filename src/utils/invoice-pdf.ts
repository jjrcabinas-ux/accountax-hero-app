import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { business, customers } from '@/data/sample';
import { invoiceNet, invoiceTotal, invoiceVat } from '@/data/store';
import type { Invoice } from '@/data/types';

import { longDate, peso } from './money';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function invoiceHtml(inv: Invoice): string {
  const cust = customers.find((c) => c.name === inv.customer);
  const rows = inv.lines
    .map(
      (l) => `<tr><td>${esc(l.description)}</td><td class="n">${l.qty}</td><td class="n">${peso(l.price)}</td><td class="n">${peso(l.qty * l.price)}</td></tr>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;margin:40px;font-size:12px}
    .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #047857;padding-bottom:16px}
    h1{font-size:20px;margin:0}.muted{color:#64748b}.big{font-size:26px;font-weight:700;color:#047857;letter-spacing:2px}
    .meta{display:flex;justify-content:space-between;margin:24px 0}
    table{width:100%;border-collapse:collapse}th{text-align:left;font-size:10px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;padding:8px 4px}
    td{padding:10px 4px;border-bottom:1px solid #f1f5f9}.n{text-align:right;font-variant-numeric:tabular-nums}
    .totals{margin-left:auto;width:280px;margin-top:16px}.totals div{display:flex;justify-content:space-between;padding:4px 0}
    .due{border-top:2px solid #0f172a;margin-top:6px;padding-top:8px!important;font-weight:700;font-size:14px}
    footer{margin-top:48px;color:#94a3b8;font-size:10px}
  </style></head><body>
    <div class="top"><div><h1>${esc(business.name)}</h1>
      <div class="muted">${esc(business.address)}</div>
      <div class="muted">${business.vatRegistered ? 'VAT Reg.' : 'Non-VAT Reg.'} TIN ${business.tin}</div></div>
      <div style="text-align:right"><div class="big">INVOICE</div><div><b>${inv.number}</b></div></div></div>
    <div class="meta"><div><div class="muted">Billed to</div><b>${esc(inv.customer)}</b>
      ${cust ? `<div>${esc(cust.address)}</div><div>TIN ${cust.tin}</div>` : ''}</div>
      <div style="text-align:right"><div><span class="muted">Date</span> ${longDate(inv.date)}</div>
      <div><span class="muted">Due</span> ${longDate(inv.dueDate)}</div></div></div>
    <table><thead><tr><th>Description</th><th class="n">Qty</th><th class="n">Unit price</th><th class="n">Amount</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="totals">
      <div><span>${inv.vatable ? 'VATable sales' : 'VAT-exempt sales'}</span><span class="n">${peso(invoiceNet(inv))}</span></div>
      <div><span>VAT (12%)</span><span class="n">${peso(invoiceVat(inv))}</span></div>
      <div class="due"><span>Total amount due</span><span class="n">${peso(invoiceTotal(inv))}</span></div>
    </div>
    <footer>Prepared with AccounTax Hero by JC APEX Solutions</footer>
  </body></html>`;
}

/** Native: render to PDF and open the share sheet. Web: open the print dialog (Save as PDF). */
export async function shareInvoicePdf(inv: Invoice) {
  const html = invoiceHtml(inv);
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: `${inv.number} — ${inv.customer}`,
  });
}
