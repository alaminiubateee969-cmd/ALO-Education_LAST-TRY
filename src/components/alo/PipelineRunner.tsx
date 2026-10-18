"use client";

import { CheckCircle2, Circle, Loader2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { QualityAgentPass } from "@/lib/ai";

const PIPELINE_STAGES = [
  { agentId: "content_writer", name: "Draft writer", description: "Creates the first complete candidate." },
  { agentId: "quality_critic", name: "Quality critic", description: "Receives that candidate and returns issues plus a revision brief." },
  { agentId: "content_finalist", name: "Finalist editor", description: "Revises the candidate, then the app compares rubric scores." },
] as const;

export function QualityPipelineSummary({ passes }: { passes?: QualityAgentPass[] }) {
  if (!passes?.length) return null;
  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-600" /><h3 className="text-sm font-semibold">Sequential quality pipeline</h3></div>
        <p className="text-[10px] text-muted-foreground">Rubric scores are structural checks—not factual verification or a guaranteed “10×” result.</p>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {passes.map((pass, index) => {
          const complete = pass.status === "complete";
          const fallback = pass.status === "fallback";
          return (
            <div key={`${pass.agentId}-${index}`} className="rounded-lg border border-border/60 p-3">
              <div className="flex items-center gap-2">
                {complete ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : fallback ? <Circle className="h-4 w-4 shrink-0 text-amber-600" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />}
                <span className="text-xs font-semibold">{index + 1}. {pass.role}</span>
                <span className="ml-auto text-[9px] text-muted-foreground">{pass.status}</span>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{pass.summary}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{pass.agentId} · {pass.provider} · {pass.latencyMs} ms{pass.scoreBefore !== undefined && pass.scoreAfter !== undefined ? ` · ${pass.scoreBefore} → ${pass.scoreAfter}` : pass.scoreAfter !== undefined ? ` · rubric ${pass.scoreAfter}/100` : ""}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function PipelineRunner({ active }: { active: boolean }) {
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        {active ? <Loader2 className="h-4 w-4 animate-spin text-amber-600" /> : <Sparkles className="h-4 w-4 text-violet-600" />}
        <p className="text-xs font-semibold">Sequential local-agent review</p>
        <span className="text-[10px] text-amber-700">{active ? "Waiting for actual model passes…" : "Ready"}</span>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {PIPELINE_STAGES.map((stage, index) => (
          <div key={stage.agentId} className="rounded-lg border border-border/60 bg-background/60 p-3">
            <p className="text-[10px] font-semibold">{index + 1}. {stage.name}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{stage.description}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] leading-relaxed text-muted-foreground">Each pass receives the previous candidate. This indicator does not animate completed steps; real pass states and scores appear only when the API returns them.</p>
    </Card>
  );
}
