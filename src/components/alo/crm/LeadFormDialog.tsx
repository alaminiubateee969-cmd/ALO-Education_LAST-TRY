"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2, ShieldAlert, UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { crmFetch, getApiError } from "./api";
import type { LeadRecord } from "./types";

interface LeadForm {
  fullName: string;
  email: string;
  phone: string;
  targetCountry: string;
  studyLevel: string;
  courseInterest: string;
  intake: string;
  source: string;
  consentStatus: string;
  consentRecordedAt: string;
  nextFollowUp: string;
  notes: string;
}

const emptyForm: LeadForm = {
  fullName: "",
  email: "",
  phone: "",
  targetCountry: "",
  studyLevel: "",
  courseInterest: "",
  intake: "",
  source: "website",
  consentStatus: "unknown",
  consentRecordedAt: "",
  nextFollowUp: "",
  notes: "",
};

const inputClass = "h-9";
const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40";

export default function LeadFormDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (lead: LeadRecord) => void;
}) {
  const [form, setForm] = useState<LeadForm>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      setForm(emptyForm);
      setError("");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const set = (key: keyof LeadForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!form.email.trim() && !form.phone.trim()) {
      setError("Add at least one way to contact this enquiry.");
      return;
    }
    setBusy(true);
    try {
      const response = await crmFetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          consentRecordedAt: form.consentStatus === "consented" && form.consentRecordedAt ? form.consentRecordedAt : null,
          nextFollowUp: form.nextFollowUp || null,
          targetCountry: form.targetCountry || null,
          studyLevel: form.studyLevel || null,
          courseInterest: form.courseInterest || null,
          intake: form.intake || null,
          notes: form.notes || null,
        }),
      });
      if (!response.ok) throw new Error(await getApiError(response, "Could not create the enquiry."));
      const body = await response.json();
      onCreated(body.lead as LeadRecord);
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not create the enquiry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserRoundPlus className="h-5 w-5 text-amber-600" /> New enquiry</DialogTitle>
          <DialogDescription>Create a minimal admissions record and set the next follow-up. Sensitive immigration documents do not belong here.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="lead-name">Full name <span className="text-destructive">*</span></Label>
              <Input id="lead-name" className={inputClass} value={form.fullName} onChange={(event) => set("fullName", event.target.value)} required minLength={2} maxLength={120} autoComplete="name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-email">Email</Label>
              <Input id="lead-email" className={inputClass} type="email" value={form.email} onChange={(event) => set("email", event.target.value)} maxLength={254} autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-phone">Phone</Label>
              <Input id="lead-phone" className={inputClass} type="tel" value={form.phone} onChange={(event) => set("phone", event.target.value)} maxLength={40} autoComplete="tel" />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">An email address or phone number is required.</p>
            <div className="space-y-1.5">
              <Label htmlFor="lead-country">Target country</Label>
              <Input id="lead-country" className={inputClass} value={form.targetCountry} onChange={(event) => set("targetCountry", event.target.value)} maxLength={100} placeholder="United Kingdom" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-level">Study level</Label>
              <Input id="lead-level" className={inputClass} value={form.studyLevel} onChange={(event) => set("studyLevel", event.target.value)} maxLength={100} placeholder="Undergraduate, postgraduate…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-course">Course interest</Label>
              <Input id="lead-course" className={inputClass} value={form.courseInterest} onChange={(event) => set("courseInterest", event.target.value)} maxLength={160} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-intake">Intake / start date</Label>
              <Input id="lead-intake" className={inputClass} value={form.intake} onChange={(event) => set("intake", event.target.value)} maxLength={80} placeholder="September 2027" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-source">Enquiry source</Label>
              <select id="lead-source" className={selectClass} value={form.source} onChange={(event) => set("source", event.target.value)}>
                <option value="website">Website</option><option value="referral">Referral</option><option value="social">Social</option><option value="event">Event</option><option value="partner">Partner</option><option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-followup">Next follow-up</Label>
              <Input id="lead-followup" className={inputClass} type="date" value={form.nextFollowUp} onChange={(event) => set("nextFollowUp", event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-consent">Marketing preference</Label>
              <select id="lead-consent" className={selectClass} value={form.consentStatus} onChange={(event) => set("consentStatus", event.target.value)}>
                <option value="unknown">Not recorded</option><option value="consented">Opted in (consent captured)</option><option value="opted_out">Opted out</option>
              </select>
            </div>
            {form.consentStatus === "consented" && (
              <div className="space-y-1.5">
                <Label htmlFor="lead-consent-date">Consent capture date</Label>
                <Input id="lead-consent-date" className={inputClass} type="date" value={form.consentRecordedAt} onChange={(event) => set("consentRecordedAt", event.target.value)} required />
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="lead-notes">Notes</Label>
              <Textarea id="lead-notes" value={form.notes} onChange={(event) => set("notes", event.target.value)} maxLength={5000} rows={3} placeholder="Keep notes relevant to the education enquiry. Do not enter passport, visa, health, or payment-card details." />
            </div>
          </div>

          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs leading-relaxed text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Marketing consent is separate from answering an enquiry. This screen only records a preference; it does not send email, SMS, or WhatsApp messages.</p>
          </div>
          {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy} className="bg-amber-500 text-white hover:bg-amber-600">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRoundPlus className="h-4 w-4" />}
              Save enquiry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
