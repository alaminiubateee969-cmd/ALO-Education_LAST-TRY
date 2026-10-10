"use client";

import { useMemo, useState } from "react";
import { Check, ClipboardCheck, Copy, Download, ExternalLink, Loader2, Megaphone, Search, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "./primitives";
import { MARKETING_KITS } from "@/lib/marketing-kits";
import { useToast } from "@/hooks/use-toast";
import { QualityPipelineSummary } from "./PipelineRunner";
import type { QualityAgentPass } from "@/lib/ai";

function renderTemplate(text: string, fields: Record<string, string>) {
  return text.replace(/\{\{([a-z_]+)\}\}/g, (_match, key: string) => fields[key]?.trim() || `[${key.replaceAll("_", " ")}]`);
}

function assetCacheKey(kitId: string, assetId: string) {
  return `${kitId}/${assetId}`;
}

export default function MarketingKitsView({ onNavigate }: { onNavigate: (section: string) => void }) {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState(MARKETING_KITS[0]?.id ?? "");
  const [activeAssets, setActiveAssets] = useState<Record<string, string>>({});
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, Record<string, string>>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [polishBusy, setPolishBusy] = useState(false);
  const [polishedBodies, setPolishedBodies] = useState<Record<string, string>>({});
  const [polishPipeline, setPolishPipeline] = useState<Record<string, QualityAgentPass[]>>({});

  const selected = MARKETING_KITS.find((kit) => kit.id === selectedId) ?? MARKETING_KITS[0];
  const fields = selected
    ? { ...Object.fromEntries(selected.fields.map((field) => [field.key, field.defaultValue])), ...fieldOverrides[selected.id] }
    : {};
  const activeAssetId = selected ? activeAssets[selected.id] ?? selected.assets[0]?.id ?? "" : "";
  const filteredKits = useMemo(() => MARKETING_KITS.filter((kit) => {
    if (category !== "all" && kit.category !== category) return false;
    const needle = query.trim().toLowerCase();
    return !needle || [kit.title, kit.objective, kit.audience, kit.category].some((value) => value.toLowerCase().includes(needle));
  }), [category, query]);

  function updateField(key: string, value: string) {
    if (!selected) return;
    setFieldOverrides((current) => ({
      ...current,
      [selected.id]: { ...current[selected.id], [key]: value },
    }));
    const keyPrefix = `${selected.id}/`;
    setPolishedBodies((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(keyPrefix))));
    setPolishPipeline((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(keyPrefix))));
  }

  function selectAsset(assetId: string) {
    if (!selected) return;
    setActiveAssets((current) => ({ ...current, [selected.id]: assetId }));
  }

  const activeAsset = selected?.assets.find((asset) => asset.id === activeAssetId) ?? selected?.assets[0];
  const activeCacheKey = selected && activeAsset ? assetCacheKey(selected.id, activeAsset.id) : "";
  const originalRenderedBody = activeAsset ? renderTemplate(activeAsset.body, fields) : "";
  const renderedBody = activeCacheKey ? polishedBodies[activeCacheKey] ?? originalRenderedBody : originalRenderedBody;
  const hasUnfilledValues = /\[(?:add|verify|confirm|insert|course|intake|first name|institution|deadline|time|date)/i.test(renderedBody);
  const allReviewed = Boolean(selected?.guardrails.length && selected.guardrails.every((_item, index) => reviewed[`${selected.id}-${index}`]));

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied`, description: "Review the final wording and links before use." });
    } catch {
      toast({ title: "Clipboard permission required", description: "Select and copy the text manually from the preview.", variant: "destructive" });
    }
  }

  async function polishEmailDraft() {
    if (!selected || !activeAsset || activeAsset.channel !== "Email" || !activeCacheKey) return;
    setPolishBusy(true);
    try {
      const response = await fetch("/api/marketing/email-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: activeAsset.body, audience: selected.audience, objective: selected.objective }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not refine this email draft.");
      setPolishedBodies((current) => ({ ...current, [activeCacheKey]: renderTemplate(body.draft, fields) }));
      setPolishPipeline((current) => ({ ...current, [activeCacheKey]: body.qualityPipeline ?? [] }));
      toast({
        title: body.usedFallback ? "Template retained; local model unavailable" : "Three local agents reviewed the email draft",
        description: "Draft only. No email was sent; verify claims, consent, preferences and every placeholder.",
      });
    } catch (error) {
      toast({ title: "Email draft not refined", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally {
      setPolishBusy(false);
    }
  }

  function downloadKit() {
    if (!selected) return;
    const content = selected.assets.map((asset) => {
      const key = assetCacheKey(selected.id, asset.id);
      const body = polishedBodies[key] ?? renderTemplate(asset.body, fields);
      return `${asset.channel.toUpperCase()} — ${asset.title}\n\n${body}`;
    }).join(`\n\n${"=".repeat(60)}\n\n`);
    const file = new Blob([`${selected.title}\n\n${content}\n\nReview checklist\n${selected.guardrails.map((item) => `- ${item}`).join("\n")}`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selected.id}-marketing-kit.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function createCampaign() {
    if (!selected || !allReviewed) return;
    setBusy(true);
    try {
      const response = await fetch("/api/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_campaign", title: selected.title, topic: selected.topic, platformCount: selected.assets.length, totalAssets: selected.assets.length }),
      });
      const body = await response.json();
      if (!response.ok || body.error) throw new Error(body.error ?? "Could not create the campaign.");
      toast({ title: "Campaign added to Growth Loop", description: selected.title });
      onNavigate("growth");
    } catch (error) {
      toast({ title: "Campaign not created", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 alo-fade-up">
      <SectionHeader
        title="Marketing Kits"
        bn="Campaign library"
        desc="Editable, multi-channel starting points for education campaigns. Personalise each asset, verify every factual claim, and respect the contact's channel preferences before use."
        icon={<Megaphone className="h-5 w-5" />}
        action={<div className="flex flex-wrap items-center gap-2"><a href="https://web.facebook.com/ALOLearningJourney" target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"><ExternalLink className="h-3.5 w-3.5" />Open Facebook page</a><Badge variant="outline" className="h-8 gap-1.5 px-3 text-xs"><Sparkles className="h-3.5 w-3.5 text-amber-600" />{MARKETING_KITS.length} ready-to-edit kits</Badge></div>}
      />
      <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">The supplied Facebook page could not be verified from this environment. These are editable draft kits—not copy derived from that page. Confirm brand voice, offers, dates, links, and claims with the page owner before publishing.</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><div className="flex items-center gap-2 text-amber-700"><Target className="h-4 w-4" /><span className="text-xs font-semibold">One objective</span></div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Every kit starts with an audience, a clear purpose, and an honest next step—not a generic blast.</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-violet-700"><ClipboardCheck className="h-4 w-4" /><span className="text-xs font-semibold">Review before use</span></div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Dates, entry requirements, URLs, and claims remain editable placeholders until a human verifies them.</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-emerald-700"><Check className="h-4 w-4" /><span className="text-xs font-semibold">Consent-aware</span></div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Copying or creating a campaign does not send messages. Use promotional content only for appropriate, opted-in audiences.</p></Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <Card className="space-y-3 p-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a campaign kit…" className="pl-9" /></div>
            <select aria-label="Filter kits by purpose" value={category} onChange={(event) => setCategory(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="all">All purposes</option>{Array.from(new Set(MARKETING_KITS.map((kit) => kit.category))).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </Card>
          <div className="space-y-2">
            {filteredKits.map((kit) => (
              <button key={kit.id} type="button" onClick={() => setSelectedId(kit.id)} aria-pressed={selected?.id === kit.id} className={`w-full rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 ${selected?.id === kit.id ? "border-amber-500 bg-amber-500/10 shadow-sm" : "border-border/70 bg-card hover:bg-muted/50"}`}>
                <span className="flex items-center justify-between gap-2"><span className="font-semibold text-sm">{kit.title}</span><span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[9px] text-muted-foreground">{kit.category}</span></span>
                <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">{kit.objective}</span>
                <span className="mt-2 block text-[10px] text-muted-foreground">{kit.assets.length} assets · {kit.assets.map((asset) => asset.channel).filter((value, index, array) => array.indexOf(value) === index).join(" · ")}</span>
              </button>
            ))}
            {filteredKits.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">No kits match this search.</Card>}
          </div>
        </aside>

        {selected && (
          <div className="min-w-0 space-y-4">
            <Card className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0"><Badge variant="outline" className="mb-2">{selected.category}</Badge><h2 className="text-lg font-semibold">{selected.title}</h2><p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{selected.objective}</p></div>
                <Button type="button" variant="outline" size="sm" onClick={downloadKit}><Download className="h-4 w-4" />Download kit</Button>
              </div>
              <div className="mt-4 grid gap-3 rounded-xl bg-muted/35 p-3 sm:grid-cols-2">
                <div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Audience</p><p className="mt-1 text-xs leading-relaxed">{selected.audience}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Message angle</p><p className="mt-1 text-xs leading-relaxed">{selected.angle}</p></div>
              </div>
            </Card>

            <Card className="p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">Personalise the placeholders</h3><p className="mt-0.5 text-xs text-muted-foreground">Unedited placeholders are intentionally obvious; replace them before copying.</p></div><span className="text-[10px] text-muted-foreground">{selected.fields.length} fields</span></div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {selected.fields.map((field) => <div key={field.key} className="space-y-1"><Label htmlFor={`kit-${selected.id}-${field.key}`} className="text-xs">{field.label}</Label><Input id={`kit-${selected.id}-${field.key}`} value={fields[field.key] ?? field.defaultValue} onChange={(event) => updateField(field.key, event.target.value)} maxLength={300} /></div>)}
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div><h3 className="text-sm font-semibold">Channel assets</h3><p className="mt-0.5 text-xs text-muted-foreground">Choose a channel, inspect the rendered copy, and copy or download it for human review.</p></div>
                <div className="flex flex-wrap gap-2">{selected.assets.map((asset) => <Button key={asset.id} type="button" size="sm" variant={asset.id === activeAsset?.id ? "default" : "outline"} className={asset.id === activeAsset?.id ? "bg-amber-500 text-white hover:bg-amber-600" : ""} onClick={() => selectAsset(asset.id)}>{asset.channel}</Button>)}</div>
              </div>
              {activeAsset && <div className="space-y-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="font-semibold">{activeAsset.title}</h4><p className="text-xs text-muted-foreground">{activeAsset.channel}</p></div><div className="flex flex-wrap gap-2">{activeAsset.channel === "Email" && <Button type="button" size="sm" variant="outline" disabled={polishBusy} onClick={() => void polishEmailDraft()}>{polishBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{polishBusy ? "Reviewing…" : "Refine draft with local agents"}</Button>}<Button type="button" size="sm" variant="outline" onClick={() => void copyText(renderedBody, activeAsset.channel)}><Copy className="h-3.5 w-3.5" />Copy asset</Button></div></div>
                {polishPipeline[activeCacheKey]?.length > 0 && <QualityPipelineSummary passes={polishPipeline[activeCacheKey]} />}
                {hasUnfilledValues && <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">Some placeholders still need a value or verification. Preview and copied text retain the bracketed reminder.</div>}
                <pre className="max-h-[34rem] overflow-auto whitespace-pre-wrap rounded-xl border border-border/70 bg-background p-4 font-sans text-sm leading-relaxed text-foreground">{renderedBody}</pre>
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><ExternalLink className="h-3 w-3" />Local-agent email refinement uses the template/merge-tag version before contact fields are filled. No messages are sent; verify preferences and source material yourself.</p>
              </div>}
            </Card>

            <Card className="p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-amber-600" /><h3 className="text-sm font-semibold">Before you publish or send</h3></div>
              <div className="space-y-2">
                {selected.guardrails.map((rule, index) => {
                  const id = `${selected.id}-${index}`;
                  return <label key={id} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/60 p-2.5 text-xs leading-relaxed hover:bg-muted/30"><input type="checkbox" checked={Boolean(reviewed[id])} onChange={(event) => setReviewed((current) => ({ ...current, [id]: event.target.checked }))} className="mt-0.5 h-4 w-4 accent-amber-600" /><span>{rule}</span></label>;
                })}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
                <p className="max-w-xl text-[11px] leading-relaxed text-muted-foreground">Creating a Growth Loop campaign records a plan only. It does not publish assets, connect an external service, or send a message.</p>
                <Button type="button" onClick={createCampaign} disabled={!allReviewed || busy} className="bg-emerald-600 text-white hover:bg-emerald-700">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Create Growth Loop campaign</Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
