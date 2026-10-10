import type { QuotationRecord } from "./types";
import { formatCurrency, formatDate } from "./api";

export default function QuotationDocument({ quote }: { quote: QuotationRecord }) {
  const company = quote.lead?.company;
  return (
    <article className="quote-print mx-auto w-full max-w-3xl bg-white p-6 text-slate-900 shadow-sm sm:p-10">
      <header className="flex flex-col justify-between gap-5 border-b-2 border-amber-500 pb-6 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">{company?.name || "ALO Education"}</p>
          {company?.domain && <p className="mt-1 text-xs text-slate-500">{company.domain}</p>}
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">Quotation</h1>
          <p className="mt-1 text-sm text-slate-600">Education guidance & support services</p>
        </div>
        <div className="text-left text-sm sm:text-right">
          <p className="font-semibold">{quote.number}</p>
          <p className="mt-1 text-slate-600">Issued {formatDate(quote.createdAt)}</p>
          <p className="text-slate-600">Valid until {formatDate(quote.validUntil)}</p>
          <span className="mt-3 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium capitalize text-amber-800">{quote.status}</span>
        </div>
      </header>

      <section className="grid gap-6 border-b border-slate-200 py-6 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Prepared for</p>
          <p className="mt-2 font-semibold">{quote.lead?.fullName || "Enquiry"}</p>
          {quote.lead?.email && <p className="mt-0.5 text-sm text-slate-600">{quote.lead.email}</p>}
          {quote.lead?.phone && <p className="mt-0.5 text-sm text-slate-600">{quote.lead.phone}</p>}
        </div>
        <div className="sm:text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Quotation title</p>
          <p className="mt-2 font-semibold">{quote.title}</p>
        </div>
      </section>

      <section className="py-6">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-[10px] uppercase tracking-[0.12em] text-slate-500">
              <th className="py-2 pr-3 font-semibold">Service / description</th>
              <th className="w-14 py-2 text-right font-semibold">Qty</th>
              <th className="w-28 py-2 text-right font-semibold">Unit price</th>
              <th className="w-28 py-2 pl-3 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 align-top">
                <td className="py-3 pr-3">{item.description}</td>
                <td className="py-3 text-right tabular-nums">{item.quantity}</td>
                <td className="py-3 text-right tabular-nums">{formatCurrency(item.unitPrice, quote.currency)}</td>
                <td className="py-3 pl-3 text-right tabular-nums">{formatCurrency(item.lineTotal, quote.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto mt-5 w-full max-w-xs space-y-2 text-sm">
          <div className="flex justify-between gap-3"><span className="text-slate-600">Subtotal</span><span className="tabular-nums">{formatCurrency(quote.subtotal, quote.currency)}</span></div>
          {Number(quote.discountAmount) > 0 && <div className="flex justify-between gap-3"><span className="text-slate-600">Discount</span><span className="tabular-nums">−{formatCurrency(quote.discountAmount, quote.currency)}</span></div>}
          {Number(quote.taxRate) > 0 && <div className="flex justify-between gap-3"><span className="text-slate-600">Tax / VAT ({Number(quote.taxRate).toFixed(2)}%)</span><span className="tabular-nums">{formatCurrency(quote.taxAmount, quote.currency)}</span></div>}
          <div className="flex justify-between gap-3 border-t-2 border-slate-800 pt-3 text-base font-bold"><span>Total</span><span className="tabular-nums">{formatCurrency(quote.total, quote.currency)}</span></div>
        </div>
      </section>

      {quote.terms && <section className="border-t border-slate-200 py-5"><h2 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Terms & important information</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{quote.terms}</p></section>}
      <footer className="border-t border-slate-200 pt-4 text-[10px] leading-relaxed text-slate-500">
        <p>This is a quotation only, not a tax invoice or a guarantee of an admission, scholarship, visa, or immigration outcome. Confirm all fees, terms, and tax treatment with the appropriate adviser before acceptance.</p>
        {quote.notes && <p className="mt-2 print:hidden"><span className="font-semibold">Internal note (not printed):</span> {quote.notes}</p>}
      </footer>
    </article>
  );
}
