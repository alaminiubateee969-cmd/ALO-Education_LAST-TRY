"use client";

import { useState } from "react";
import { Loader2, Printer, Send, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { crmFetch, getApiError } from "./api";
import type { QuotationRecord } from "./types";
import QuotationDocument from "./QuotationDocument";
import { openQuotationPrintWindow } from "./print-quotation";

export default function QuotationPreviewDialog({
  quote,
  open,
  onOpenChange,
  onUpdated,
  onDeleted,
}: {
  quote: QuotationRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (quote: QuotationRecord) => void;
  onDeleted: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function setStatus(status: string) {
    if (!quote) return;
    setBusy(true);
    setError("");
    try {
      const response = await crmFetch(`/api/crm/quotes/${encodeURIComponent(quote.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error(await getApiError(response, "Could not update quotation status."));
      const body = await response.json();
      onUpdated(body.quote as QuotationRecord);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Could not update quotation status.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDraft() {
    if (!quote || !window.confirm(`Delete draft ${quote.number}?`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await crmFetch(`/api/crm/quotes/${encodeURIComponent(quote.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await getApiError(response, "Could not delete this quotation."));
      onDeleted(quote.id);
      onOpenChange(false);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete this quotation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto print-quote-shell">
        <DialogHeader className="print:hidden">
          <DialogTitle>{quote?.number ?? "Quotation preview"}</DialogTitle>
          <DialogDescription>Review the printable customer copy. Status updates are records only; no email or payment request is sent.</DialogDescription>
        </DialogHeader>
        {quote && <QuotationDocument quote={quote} />}
        {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive print:hidden">{error}</p>}
        <DialogFooter className="print:hidden sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {quote?.status === "draft" && <>
              <Button type="button" size="sm" onClick={() => void setStatus("sent")} disabled={busy} className="bg-amber-500 text-white hover:bg-amber-600"><Send className="h-3.5 w-3.5" />Mark as sent</Button>
              <Button type="button" size="sm" variant="outline" onClick={deleteDraft} disabled={busy} className="text-destructive"><Trash2 className="h-3.5 w-3.5" />Delete draft</Button>
            </>}
            {quote?.status === "sent" && <>
              <Button type="button" size="sm" onClick={() => void setStatus("accepted")} disabled={busy} className="bg-emerald-600 text-white hover:bg-emerald-700"><ThumbsUp className="h-3.5 w-3.5" />Mark accepted</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void setStatus("declined")} disabled={busy}><ThumbsDown className="h-3.5 w-3.5" />Mark declined</Button>
            </>}
            {busy && <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" />}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => {
              if (quote && !openQuotationPrintWindow(quote)) setError("Allow pop-ups for this site to print or save the quotation as PDF.");
            }}><Printer className="h-4 w-4" />Print / Save PDF</Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
