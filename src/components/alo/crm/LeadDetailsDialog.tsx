"use client";

import { FormEvent, useEffect, useState } from "react";
import { CalendarClock, CircleDollarSign, Loader2, MessageSquareText, Pencil, Trash2, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ACTIVITY_LABELS, ACTIVITY_TYPES, LEAD_STAGE_LABELS, LEAD_STAGES } from "@/lib/crm-constants";
import { crmFetch, formatDate, getApiError } from "./api";
import type { LeadActivityRecord, LeadRecord, QuotationRecord } from "./types";

interface LeadDetail extends LeadRecord {
  company?: { name: string; domain: string | null };
  activities: LeadActivityRecord[];
  quotations: QuotationRecord[];
}

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40";

export default function LeadDetailsDialog({
  lead,
  open,
  onOpenChange,
  onUpdated,
  onDeleted,
  onCreateQuote,
}: {
  lead: LeadRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (lead: LeadRecord) => void;
  onDeleted: (id: string) => void;
  onCreateQuote: (lead: LeadRecord) => void;
}) {
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({
    fullName: "", email: "", phone: "", targetCountry: "", studyLevel: "", courseInterest: "", intake: "", source: "website", consentStatus: "unknown", consentRecordedAt: "", notes: "",
  });
  const [stage, setStage] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [activityType, setActivityType] = useState<(typeof ACTIVITY_TYPES)[number]>("note");
  const [activityBody, setActivityBody] = useState("");

  async function loadDetail() {
    if (!lead) return;
    // Defer effect-driven form resets so this remains an async data load rather
    // than a synchronous render cascade.
    await Promise.resolve();
    setLoading(true);
    setError("");
    setDetail(null);
    setEditing(false);
    setActivityBody("");
    try {
      const response = await crmFetch(`/api/crm/leads/${encodeURIComponent(lead.id)}`);
      if (!response.ok) throw new Error(await getApiError(response, "Could not load this enquiry."));
      const body = await response.json();
      const next = body.lead as LeadDetail;
      setDetail(next);
      setStage(next.stage);
      setFollowUp(next.nextFollowUp ? new Date(next.nextFollowUp).toISOString().slice(0, 10) : "");
      setProfile({
        fullName: next.fullName ?? "", email: next.email ?? "", phone: next.phone ?? "", targetCountry: next.targetCountry ?? "", studyLevel: next.studyLevel ?? "", courseInterest: next.courseInterest ?? "", intake: next.intake ?? "", source: next.source || "website", consentStatus: next.consentStatus || "unknown", consentRecordedAt: next.consentRecordedAt ? new Date(next.consentRecordedAt).toISOString().slice(0, 10) : "", notes: next.notes ?? "",
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load this enquiry.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open || !lead) return;
    const frame = window.requestAnimationFrame(() => void loadDetail());
    return () => window.cancelAnimationFrame(frame);
  }, [open, lead?.id]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    setBusy(true);
    setError("");
    try {
      const response = await crmFetch(`/api/crm/leads/${encodeURIComponent(detail.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profile,
          email: profile.email.trim() || null,
          phone: profile.phone.trim() || null,
          targetCountry: profile.targetCountry || null,
          studyLevel: profile.studyLevel || null,
          courseInterest: profile.courseInterest || null,
          intake: profile.intake || null,
          consentRecordedAt: profile.consentStatus === "consented" && profile.consentRecordedAt ? profile.consentRecordedAt : null,
          notes: profile.notes || null,
        }),
      });
      if (!response.ok) throw new Error(await getApiError(response, "Could not update the enquiry."));
      const body = await response.json();
      setDetail((current) => current ? { ...current, ...body.lead } : current);
      onUpdated(body.lead as LeadRecord);
      setEditing(false);
      await loadDetail();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update the enquiry.");
    } finally {
      setBusy(false);
    }
  }

  async function saveStageAndFollowUp() {
    if (!detail) return;
    setBusy(true);
    setError("");
    try {
      const response = await crmFetch(`/api/crm/leads/${encodeURIComponent(detail.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, nextFollowUp: followUp || null }),
      });
      if (!response.ok) throw new Error(await getApiError(response, "Could not update the pipeline stage."));
      const body = await response.json();
      setDetail((current) => current ? { ...current, ...body.lead } : current);
      onUpdated(body.lead as LeadRecord);
      await loadDetail();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update the pipeline stage.");
    } finally {
      setBusy(false);
    }
  }

  async function addActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !activityBody.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await crmFetch(`/api/crm/leads/${encodeURIComponent(detail.id)}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: activityType, body: activityBody.trim() }),
      });
      if (!response.ok) throw new Error(await getApiError(response, "Could not log this activity."));
      setActivityBody("");
      await loadDetail();
    } catch (activityError) {
      setError(activityError instanceof Error ? activityError.message : "Could not log this activity.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteLead() {
    if (!detail || !window.confirm(`Permanently delete the enquiry for ${detail.fullName}? Related activities and quotations will also be deleted.`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await crmFetch(`/api/crm/leads/${encodeURIComponent(detail.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await getApiError(response, "Could not delete this enquiry."));
      onDeleted(detail.id);
      onOpenChange(false);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete this enquiry.");
    } finally {
      setBusy(false);
    }
  }

  const setProfileValue = (key: keyof typeof profile, value: string) => setProfile((current) => ({ ...current, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserRound className="h-5 w-5 text-amber-600" />{lead?.fullName ?? "Enquiry details"}</DialogTitle>
          <DialogDescription>Pipeline, contact preference, quotations, and a dated activity log.</DialogDescription>
        </DialogHeader>

        {loading && !detail ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading record…</div>
        ) : detail ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="space-y-4">
              <section className="rounded-xl border border-border/70 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">Enquiry profile</h3>
                    <p className="text-xs text-muted-foreground">Created {formatDate(detail.createdAt)}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditing((value) => !value)}>
                    {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                    {editing ? "Close edit" : "Edit details"}
                  </Button>
                </div>

                {editing ? (
                  <form onSubmit={saveProfile} className="space-y-3">
                    <div className="space-y-1"><Label htmlFor="edit-lead-name">Full name</Label><Input id="edit-lead-name" value={profile.fullName} onChange={(event) => setProfileValue("fullName", event.target.value)} required minLength={2} maxLength={120} /></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1"><Label htmlFor="edit-lead-email">Email</Label><Input id="edit-lead-email" type="email" value={profile.email} onChange={(event) => setProfileValue("email", event.target.value)} maxLength={254} /></div>
                      <div className="space-y-1"><Label htmlFor="edit-lead-phone">Phone</Label><Input id="edit-lead-phone" type="tel" value={profile.phone} onChange={(event) => setProfileValue("phone", event.target.value)} maxLength={40} /></div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1"><Label htmlFor="edit-lead-country">Target country</Label><Input id="edit-lead-country" value={profile.targetCountry} onChange={(event) => setProfileValue("targetCountry", event.target.value)} maxLength={100} /></div>
                      <div className="space-y-1"><Label htmlFor="edit-lead-level">Study level</Label><Input id="edit-lead-level" value={profile.studyLevel} onChange={(event) => setProfileValue("studyLevel", event.target.value)} maxLength={100} /></div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1"><Label htmlFor="edit-lead-course">Course interest</Label><Input id="edit-lead-course" value={profile.courseInterest} onChange={(event) => setProfileValue("courseInterest", event.target.value)} maxLength={160} /></div>
                      <div className="space-y-1"><Label htmlFor="edit-lead-intake">Intake</Label><Input id="edit-lead-intake" value={profile.intake} onChange={(event) => setProfileValue("intake", event.target.value)} maxLength={80} /></div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1"><Label htmlFor="edit-lead-source">Source</Label><select id="edit-lead-source" className={selectClass} value={profile.source} onChange={(event) => setProfileValue("source", event.target.value)}><option value="website">Website</option><option value="referral">Referral</option><option value="social">Social</option><option value="event">Event</option><option value="partner">Partner</option><option value="other">Other</option></select></div>
                      <div className="space-y-1"><Label htmlFor="edit-lead-consent">Marketing preference</Label><select id="edit-lead-consent" className={selectClass} value={profile.consentStatus} onChange={(event) => setProfileValue("consentStatus", event.target.value)}><option value="unknown">Not recorded</option><option value="consented">Opted in</option><option value="opted_out">Opted out</option></select></div>
                    </div>
                    {profile.consentStatus === "consented" && <div className="space-y-1"><Label htmlFor="edit-lead-consent-date">Consent capture date</Label><Input id="edit-lead-consent-date" type="date" value={profile.consentRecordedAt} onChange={(event) => setProfileValue("consentRecordedAt", event.target.value)} required /></div>}
                    <div className="space-y-1"><Label htmlFor="edit-lead-notes">Notes</Label><Textarea id="edit-lead-notes" rows={3} maxLength={5000} value={profile.notes} onChange={(event) => setProfileValue("notes", event.target.value)} /></div>
                    <Button type="submit" size="sm" disabled={busy} className="bg-amber-500 text-white hover:bg-amber-600">{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Save details</Button>
                  </form>
                ) : (
                  <div className="space-y-3">
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <div className="rounded-lg bg-muted/40 p-2.5"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Email</p>{detail.email ? <a className="break-all font-medium text-amber-700 hover:underline" href={`mailto:${detail.email}`}>{detail.email}</a> : <span className="text-muted-foreground">Not supplied</span>}</div>
                      <div className="rounded-lg bg-muted/40 p-2.5"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Phone</p>{detail.phone ? <a className="font-medium text-amber-700 hover:underline" href={`tel:${detail.phone}`}>{detail.phone}</a> : <span className="text-muted-foreground">Not supplied</span>}</div>
                      <div className="rounded-lg bg-muted/40 p-2.5"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Destination / course</p><p className="font-medium">{[detail.targetCountry, detail.courseInterest].filter(Boolean).join(" · ") || "Not specified"}</p></div>
                      <div className="rounded-lg bg-muted/40 p-2.5"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Study / intake</p><p className="font-medium">{[detail.studyLevel, detail.intake].filter(Boolean).join(" · ") || "Not specified"}</p></div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={`rounded-full px-2.5 py-1 font-medium ${detail.consentStatus === "consented" ? "bg-emerald-100 text-emerald-800" : detail.consentStatus === "opted_out" ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700"}`}>Marketing: {detail.consentStatus === "consented" ? "opted in" : detail.consentStatus === "opted_out" ? "opted out" : "not recorded"}</span>
                      <span className="text-muted-foreground">Source: {detail.source}</span>
                    </div>
                    {detail.notes && <p className="whitespace-pre-wrap rounded-lg border border-border/60 p-3 text-sm text-muted-foreground">{detail.notes}</p>}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-border/70 p-4">
                <div className="mb-3 flex items-center gap-2"><CalendarClock className="h-4 w-4 text-amber-600" /><h3 className="text-sm font-semibold">Pipeline & follow-up</h3></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1"><Label htmlFor="lead-stage">Stage</Label><select id="lead-stage" className={selectClass} value={stage} onChange={(event) => setStage(event.target.value)}>{LEAD_STAGES.map((value) => <option key={value} value={value}>{LEAD_STAGE_LABELS[value]}</option>)}</select></div>
                  <div className="space-y-1"><Label htmlFor="lead-follow-up">Next follow-up</Label><Input id="lead-follow-up" type="date" value={followUp} onChange={(event) => setFollowUp(event.target.value)} /></div>
                </div>
                <Button type="button" size="sm" variant="outline" className="mt-3" onClick={saveStageAndFollowUp} disabled={busy || (stage === detail.stage && (followUp || "") === (detail.nextFollowUp ? new Date(detail.nextFollowUp).toISOString().slice(0, 10) : ""))}>
                  {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Save pipeline update
                </Button>
              </section>

              <section className="rounded-xl border border-border/70 p-4">
                <div className="mb-3 flex items-center gap-2"><CircleDollarSign className="h-4 w-4 text-emerald-600" /><h3 className="text-sm font-semibold">Quotations</h3><span className="ml-auto text-xs text-muted-foreground">{detail.quotations.length}</span></div>
                {detail.quotations.length ? <div className="mb-3 space-y-2">{detail.quotations.slice(0, 4).map((quote) => <div key={quote.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs"><span className="min-w-0 truncate font-medium">{quote.number} · {quote.title}</span><span className="shrink-0 capitalize text-muted-foreground">{quote.status}</span></div>)}</div> : <p className="mb-3 text-xs text-muted-foreground">No quotation prepared for this enquiry yet.</p>}
                <Button type="button" size="sm" onClick={() => onCreateQuote(detail)} className="bg-emerald-600 text-white hover:bg-emerald-700"><CircleDollarSign className="h-3.5 w-3.5" />Create quotation</Button>
              </section>

              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={deleteLead} className="text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" />Delete enquiry</Button>
            </div>

            <section className="flex min-h-[32rem] flex-col rounded-xl border border-border/70 p-4">
              <div className="mb-3 flex items-center gap-2"><MessageSquareText className="h-4 w-4 text-violet-600" /><h3 className="text-sm font-semibold">Activity timeline</h3><span className="ml-auto text-xs text-muted-foreground">{detail.activities.length}</span></div>
              <form onSubmit={addActivity} className="mb-4 space-y-2 rounded-lg bg-muted/30 p-3">
                <div className="flex gap-2">
                  <select aria-label="Activity type" className={`${selectClass} max-w-40`} value={activityType} onChange={(event) => setActivityType(event.target.value as (typeof ACTIVITY_TYPES)[number])}>{ACTIVITY_TYPES.map((type) => <option key={type} value={type}>{ACTIVITY_LABELS[type]}</option>)}</select>
                  <Button type="submit" size="sm" disabled={busy || !activityBody.trim()} className="shrink-0 bg-amber-500 text-white hover:bg-amber-600">Log activity</Button>
                </div>
                <Textarea aria-label="Activity note" value={activityBody} onChange={(event) => setActivityBody(event.target.value)} rows={2} maxLength={5000} placeholder="Record a conversation summary or next step…" />
              </form>

              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {detail.activities.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No activity logged yet.</p> : detail.activities.map((activity) => (
                  <div key={activity.id} className="relative border-l border-amber-300 pl-4 pb-1 last:border-transparent">
                    <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-amber-500" />
                    <div className="flex flex-wrap items-baseline justify-between gap-1"><p className="text-xs font-semibold">{ACTIVITY_LABELS[activity.type as keyof typeof ACTIVITY_LABELS] ?? activity.type.replaceAll("_", " ")}</p><time className="text-[10px] text-muted-foreground">{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(activity.createdAt))}</time></div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{activity.body}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {error && <p role="alert" className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <DialogFooter className="sm:justify-between">
          <p className="text-[11px] text-muted-foreground">Activities are internal CRM records; communications are not sent from this screen.</p>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
