"use client";

import { useEffect, useState } from "react";
import { SectionHeader, StatCard } from "./primitives";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AGENT_CATEGORIES, type AgentCategory } from "@/lib/agents";
import { DollarSign, Cpu, Cloud, HardDrive, Activity, Zap, Server } from "lucide-react";

interface AgentCost {
  id: string;
  name: string;
  category: string;
  provider: string;
  model: string;
  estimatedCostUsd: number;
  status: string;
}

interface Data {
  agentCosts: AgentCost[];
  providers: { count: number; cost: number; label: string }[];
  categories: { category: string; count: number; cost: number }[];
  summary: {
    totalAgents: number;
    totalCost: number;
    localCount: number;
    externalCount: number;
    paidApiCount: number;
    localPct: number;
    blockedCount: number;
    avgCostPerAgent: number;
  };
}

const providerMeta: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  local: { icon: <HardDrive className="h-4 w-4" />, color: "text-emerald-600", bg: "bg-emerald-100", label: "Local model" },
  "external-optional": { icon: <Server className="h-4 w-4" />, color: "text-violet-600", bg: "bg-violet-100", label: "External provider" },
};

const catLabel: Record<string, string> = {
  orchestration: "অর্কেস্ট্রেশন",
  research: "গবেষণা",
  content: "কনটেন্ট",
  safety: "নিরাপত্তা",
  media: "মিডিয়া",
  publishing: "প্রকাশনা",
  community: "কমিউনিটি",
  learning: "শেখা",
  ops: "পরিচালনা",
};

export default function CostUsageView() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/costs")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl alo-shimmer" />
        ))}
      </div>
    );
  }

  const s = data.summary;
  const maxCost = Math.max(...data.agentCosts.map((a) => a.estimatedCostUsd), 0.001);

  return (
    <div className="alo-fade-up space-y-5">
      <SectionHeader
        title="Local AI Usage & Cost"
        bn="খরচ ও ব্যবহার"
        desc="Paid AI API routing is disabled. This view reports configured local agents and estimated AI API spend only; hardware, storage, and electricity are excluded."
        icon={<DollarSign className="h-5 w-5" />}
      />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <StatCard label="Paid AI API spend" value={`$${s.totalCost.toFixed(4)}`} sub="infrastructure excluded" icon={<DollarSign className="h-4 w-4" />} tone="amber" />
        <StatCard label="Costed agent records" value={s.totalAgents} sub="local agent roster" icon={<Activity className="h-4 w-4" />} tone="sky" />
        <StatCard label="Local ব্যবহার" value={`${s.localPct}%`} sub={`${s.localCount} agents`} icon={<HardDrive className="h-4 w-4" />} tone="emerald" />
        <StatCard label="Paid AI APIs" value={s.paidApiCount} sub="disabled for generation" icon={<Cloud className="h-4 w-4" />} tone="violet" />
        <StatCard label="Blocked" value={s.blockedCount} sub="external_setup" icon={<Cpu className="h-4 w-4" />} tone="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Provider breakdown */}
        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Cloud className="h-4 w-4 text-amber-600" /> প্রদানকারী বিতরণ
          </h3>
          <div className="space-y-3">
            {data.providers.map((p) => {
              const meta = providerMeta[p.label] ?? { icon: <Server className="h-4 w-4" />, color: "text-slate-600", bg: "bg-slate-100", label: p.label };
              const pct = s.totalCost > 0 ? (p.cost / s.totalCost) * 100 : 0;
              return (
                <div key={p.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className={`rounded-lg p-1 ${meta.bg} ${meta.color}`}>{meta.icon}</span>
                      {meta.label}
                      <Badge variant="outline" className="text-[9px]">{p.count} agents</Badge>
                    </span>
                    <span className="tabular-nums font-semibold">${p.cost.toFixed(4)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${p.label === "local" ? "bg-emerald-400" : "bg-violet-400"} transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-100">
            AI generation uses private/local Ollama and ComfyUI endpoints or a visibly reported local fallback. No paid AI provider is configured here.
          </div>
        </Card>

        {/* Category breakdown */}
        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-violet-600" /> ক্যাটাগরি অনুযায়ী খরচ
          </h3>
          <div className="space-y-2.5">
            {data.categories.map((c) => {
              const pct = s.totalCost > 0 ? (c.cost / s.totalCost) * 100 : 0;
              const colors: Record<string, string> = {
                orchestration: "bg-amber-400",
                research: "bg-sky-400",
                content: "bg-violet-400",
                safety: "bg-rose-400",
                media: "bg-emerald-400",
                publishing: "bg-cyan-400",
                community: "bg-pink-400",
                learning: "bg-indigo-400",
                ops: "bg-slate-400",
              };
              return (
                <div key={c.category}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{catLabel[c.category] ?? c.category}</span>
                    <span className="text-muted-foreground tabular-nums">
                      ${c.cost.toFixed(4)} · {c.count} agents
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${colors[c.category] ?? "bg-slate-400"} transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Per-agent cost table */}
      <Card className="p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-amber-600" /> প্রতি-এজেন্ট খরচ
        </h3>
        <ScrollArea className="max-h-96 alo-scrollbar pr-2">
          <div className="space-y-1">
            {data.agentCosts
              .sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd)
              .map((a, i) => {
                const meta = providerMeta[a.provider] ?? providerMeta["external-optional"];
                const pct = (a.estimatedCostUsd / maxCost) * 100;
                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/40 transition-colors alo-stagger"
                    style={{ animationDelay: `${i * 15}ms` }}
                  >
                    <span className={`rounded-lg p-1 ${meta.bg} ${meta.color} shrink-0`}>{meta.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium truncate">{a.name}</p>
                        {a.status === "blocked_external_setup" && (
                          <Badge variant="outline" className="text-[8px] bg-amber-50 border-amber-200 text-amber-700 shrink-0">blocked</Badge>
                        )}
                      </div>
                      <p className="text-[9px] text-muted-foreground truncate">{a.model} · {catLabel[a.category] ?? a.category}</p>
                    </div>
                    <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
                      <div className="h-full bg-gradient-to-r from-amber-400 to-rose-400" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold tabular-nums w-16 text-right shrink-0">
                      ${a.estimatedCostUsd.toFixed(4)}
                    </span>
                  </div>
                );
              })}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
