"use client";

import { ChevronRight, Route } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LEAD_STAGE_LABELS, LEAD_STAGES, type LeadStage } from "@/lib/crm-constants";
import type { LeadRecord } from "./types";

export default function AdmissionPipeline({
  leads,
  selectedStage,
  onSelectStage,
}: {
  leads: LeadRecord[];
  selectedStage: string;
  onSelectStage: (stage: string) => void;
}) {
  const stageCounts = new Map<string, number>();
  for (const stage of LEAD_STAGES) stageCounts.set(stage, 0);
  for (const lead of leads) stageCounts.set(lead.stage, (stageCounts.get(lead.stage) ?? 0) + 1);

  return (
    <Card className="overflow-hidden border-border/70 p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-xl bg-amber-500/10 p-2 text-amber-700 dark:text-amber-300"><Route className="h-4 w-4" /></div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Admissions journey</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Select a stage to focus the board. Counts reflect the current workspace.</p>
        </div>
        <button type="button" className={`ml-auto shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${selectedStage === "all" ? "border-amber-500 bg-amber-500 text-white" : "border-border text-muted-foreground hover:bg-muted"}`} onClick={() => onSelectStage("all")} aria-pressed={selectedStage === "all"}>
          All {leads.length}
        </button>
      </div>
      <div className="overflow-x-auto pb-2 alo-scrollbar">
        <ol className="flex min-w-max items-stretch gap-1" aria-label="Admissions pipeline stages">
          {LEAD_STAGES.map((stage, index) => {
            const count = stageCounts.get(stage) ?? 0;
            const selected = selectedStage === stage;
            const isTerminal = stage === "enrolled" || stage === "lost";
            return (
              <li key={stage} className="flex items-center">
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${LEAD_STAGE_LABELS[stage as LeadStage]}: ${count} enquiries`}
                  onClick={() => onSelectStage(selected ? "all" : stage)}
                  className={`group flex w-[136px] flex-col rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 ${selected ? "border-amber-500 bg-amber-500/10 shadow-sm" : "border-border/70 bg-background hover:border-amber-300 hover:bg-amber-50/50 dark:hover:bg-amber-950/10"}`}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className={`h-2 w-2 rounded-full ${stage === "enrolled" ? "bg-emerald-500" : stage === "lost" ? "bg-slate-400" : selected ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600"}`} aria-hidden="true" />
                    <span className={`ml-auto text-lg font-semibold tabular-nums ${selected ? "text-amber-700 dark:text-amber-300" : "text-foreground"}`}>{count}</span>
                  </span>
                  <span className="mt-2 text-[11px] font-semibold leading-snug">{LEAD_STAGE_LABELS[stage as LeadStage]}</span>
                  <span className="mt-1 text-[9px] text-muted-foreground">{isTerminal ? "Outcome" : "In progress"}</span>
                </button>
                {index < LEAD_STAGES.length - 1 && <ChevronRight aria-hidden="true" className="mx-0.5 h-4 w-4 shrink-0 text-amber-500/70" />}
              </li>
            );
          })}
        </ol>
      </div>
    </Card>
  );
}
