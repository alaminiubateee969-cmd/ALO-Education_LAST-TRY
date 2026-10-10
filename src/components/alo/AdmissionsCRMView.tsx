"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine, CalendarClock, CircleDollarSign, FileText,
  Loader2, Plus, RefreshCw, Search, UsersRound, UserRoundPlus, Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LEAD_STAGE_LABELS, LEAD_STAGES } from "@/lib/crm-constants";
import { SectionHeader, StatCard } from "./primitives";
import AdmissionPipeline from "./crm/AdmissionPipeline";
import LeadFormDialog from "./crm/LeadFormDialog";
import LeadDetailsDialog from "./crm/LeadDetailsDialog";
import QuotationBuilderDialog from "./crm/QuotationBuilderDialog";
import QuotationPreviewDialog from "./crm/QuotationPreviewDialog";
import { crmFetch, formatCurrency, formatDate, getApiError } from "./crm/api";
import type { LeadRecord, QuotationRecord } from "./crm/types";

interface CrmStats {
  total: number;
  new: number;
  followUpsDue: number;
  openQuotations: number;
}

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40";

function stagePill(stage: string) {
  if (stage === "enrolled") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (stage === "lost") return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  if (stage === "proposal_sent") return "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300";
  return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
}

function consentPill(status: string) {
  if (status === "consented") return "bg-emerald-100 text-emerald-800";
  if (status === "opted_out") return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-700";
}

function getFollowUpState(value: string | null, stage: string) {
  if (!value || stage === "enrolled" || stage === "lost") return "";
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  if (due < today) return "overdue";
  if (due.getTime() === today.getTime()) return "today";
  return "scheduled";
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(leads: LeadRecord[]) {
  const columns = ["Name", "Email", "Phone", "Target country", "Study level", "Course interest", "Intake", "Stage", "Source", "Marketing preference", "Next follow-up", "Created"];
  const rows = leads.map((lead) => [lead.fullName, lead.email, lead.phone, lead.targetCountry, lead.studyLevel, lead.courseInterest, lead.intake, lead.stage, lead.source, lead.consentStatus, lead.nextFollowUp ? formatDate(lead.nextFollowUp) : "", formatDate(lead.createdAt)]);
  const csv = "\uFEFF" + [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `alo-enquiries-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function PipelineBoard({
  leads,
  onOpen,
  onStageChange,
}: {
  leads: LeadRecord[];
  onOpen: (lead: LeadRecord) => void;
  onStageChange: (lead: LeadRecord, stage: string) => void;
}) {
  return (
    <div className="overflow-x-auto pb-3 alo-scrollbar">
      <div className="grid min-w-[1470px] grid-cols-7 gap-2">
        {LEAD_STAGES.map((stage) => {
          const records = leads.filter((lead) => lead.stage === stage);
          return (
            <section key={stage} aria-label={`${LEAD_STAGE_LABELS[stage]}: ${records.length} enquiries`} className="min-h-64 rounded-xl bg-muted/40 p-2">
              <div className="mb-2 flex items-start justify-between gap-1 px-1 pt-1">
                <h3 className="text-[11px] font-semibold leading-snug">{LEAD_STAGE_LABELS[stage]}</h3>
                <span className="rounded-full bg-background px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">{records.length}</span>
              </div>
              <div className="space-y-2">
                {records.map((lead) => {
                  const followUpState = getFollowUpState(lead.nextFollowUp, lead.stage);
                  return (
                    <Card key={lead.id} className="p-2.5 shadow-sm">
                      <button type="button" className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60" onClick={() => onOpen(lead)}>
                        <span className="block truncate text-xs font-semibold">{lead.fullName}</span>
                        <span className="mt-1 block truncate text-[10px] text-muted-foreground">{[lead.targetCountry, lead.courseInterest].filter(Boolean).join(" · ") || "Study plan not set"}</span>
                      </button>
                      <div className="mt-2 flex items-center justify-between gap-1">
                        {lead.nextFollowUp ? <span className={`truncate text-[9px] ${followUpState === "overdue" ? "font-semibold text-rose-600" : followUpState === "today" ? "font-semibold text-amber-700" : "text-muted-foreground"}`}>{followUpState === "overdue" ? "Overdue · " : followUpState === "today" ? "Today · " : "Next · "}{formatDate(lead.nextFollowUp)}</span> : <span className="text-[9px] text-muted-foreground">No follow-up</span>}
                      </div>
                      <select aria-label={`Move ${lead.fullName} to another stage`} className="mt-2 h-7 w-full rounded-md border border-border bg-background px-1.5 text-[10px]" value={lead.stage} onChange={(event) => onStageChange(lead, event.target.value)}>
                        {LEAD_STAGES.map((value) => <option key={value} value={value}>{LEAD_STAGE_LABELS[value]}</option>)}
                      </select>
                    </Card>
                  );
                })}
                {records.length === 0 && <div className="rounded-lg border border-dashed border-border/80 px-2 py-6 text-center text-[10px] text-muted-foreground">No enquiries</div>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function LeadCard({ lead, onOpen }: { lead: LeadRecord; onOpen: (lead: LeadRecord) => void }) {
  const followUpState = getFollowUpState(lead.nextFollowUp, lead.stage);
  return (
    <Card className="p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={() => onOpen(lead)} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60">
          <span className="block truncate font-semibold">{lead.fullName}</span>
          <span className="mt-1 block truncate text-xs text-muted-foreground">{[lead.targetCountry, lead.courseInterest].filter(Boolean).join(" · ") || "Education enquiry"}</span>
        </button>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${stagePill(lead.stage)}`}>{LEAD_STAGE_LABELS[lead.stage as keyof typeof LEAD_STAGE_LABELS] ?? lead.stage}</span>
      </div>
      <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        {lead.email && <p className="truncate">{lead.email}</p>}
        {lead.phone && <p>{lead.phone}</p>}
        <p>{lead.studyLevel || "Study level not set"}{lead.intake ? ` · ${lead.intake}` : ""}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${consentPill(lead.consentStatus)}`}>Marketing {lead.consentStatus === "consented" ? "opt-in" : lead.consentStatus === "opted_out" ? "opt-out" : "unknown"}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] text-muted-foreground">{lead.source}</span>
        {lead._count && <span className="ml-auto text-[9px] text-muted-foreground">{lead._count.activities} updates · {lead._count.quotations} quotes</span>}
      </div>
      <div className={`mt-3 flex items-center gap-1.5 border-t border-border/60 pt-2 text-[11px] ${followUpState === "overdue" ? "font-semibold text-rose-600" : followUpState === "today" ? "font-semibold text-amber-700" : "text-muted-foreground"}`}>
        <CalendarClock className="h-3.5 w-3.5" />
        {lead.nextFollowUp ? `${followUpState === "overdue" ? "Overdue" : followUpState === "today" ? "Due today" : "Follow-up"} · ${formatDate(lead.nextFollowUp)}` : "No follow-up scheduled"}
      </div>
    </Card>
  );
}

function QuoteCard({ quote, onOpen }: { quote: QuotationRecord; onOpen: (quote: QuotationRecord) => void }) {
  return (
    <Card className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{quote.number}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${quote.status === "accepted" ? "bg-emerald-100 text-emerald-800" : quote.status === "declined" || quote.status === "expired" ? "bg-slate-100 text-slate-700" : quote.status === "sent" ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-800"}`}>{quote.status}</span>
        </div>
        <p className="mt-1 truncate text-sm">{quote.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">For {quote.lead?.fullName ?? "Enquiry"} · Created {formatDate(quote.createdAt)}{quote.validUntil ? ` · Valid until ${formatDate(quote.validUntil)}` : ""}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{quote.items.length} line item{quote.items.length === 1 ? "" : "s"}</p>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="text-lg font-semibold tabular-nums">{formatCurrency(quote.total, quote.currency)}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => onOpen(quote)}><FileText className="h-3.5 w-3.5" />Review</Button>
      </div>
    </Card>
  );
}

export default function AdmissionsCRMView() {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [quotes, setQuotes] = useState<QuotationRecord[]>([]);
  const [stats, setStats] = useState<CrmStats>({ total: 0, new: 0, followUpsDue: 0, openQuotations: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [dueOnly, setDueOnly] = useState(false);
  const [pipelineStage, setPipelineStage] = useState("all");
  const [quoteQuery, setQuoteQuery] = useState("");
  const [quoteStatus, setQuoteStatus] = useState("all");
  const [tab, setTab] = useState("pipeline");
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null);
  const [leadDetailOpen, setLeadDetailOpen] = useState(false);
  const [quoteLead, setQuoteLead] = useState<LeadRecord | null>(null);
  const [quoteBuilderOpen, setQuoteBuilderOpen] = useState(false);
  const [selectLeadOpen, setSelectLeadOpen] = useState(false);
  const [quoteLeadId, setQuoteLeadId] = useState("");
  const [selectedQuote, setSelectedQuote] = useState<QuotationRecord | null>(null);
  const [quotePreviewOpen, setQuotePreviewOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [leadResponse, quoteResponse] = await Promise.all([crmFetch("/api/crm/leads"), crmFetch("/api/crm/quotes")]);
      if (!leadResponse.ok) throw new Error(await getApiError(leadResponse, "Could not load enquiries."));
      if (!quoteResponse.ok) throw new Error(await getApiError(quoteResponse, "Could not load quotations."));
      const [leadBody, quoteBody] = await Promise.all([leadResponse.json(), quoteResponse.json()]);
      setError("");
      setLeads(leadBody.leads as LeadRecord[]);
      setStats(leadBody.stats as CrmStats);
      setQuotes(quoteBody.quotes as QuotationRecord[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the CRM workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    const companyChanged = () => void refresh();
    window.addEventListener("alo-company-changed", companyChanged);
    window.addEventListener("storage", companyChanged);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("alo-company-changed", companyChanged);
      window.removeEventListener("storage", companyChanged);
    };
  }, [load, refresh]);

  const filteredLeads = useMemo(() => leads.filter((lead) => {
    if (stageFilter !== "all" && lead.stage !== stageFilter) return false;
    const followUpState = getFollowUpState(lead.nextFollowUp, lead.stage);
    if (dueOnly && followUpState !== "overdue" && followUpState !== "today") return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return [lead.fullName, lead.email, lead.phone, lead.targetCountry, lead.courseInterest, lead.studyLevel, lead.intake].some((value) => value?.toLowerCase().includes(needle));
  }), [leads, stageFilter, dueOnly, query]);

  const filteredQuotes = useMemo(() => quotes.filter((quote) => {
    if (quoteStatus !== "all" && quote.status !== quoteStatus) return false;
    const needle = quoteQuery.trim().toLowerCase();
    return !needle || [quote.number, quote.title, quote.lead?.fullName].some((value) => value?.toLowerCase().includes(needle));
  }), [quotes, quoteStatus, quoteQuery]);

  const visiblePipelineLeads = useMemo(() => leads.filter((lead) => pipelineStage === "all" || lead.stage === pipelineStage), [leads, pipelineStage]);

  const openLead = (lead: LeadRecord) => {
    setSelectedLead(lead);
    setLeadDetailOpen(true);
  };

  const patchStage = async (lead: LeadRecord, stage: string) => {
    if (stage === lead.stage) return;
    setError("");
    try {
      const response = await crmFetch(`/api/crm/leads/${encodeURIComponent(lead.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!response.ok) throw new Error(await getApiError(response, "Could not move this enquiry."));
      const body = await response.json();
      setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, ...body.lead } : item));
      void load();
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "Could not move this enquiry.");
    }
  };

  const openQuoteBuilder = (lead: LeadRecord) => {
    setQuoteLead(lead);
    setLeadDetailOpen(false);
    setQuoteBuilderOpen(true);
  };

  const proceedWithSelectedLead = () => {
    const lead = leads.find((item) => item.id === quoteLeadId);
    if (!lead) return;
    setSelectLeadOpen(false);
    openQuoteBuilder(lead);
  };

  const handleQuoteCreated = (quote: QuotationRecord) => {
    setQuotes((current) => [quote, ...current]);
    setSelectedQuote(quote);
    setQuotePreviewOpen(true);
    void load();
  };

  const onQuoteUpdated = (quote: QuotationRecord) => {
    setQuotes((current) => current.map((item) => item.id === quote.id ? quote : item));
    setSelectedQuote(quote);
    void load();
  };

  const onQuoteDeleted = (id: string) => {
    setQuotes((current) => current.filter((quote) => quote.id !== id));
    setSelectedQuote(null);
    void load();
  };

  const handleLeadUpdated = (updated: LeadRecord) => {
    setLeads((current) => current.map((lead) => lead.id === updated.id ? { ...lead, ...updated } : lead));
    setSelectedLead((current) => current?.id === updated.id ? { ...current, ...updated } : current);
    void load();
  };

  const handleLeadDeleted = (id: string) => {
    setLeads((current) => current.filter((lead) => lead.id !== id));
    setQuotes((current) => current.filter((quote) => quote.leadId !== id));
    setSelectedLead(null);
    void load();
  };

  const handleLeadCreated = (lead: LeadRecord) => {
    setLeads((current) => [lead, ...current]);
    setSelectedLead(lead);
    setLeadDetailOpen(true);
    void load();
  };

  const openQuotePicker = () => {
    if (leads.length === 0) {
      setError("Create an enquiry before preparing a quotation.");
      setTab("enquiries");
      return;
    }
    setQuoteLeadId(leads[0].id);
    setSelectLeadOpen(true);
  };

  return (
    <div className="space-y-5 alo-fade-up">
      <SectionHeader
        title="Admissions CRM"
        bn="Enquiries & proposals"
        desc="One workspace for enquiry records, follow-ups, stage history, consent preferences, and printable quotations. Communications are logged here—not sent automatically."
        icon={<UsersRound className="h-5 w-5" />}
        action={<div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={refreshing}>{refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Refresh</Button><Button type="button" size="sm" onClick={() => setNewLeadOpen(true)} className="bg-amber-500 text-white hover:bg-amber-600"><UserRoundPlus className="h-4 w-4" />New enquiry</Button></div>}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Enquiries" value={stats.total} sub="in this workspace" icon={<UsersRound className="h-4 w-4" />} tone="amber" />
        <StatCard label="New" value={stats.new} sub="awaiting qualification" icon={<Plus className="h-4 w-4" />} tone="violet" />
        <StatCard label="Follow-ups due" value={stats.followUpsDue} sub="today or overdue · open enquiries" icon={<CalendarClock className="h-4 w-4" />} tone={stats.followUpsDue ? "rose" : "emerald"} />
        <StatCard label="Open quotations" value={stats.openQuotations} sub="draft or sent" icon={<CircleDollarSign className="h-4 w-4" />} tone="sky" />
      </div>

      <AdmissionPipeline leads={leads} selectedStage={pipelineStage} onSelectStage={(stage) => { setPipelineStage(stage); setStageFilter(stage); setTab(stage === "all" ? "pipeline" : "enquiries"); }} />

      {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <TabsList className="grid h-auto w-full grid-cols-3 sm:w-auto">
            <TabsTrigger value="pipeline" className="gap-1.5 text-xs"><Workflow className="h-3.5 w-3.5" />Pipeline board</TabsTrigger>
            <TabsTrigger value="enquiries" className="gap-1.5 text-xs"><UsersRound className="h-3.5 w-3.5" />Enquiries</TabsTrigger>
            <TabsTrigger value="quotations" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" />Quotations</TabsTrigger>
          </TabsList>
          {tab === "quotations" ? (
            <Button type="button" size="sm" onClick={openQuotePicker} className="bg-emerald-600 text-white hover:bg-emerald-700"><CircleDollarSign className="h-4 w-4" />New quotation</Button>
          ) : tab === "enquiries" ? (
            <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => downloadCsv(filteredLeads)} disabled={!filteredLeads.length}><ArrowDownToLine className="h-4 w-4" />Export filtered CSV</Button><Button type="button" size="sm" onClick={() => setNewLeadOpen(true)} className="bg-amber-500 text-white hover:bg-amber-600"><UserRoundPlus className="h-4 w-4" />New enquiry</Button></div>
          ) : null}
        </div>

        <TabsContent value="pipeline" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Move an enquiry with the stage selector, or open its record to review the activity and follow-up history.</p><span className="text-xs text-muted-foreground">{leads.length} loaded · latest 250</span></div>
          {loading ? <div className="grid min-w-[1300px] grid-cols-7 gap-2">{Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-52 rounded-xl alo-shimmer" />)}</div> : leads.length === 0 ? <Card className="p-12 text-center"><Workflow className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" /><p className="font-medium">Your admissions pipeline is ready</p><p className="mt-1 text-sm text-muted-foreground">Add an enquiry to start tracking progress.</p><Button className="mt-4 bg-amber-500 text-white hover:bg-amber-600" onClick={() => setNewLeadOpen(true)}><UserRoundPlus className="h-4 w-4" />Add first enquiry</Button></Card> : <PipelineBoard leads={visiblePipelineLeads} onOpen={openLead} onStageChange={patchStage} />}
        </TabsContent>

        <TabsContent value="enquiries" className="mt-4 space-y-4">
          <Card className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, contact, country, course…" className="pl-9" /></div>
            <select aria-label="Filter enquiries by stage" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-52" value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}><option value="all">All stages</option>{LEAD_STAGES.map((stage) => <option key={stage} value={stage}>{LEAD_STAGE_LABELS[stage]}</option>)}</select>
            <Button type="button" size="sm" variant={dueOnly ? "default" : "outline"} onClick={() => setDueOnly((value) => !value)} aria-pressed={dueOnly} className={dueOnly ? "bg-rose-600 text-white hover:bg-rose-700" : ""}><CalendarClock className="h-4 w-4" />Due only</Button>
          </Card>
          {loading ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-44 rounded-xl alo-shimmer" />)}</div> : filteredLeads.length === 0 ? <Card className="p-12 text-center"><Search className="mx-auto mb-3 h-9 w-9 text-muted-foreground/30" /><p className="font-medium">No matching enquiries</p><p className="mt-1 text-sm text-muted-foreground">Change the filters or add a new enquiry.</p></Card> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filteredLeads.map((lead) => <LeadCard key={lead.id} lead={lead} onOpen={openLead} />)}</div>}
          <p className="text-[11px] text-muted-foreground">Export includes only the records currently visible after filtering. Keep downloaded CSV files secure and delete them when no longer needed.</p>
        </TabsContent>

        <TabsContent value="quotations" className="mt-4 space-y-4">
          <Card className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={quoteQuery} onChange={(event) => setQuoteQuery(event.target.value)} placeholder="Search quote number, title, or enquiry…" className="pl-9" /></div>
            <select aria-label="Filter quotations by status" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-48" value={quoteStatus} onChange={(event) => setQuoteStatus(event.target.value)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="sent">Sent</option><option value="accepted">Accepted</option><option value="declined">Declined</option><option value="expired">Expired</option></select>
          </Card>
          {loading ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-xl alo-shimmer" />)}</div> : filteredQuotes.length === 0 ? <Card className="p-12 text-center"><FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" /><p className="font-medium">No quotations yet</p><p className="mt-1 text-sm text-muted-foreground">Choose an enquiry to prepare a printable draft. Nothing is sent automatically.</p><Button className="mt-4 bg-emerald-600 text-white hover:bg-emerald-700" onClick={openQuotePicker} disabled={!leads.length}><CircleDollarSign className="h-4 w-4" />Prepare first quotation</Button></Card> : <div className="space-y-2">{filteredQuotes.map((quote) => <QuoteCard key={quote.id} quote={quote} onOpen={(value) => { setSelectedQuote(value); setQuotePreviewOpen(true); }} />)}</div>}
        </TabsContent>
      </Tabs>

      <LeadFormDialog open={newLeadOpen} onOpenChange={setNewLeadOpen} onCreated={handleLeadCreated} />
      <LeadDetailsDialog lead={selectedLead} open={leadDetailOpen} onOpenChange={setLeadDetailOpen} onUpdated={handleLeadUpdated} onDeleted={handleLeadDeleted} onCreateQuote={openQuoteBuilder} />
      <QuotationBuilderDialog lead={quoteLead} open={quoteBuilderOpen} onOpenChange={setQuoteBuilderOpen} onCreated={handleQuoteCreated} />
      <QuotationPreviewDialog quote={selectedQuote} open={quotePreviewOpen} onOpenChange={setQuotePreviewOpen} onUpdated={onQuoteUpdated} onDeleted={onQuoteDeleted} />

      <Dialog open={selectLeadOpen} onOpenChange={setSelectLeadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Choose an enquiry</DialogTitle><DialogDescription>A quotation will be attached to the selected CRM record.</DialogDescription></DialogHeader>
          <div className="space-y-2"><Label htmlFor="quote-lead-select">Enquiry</Label><select id="quote-lead-select" className={selectClass} value={quoteLeadId} onChange={(event) => setQuoteLeadId(event.target.value)}>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.fullName}{lead.courseInterest ? ` — ${lead.courseInterest}` : ""}</option>)}</select></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setSelectLeadOpen(false)}>Cancel</Button><Button type="button" onClick={proceedWithSelectedLead} className="bg-emerald-600 text-white hover:bg-emerald-700">Continue</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
