import type { QuotationRecord } from "./types";
import { formatCurrency, formatDate } from "./api";

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

export function openQuotationPrintWindow(quote: QuotationRecord): boolean {
  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) return false;
  popup.opener = null;

  const company = quote.lead?.company;
  const rows = quote.items.map((item) => `
    <tr>
      <td>${escapeHtml(item.description)}</td>
      <td class="numeric">${item.quantity}</td>
      <td class="numeric">${escapeHtml(formatCurrency(item.unitPrice, quote.currency))}</td>
      <td class="numeric">${escapeHtml(formatCurrency(item.lineTotal, quote.currency))}</td>
    </tr>`).join("");
  const taxLine = Number(quote.taxRate) > 0
    ? `<div class="total-line"><span>Tax / VAT (${Number(quote.taxRate).toFixed(2)}%)</span><span>${escapeHtml(formatCurrency(quote.taxAmount, quote.currency))}</span></div>`
    : "";
  const discountLine = Number(quote.discountAmount) > 0
    ? `<div class="total-line"><span>Discount</span><span>−${escapeHtml(formatCurrency(quote.discountAmount, quote.currency))}</span></div>`
    : "";

  popup.document.open();
  popup.document.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(quote.number)} — Quotation</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #172033; background: #fff; font: 14px/1.55 Arial, sans-serif; }
    .page { max-width: 780px; margin: 32px auto; }
    header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 3px solid #f59e0b; padding-bottom: 24px; }
    .brand { color: #a6530d; font-size: 11px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; }
    h1 { margin: 24px 0 2px; font-size: 32px; letter-spacing: -.03em; }
    p { margin: 2px 0; }
    .meta { text-align: right; font-size: 12px; }
    .muted { color: #64748b; }
    .section { display: flex; justify-content: space-between; gap: 30px; border-bottom: 1px solid #e2e8f0; padding: 22px 0; }
    .eyebrow { color: #64748b; font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th { border-bottom: 1px solid #94a3b8; color: #64748b; font-size: 10px; letter-spacing: .08em; text-align: left; text-transform: uppercase; }
    th, td { padding: 10px 8px; }
    td { border-bottom: 1px solid #eef2f7; vertical-align: top; }
    .numeric { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .totals { max-width: 300px; margin: 22px 0 20px auto; }
    .total-line { display: flex; justify-content: space-between; gap: 16px; padding: 5px 0; }
    .grand-total { margin-top: 6px; border-top: 2px solid #172033; padding-top: 12px; font-size: 17px; font-weight: 700; }
    .terms { border-top: 1px solid #e2e8f0; padding-top: 18px; white-space: pre-wrap; }
    .terms h2 { color: #64748b; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; }
    footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 14px; color: #64748b; font-size: 10px; }
    @media print { .page { max-width: none; margin: 0; } }
    @media (max-width: 600px) { .page { margin: 16px; } header, .section { flex-direction: column; } .meta { text-align: left; } }
  </style>
</head>
<body>
  <main class="page">
    <header>
      <div><div class="brand">${escapeHtml(company?.name || "ALO Education")}</div>${company?.domain ? `<p class="muted">${escapeHtml(company.domain)}</p>` : ""}<h1>Quotation</h1><p class="muted">${escapeHtml(quote.title)}</p></div>
      <div class="meta"><p><strong>${escapeHtml(quote.number)}</strong></p><p class="muted">Issued ${escapeHtml(formatDate(quote.createdAt))}</p><p class="muted">Valid until ${escapeHtml(formatDate(quote.validUntil))}</p></div>
    </header>
    <section class="section">
      <div><div class="eyebrow">Prepared for</div><p style="margin-top:8px"><strong>${escapeHtml(quote.lead?.fullName || "Enquiry")}</strong></p>${quote.lead?.email ? `<p class="muted">${escapeHtml(quote.lead.email)}</p>` : ""}${quote.lead?.phone ? `<p class="muted">${escapeHtml(quote.lead.phone)}</p>` : ""}</div>
      <div><div class="eyebrow">Reference</div><p style="margin-top:8px">${escapeHtml(quote.number)}</p></div>
    </section>
    <table>
      <thead><tr><th>Service / description</th><th class="numeric">Qty</th><th class="numeric">Unit price</th><th class="numeric">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <section class="totals">
      <div class="total-line"><span class="muted">Subtotal</span><span>${escapeHtml(formatCurrency(quote.subtotal, quote.currency))}</span></div>
      ${discountLine}${taxLine}
      <div class="total-line grand-total"><span>Total</span><span>${escapeHtml(formatCurrency(quote.total, quote.currency))}</span></div>
    </section>
    ${quote.terms ? `<section class="terms"><h2>Terms & important information</h2><div>${escapeHtml(quote.terms)}</div></section>` : ""}
    <footer>This is a quotation only, not a tax invoice or a guarantee of an admission, scholarship, visa, or immigration outcome. Confirm all fees, terms, and tax treatment with the appropriate adviser before acceptance.</footer>
  </main>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 180));</script>
</body>
</html>`);
  popup.document.close();
  return true;
}
