"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FilePlus2, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { crmFetch, formatCurrency, getApiError } from "./api";
import type { LeadRecord, QuotationRecord } from "./types";

interface DraftItem {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

const defaultTerms = "This quotation is valid until the expiry date shown. Services begin after written acceptance and any agreed payment. Admission outcomes are decided by the institution; visa and immigration decisions are made by the relevant authority. No admission or visa outcome is guaranteed.";

export default function QuotationBuilderDialog({
  lead,
  open,
  onOpenChange,
  onCreated,
}: {
  lead: LeadRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (quote: QuotationRecord) => void;
}) {
  const [title, setTitle] = useState("Education guidance & application support");
  const [currency, setCurrency] = useState("GBP");
  const [validUntil, setValidUntil] = useState("");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [taxRate, setTaxRate] = useState("0");
  const [terms, setTerms] = useState(defaultTerms);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 14);
      setTitle("Education guidance & application support");
      setCurrency("GBP");
      setValidUntil(expiry.toISOString().slice(0, 10));
      setDiscountAmount("0");
      setTaxRate("0");
      setTerms(defaultTerms);
      setNotes("");
      setItems([{ key: "item-1", description: "", quantity: "1", unitPrice: "0" }]);
      setError("");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, lead?.id]);

  const totals = useMemo(() => {
    const subtotalMinor = items.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      return sum + Math.round(price * 100) * quantity;
    }, 0);
    const discountMinor = Math.max(0, Math.round((Number(discountAmount) || 0) * 100));
    const taxable = Math.max(0, subtotalMinor - discountMinor);
    const taxMinor = Math.round(taxable * (Number(taxRate) || 0) / 100);
    return { subtotalMinor, discountMinor, taxMinor, totalMinor: taxable + taxMinor };
  }, [items, discountAmount, taxRate]);

  const updateItem = (key: string, field: keyof Omit<DraftItem, "key">, value: string) => {
    setItems((current) => current.map((item) => item.key === key ? { ...item, [field]: value } : item));
  };

  const addItem = () => setItems((current) => [...current, { key: `item-${Date.now()}-${current.length}`, description: "", quantity: "1", unitPrice: "0" }]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead) return;
    setError("");
    if (items.some((item) => !item.description.trim() || Number(item.quantity) < 1 || Number(item.unitPrice) < 0)) {
      setError("Complete each line item with a description, quantity, and non-negative price.");
      return;
    }
    if (totals.discountMinor > totals.subtotalMinor) {
      setError("Discount cannot exceed the subtotal.");
      return;
    }
    if (totals.totalMinor > 999_999_999_999) {
      setError("The quotation exceeds the supported amount.");
      return;
    }

    setBusy(true);
    try {
      const response = await crmFetch("/api/crm/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          title,
          currency,
          validUntil: validUntil || null,
          discountAmount: Number(discountAmount) || 0,
          taxRate: Number(taxRate) || 0,
          terms: terms || null,
          notes: notes || null,
          items: items.map((item) => ({ description: item.description.trim(), quantity: Number(item.quantity), unitPrice: Number(item.unitPrice) })),
        }),
      });
      if (!response.ok) throw new Error(await getApiError(response, "Could not create this quotation."));
      const body = await response.json();
      onCreated(body.quote as QuotationRecord);
      onOpenChange(false);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create this quotation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FilePlus2 className="h-5 w-5 text-emerald-600" />New quotation</DialogTitle>
          <DialogDescription>Prepared for {lead?.fullName ?? "the selected enquiry"}. Saving creates a draft only; it will not send or invoice anyone.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="quote-title">Quotation title</Label><Input id="quote-title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} /></div>
            <div className="space-y-1.5"><Label htmlFor="quote-currency">Currency</Label><select id="quote-currency" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="GBP">GBP — Pound sterling</option><option value="USD">USD — US dollar</option><option value="EUR">EUR — Euro</option><option value="BDT">BDT — Bangladeshi taka</option></select></div>
            <div className="space-y-1.5"><Label htmlFor="quote-valid-until">Valid until</Label><Input id="quote-valid-until" type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></div>
          </div>

          <section className="space-y-3 rounded-xl border border-border/70 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">Line items</h3><p className="text-xs text-muted-foreground">Describe each service clearly; amounts are calculated on the server.</p></div><Button type="button" size="sm" variant="outline" onClick={addItem}><Plus className="h-3.5 w-3.5" />Add item</Button></div>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={item.key} className="grid gap-2 rounded-lg bg-muted/30 p-2 sm:grid-cols-[minmax(0,1fr)_90px_130px_36px] sm:items-end">
                  <div className="space-y-1"><Label htmlFor={`quote-item-description-${index}`} className="text-xs">Description</Label><Input id={`quote-item-description-${index}`} value={item.description} onChange={(event) => updateItem(item.key, "description", event.target.value)} placeholder="Consultation / application support" maxLength={180} required /></div>
                  <div className="space-y-1"><Label htmlFor={`quote-item-qty-${index}`} className="text-xs">Qty</Label><Input id={`quote-item-qty-${index}`} type="number" min="1" max="1000" step="1" value={item.quantity} onChange={(event) => updateItem(item.key, "quantity", event.target.value)} required /></div>
                  <div className="space-y-1"><Label htmlFor={`quote-item-price-${index}`} className="text-xs">Unit price</Label><Input id={`quote-item-price-${index}`} type="number" min="0" max="10000000" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(item.key, "unitPrice", event.target.value)} required /></div>
                  <Button type="button" variant="ghost" size="icon" title="Remove line item" aria-label={`Remove line item ${index + 1}`} disabled={items.length === 1} onClick={() => setItems((current) => current.filter((row) => row.key !== item.key))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_250px]">
            <div className="space-y-3">
              <div className="space-y-1.5"><Label htmlFor="quote-terms">Terms & important information</Label><Textarea id="quote-terms" value={terms} onChange={(event) => setTerms(event.target.value)} rows={4} maxLength={3000} /></div>
              <div className="space-y-1.5"><Label htmlFor="quote-notes">Internal notes (not shown on the printable quotation)</Label><Textarea id="quote-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} maxLength={3000} /></div>
            </div>
            <div className="space-y-3 rounded-xl bg-muted/40 p-4">
              <div className="space-y-1"><Label htmlFor="quote-discount" className="text-xs">Discount amount</Label><Input id="quote-discount" type="number" min="0" max="10000000" step="0.01" value={discountAmount} onChange={(event) => setDiscountAmount(event.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="quote-tax" className="text-xs">Tax / VAT (%)</Label><Input id="quote-tax" type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(event) => setTaxRate(event.target.value)} /></div>
              <div className="space-y-2 border-t border-border/70 pt-3 text-sm">
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(totals.subtotalMinor / 100, currency)}</span></div>
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Discount</span><span>−{formatCurrency(totals.discountMinor / 100, currency)}</span></div>
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Tax</span><span>{formatCurrency(totals.taxMinor / 100, currency)}</span></div>
                <div className="flex justify-between gap-2 border-t border-border/70 pt-2 font-bold"><span>Total</span><span className="text-emerald-700 dark:text-emerald-300">{formatCurrency(totals.totalMinor / 100, currency)}</span></div>
              </div>
              <p className="text-[10px] leading-relaxed text-muted-foreground">Tax is set to 0% by default. Confirm the correct treatment with your finance adviser; this quote is not a tax invoice.</p>
            </div>
          </div>

          {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy || !lead} className="bg-emerald-600 text-white hover:bg-emerald-700">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}Save draft quotation</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
