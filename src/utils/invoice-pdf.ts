import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { invoiceTotals, lineAmounts, type Invoice } from '@/books/invoices';
import { business } from '@/data/live';

import { longDate, peso } from './money';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function invoiceHtml(inv: Invoice): string {
  const biz = business();
  const totals = invoiceTotals(inv);
  const rows = inv.lines
    .map((l) => {
      const a = lineAmounts(l, inv.amountsAre);
      return `<tr><td>${esc(l.item || l.description)}${l.item && l.description ? `<div class="muted">${esc(l.description)}</div>` : ''}</td><td class="n">${l.qty}</td><td class="n">${peso(l.rate)}</td><td class="n">${peso(a.net)}</td></tr>`;
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;margin:40px;font-size:12px}
    .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #047857;padding-bottom:16px}
    h1{font-size:20px;margin:0}.muted{color:#64748b}.big{font-size:26px;font-weight:700;color:#047857;letter-spacing:2px}
    .meta{display:flex;justify-content:space-between;margin:24px 0}
    table{width:100%;border-collapse:collapse}th{text-align:left;font-size:10px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;padding:8px 4px}
    td{padding:10px 4px;border-bottom:1px solid #f1f5f9;vertical-align:top}.n{text-align:right;font-variant-numeric:tabular-nums}
    .totals{margin-left:auto;width:280px;margin-top:16px}.totals div{display:flex;justify-content:space-between;padding:4px 0}
    .due{border-top:2px solid #0f172a;margin-top:6px;padding-top:8px!important;font-weight:700;font-size:14px}
    footer{margin-top:48px;color:#94a3b8;font-size:10px}
  </style></head><body>
    <div class="top"><div><h1>${esc(biz.name)}</h1>
      ${biz.address ? `<div class="muted">${esc(biz.address)}</div>` : ''}
      ${biz.tin ? `<div class="muted">TIN ${esc(biz.tin)}</div>` : ''}</div>
      <div style="text-align:right"><div class="big">INVOICE</div><div><b>${esc(inv.number)}</b></div></div></div>
    <div class="meta"><div><div class="muted">Billed to</div><b>${esc(inv.customerName)}</b>
      ${inv.billingAddress ? `<div>${esc(inv.billingAddress)}</div>` : ''}${inv.customerTin ? `<div>TIN ${esc(inv.customerTin)}</div>` : ''}</div>
      <div style="text-align:right"><div><span class="muted">Date</span> ${longDate(inv.invoiceDate)}</div>
      <div><span class="muted">Due</span> ${longDate(inv.dueDate)}</div><div><span class="muted">Terms</span> ${esc(inv.terms)}</div></div></div>
    <table><thead><tr><th>Item</th><th class="n">Qty</th><th class="n">Rate</th><th class="n">Amount</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="totals">
      <div><span>Sales, net of VAT</span><span class="n">${peso(totals.subtotal)}</span></div>
      <div><span>VAT (12%)</span><span class="n">${peso(totals.vat)}</span></div>
      <div class="due"><span>Total amount due</span><span class="n">${peso(totals.total)}</span></div>
    </div>
    ${inv.message ? `<p style="margin-top:24px">${esc(inv.message)}</p>` : ''}
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
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `${inv.number} — ${inv.customerName}` });
}
