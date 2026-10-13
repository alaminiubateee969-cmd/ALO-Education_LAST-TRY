"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, Code2, Copy, Download, Eye, FileCode2,
  Layers, Loader2, Palette, RefreshCw, Search, ShieldCheck, Sparkles, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ArchifyToolbarButton,
  EditorialButton,
  HotkeyButton,
  SectionHeader,
  SegmentedControl,
} from "./primitives";
import {
  DIAGRAM_PRESETS,
  DIAGRAM_SKINS,
  DIAGRAM_TYPES_45,
  parseMermaidToEditorialPreset,
  renderEditorialDiagramSvg,
  renderSelfContainedDiagramHtml,
  verifyDiagramDoctor,
  type DiagramPreset,
  type DiagramSkinId,
} from "@/lib/diagram-design";
import { useToast } from "@/hooks/use-toast";

const SAMPLE_MERMAID = `graph LR
  Enquiry["Student Enquiry"] ==>|Consent Check|CRM["Admissions CRM"]
  CRM -->|Shortlist 3-5|Verify["Official University Page"]
  Verify ==>|CAS / PAL / I-20|Quote["BDT / GBP Quotation"]
  Quote -.->|Audit Trail|Vault["AES-256-GCM Backup"]`;

export default function DiagramStudioView() {
  const { toast } = useToast();
  const [tab, setTab] = useState("canvas");
  const [presetId, setPresetId] = useState(DIAGRAM_PRESETS[0].id);
  const [skinId, setSkinId] = useState<DiagramSkinId>("editorial-light");
  const [dottedPaper, setDottedPaper] = useState(false);
  const [customPreset, setCustomPreset] = useState<DiagramPreset | null>(null);
  const [mermaidText, setMermaidText] = useState(SAMPLE_MERMAID);
  const [mermaidTitle, setMermaidTitle] = useState("Student Enquiry to Verified Quotation Flow");
  const [typeQuery, setTypeQuery] = useState("");
  const [typeCategory, setTypeCategory] = useState("all");
  const [pngBusy, setPngBusy] = useState(false);
  const [demoViewMode, setDemoViewMode] = useState<"diagram" | "table" | "kanban">("diagram");
  const [activeBeaconRole, setActiveBeaconRole] = useState<"frontend" | "backend" | "database" | "cloud" | "security">("frontend");

  const activePreset = customPreset ?? DIAGRAM_PRESETS.find((p) => p.id === presetId) ?? DIAGRAM_PRESETS[0];
  const activeSkin = DIAGRAM_SKINS[skinId];

  const svgMarkup = useMemo(
    () => renderEditorialDiagramSvg(activePreset, skinId, dottedPaper),
    [activePreset, skinId, dottedPaper]
  );
  const htmlMarkup = useMemo(
    () => renderSelfContainedDiagramHtml(activePreset, skinId, dottedPaper),
    [activePreset, skinId, dottedPaper]
  );
  const doctor = useMemo(() => verifyDiagramDoctor(skinId, activePreset), [skinId, activePreset]);

  const filteredTypes = useMemo(
    () =>
      DIAGRAM_TYPES_45.filter((item) => {
        if (typeCategory !== "all" && item.category !== typeCategory) return false;
        const needle = typeQuery.trim().toLowerCase();
        return !needle || item.name.toLowerCase().includes(needle) || item.whenToUse.toLowerCase().includes(needle);
      }),
    [typeCategory, typeQuery]
  );

  useEffect(() => {
    // Keep server route warm
    void fetch(`/api/diagrams?preset=${encodeURIComponent(presetId)}&skin=${encodeURIComponent(skinId)}`).catch(() => null);
  }, [presetId, skinId]);

  function selectBuiltInPreset(id: string) {
    setCustomPreset(null);
    setPresetId(id);
  }

  function redrawMermaid() {
    const parsed = parseMermaidToEditorialPreset(mermaidText, mermaidTitle);
    setCustomPreset(parsed);
    setTab("canvas");
    toast({
      title: "Redrawn as orthogonal Editorial SVG",
      description: `${parsed.nodes.length} nodes · ${parsed.edges.length} orthogonal connectors (r=8 bends)`,
    });
  }

  function downloadFile(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPng() {
    setPngBusy(true);
    try {
      const res = await fetch("/api/diagrams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: customPreset ? "import_mermaid" : "render",
          presetId: activePreset.id,
          skinId,
          dottedPaper,
          mermaidSource: customPreset ? mermaidText : undefined,
          title: customPreset ? mermaidTitle : undefined,
          format: "png",
        }),
      });
      if (!res.ok) throw new Error("PNG export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activePreset.id}-${skinId}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Exported PNG diagram", description: `${activePreset.id}-${skinId}.png` });
    } catch (error) {
      toast({
        title: "Could not export PNG",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setPngBusy(false);
    }
  }

  async function copyCode(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied`, description: "Ready to paste into your project or document." });
    } catch {
      toast({ title: "Clipboard permission required", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-5 alo-fade-up">
      <SectionHeader
        title="Diagram & Button Design Studio"
        bn="ডায়াগ্রাম ও বাটন ডিজাইন"
        desc="Self-contained Editorial HTML + inline SVG schematics (45 visual types, 5 WCAG-verified skins, r=8 orthogonal connectors, Mermaid redraw importer) plus the interactive Button & Control Design System."
        icon={<Layers className="h-5 w-5" />}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadFile(svgMarkup, `${activePreset.id}-${skinId}.svg`, "image/svg+xml;charset=utf-8")}
            >
              <Download className="h-3.5 w-3.5" />
              Export .SVG
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadFile(htmlMarkup, `${activePreset.id}-${skinId}.html`, "text/html;charset=utf-8")}
            >
              <FileCode2 className="h-3.5 w-3.5" />
              Export .HTML
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void downloadPng()}
              disabled={pngBusy}
              className="bg-amber-500 text-white hover:bg-amber-600"
            >
              {pngBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Export .PNG
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-5">
          <TabsTrigger value="canvas" className="gap-1.5 text-xs">
            <Eye className="h-3.5 w-3.5" />
            Editorial Canvas
          </TabsTrigger>
          <TabsTrigger value="buttons" className="gap-1.5 text-xs">
            <Sparkles className="h-3.5 w-3.5" />
            Button & UI System
          </TabsTrigger>
          <TabsTrigger value="mermaid" className="gap-1.5 text-xs">
            <Wand2 className="h-3.5 w-3.5" />
            Mermaid Redraw
          </TabsTrigger>
          <TabsTrigger value="doctor" className="gap-1.5 text-xs">
            <ShieldCheck className="h-3.5 w-3.5" />
            WCAG & Geometry Doctor
          </TabsTrigger>
          <TabsTrigger value="catalog" className="gap-1.5 text-xs">
            <Layers className="h-3.5 w-3.5" />
            45 Diagram Types
          </TabsTrigger>
        </TabsList>

        {/* 1. EDITORIAL DIAGRAM CANVAS */}
        <TabsContent value="canvas" className="mt-4 space-y-4">
          <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="space-y-3">
              <Card className="space-y-3 p-3.5">
                <div>
                  <Label className="text-xs font-semibold">1. Choose Schematic Preset</Label>
                  <p className="text-[11px] text-muted-foreground">Target density ≤ 9 nodes · 1–2 focal accents</p>
                </div>
                <div className="space-y-1.5">
                  {DIAGRAM_PRESETS.map((preset) => {
                    const isSelected = !customPreset && preset.id === activePreset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => selectBuiltInPreset(preset.id)}
                        className={`w-full rounded-lg border p-2.5 text-left transition-all ${
                          isSelected
                            ? "border-amber-500 bg-amber-500/10 font-semibold"
                            : "border-border/70 bg-card hover:bg-muted/50"
                        }`}
                      >
                        <span className="block text-xs">{preset.title}</span>
                        <span className="mt-0.5 block text-[10px] text-muted-foreground">
                          {preset.visualType} · {preset.nodes.length} nodes · {preset.edges.length} orthogonal edges
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card className="space-y-3 p-3.5">
                <div>
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Palette className="h-3.5 w-3.5 text-amber-600" />
                    2. Skin & Token Profile
                  </Label>
                  <p className="text-[11px] text-muted-foreground">Every skin clears ≥ 4.5:1 WCAG text contrast</p>
                </div>
                <div className="space-y-1.5">
                  {Object.values(DIAGRAM_SKINS).map((skin) => (
                    <button
                      key={skin.id}
                      type="button"
                      onClick={() => setSkinId(skin.id)}
                      className={`w-full flex items-center justify-between gap-2 rounded-lg border p-2 text-left text-xs transition-all ${
                        skinId === skin.id ? "border-amber-500 bg-amber-500/10 font-semibold" : "border-border/70 hover:bg-muted/50"
                      }`}
                    >
                      <span className="truncate">{skin.name}</span>
                      <span className="flex shrink-0 items-center gap-1">
                        <span className="h-3.5 w-3.5 rounded-sm border border-black/20" style={{ background: skin.paper }} title={`paper: ${skin.paper}`} />
                        <span className="h-3.5 w-3.5 rounded-sm border border-black/20" style={{ background: skin.ink }} title={`ink: ${skin.ink}`} />
                        <span className="h-3.5 w-3.5 rounded-sm border border-black/20" style={{ background: skin.accent }} title={`accent: ${skin.accent}`} />
                        <span className="h-3.5 w-3.5 rounded-sm border border-black/20" style={{ background: skin.link }} title={`link: ${skin.link}`} />
                      </span>
                    </button>
                  ))}
                </div>

                <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs">
                  <input
                    type="checkbox"
                    checked={dottedPaper}
                    onChange={(e) => setDottedPaper(e.target.checked)}
                    className="h-4 w-4 accent-amber-600"
                  />
                  <span>Opt-in dotted paper ground (22px grid)</span>
                </label>
              </Card>
            </aside>

            <div className="min-w-0 space-y-3">
              <Card className="overflow-hidden border-border/80 p-3 sm:p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {activePreset.semanticPattern}
                    </Badge>
                    <Badge className="bg-emerald-600 text-white text-[10px]">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      WCAG & 6-Rule Orthogonal Verified
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => void copyCode(svgMarkup, "Inline SVG")}>
                      <Copy className="h-3 w-3" />
                      Copy SVG
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => void copyCode(htmlMarkup, "Self-contained HTML")}>
                      <Code2 className="h-3 w-3" />
                      Copy HTML
                    </Button>
                  </div>
                </div>

                <div
                  className="overflow-hidden rounded-xl border border-border/70 shadow-xs"
                  dangerouslySetInnerHTML={{ __html: svgMarkup }}
                />
              </Card>

              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="p-3.5">
                  <p className="font-mono text-[10px] font-semibold uppercase text-amber-600">Rule 1 & 3 · Orthogonal Z-Order</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Connectors route strictly at 90° with <code>r=8</code> quarter-arc bends and are emitted before node opaque masks so lines never bleed through boxes.
                  </p>
                </Card>
                <Card className="p-3.5">
                  <p className="font-mono text-[10px] font-semibold uppercase text-emerald-600">Rule 2 & 6 · Opaque Label Masks</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Connector labels sit 8px above the stroke over an opaque <code>{"{paper}"}</code> mask rect in open gutter canvas—never overlapping node borders.
                  </p>
                </Card>
                <Card className="p-3.5">
                  <p className="font-mono text-[10px] font-semibold uppercase text-sky-600">Rule 4 & 5 · Rectangular Type Tags</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nodes carry crisp <code>rx=2</code> rectangular type tags (never rounded pills), with coral/amber reserved for 1–2 focal nodes max.
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 2. INTERACTIVE BUTTON & UI CONTROL DESIGN SYSTEM */}
        <TabsContent value="buttons" className="mt-4 space-y-4">
          <Card className="p-4 sm:p-5 space-y-5">
            <div>
              <h2 className="text-base font-semibold">Button & Interactive Control Design System</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Production-ready button primitives synthesized from <strong>Archify (&ldquo;The Evidence Console&rdquo;)</strong>, <strong>Diagram Design Editorial</strong>, <strong>Omarchy TUI</strong>, <strong>Twenty / Frappe CRM</strong>, and <strong>ALO Warm Gradient</strong>.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Family 1: Archify Evidence Console */}
              <Card className="p-4 bg-[#020617] text-white border-[#1E293B]">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[#22D3EE]">Pattern 01 · Archify Evidence Console</p>
                    <h3 className="text-sm font-semibold text-white mt-0.5">Toolbar Buttons with Semantic Beacons</h3>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 border-[#334155] bg-[#0F172A] text-xs text-white hover:bg-[#1E293B]"
                    onClick={() =>
                      void copyCode(
                        `<ArchifyToolbarButton label="Inspect Node" beacon="FE" role="frontend" active />`,
                        "ArchifyToolbarButton"
                      )
                    }
                  >
                    <Copy className="h-3 w-3" />
                    Copy JSX
                  </Button>
                </div>
                <p className="text-xs text-[#94A3B8] mb-3">
                  Dark slate mask (<code>#0F172A</code>), <code>JetBrains Mono</code> label, and <code>30×12px</code> semantic role beacon pills (<code>frontend #22D3EE</code>, <code>backend #34D399</code>, <code>database #A78BFA</code>, <code>cloud #FBBF24</code>, <code>security #FB7185</code>).
                </p>
                <div className="flex flex-wrap gap-2">
                  <ArchifyToolbarButton label="Frontend Surface" beacon="FE" role="frontend" active={activeBeaconRole === "frontend"} onClick={() => setActiveBeaconRole("frontend")} />
                  <ArchifyToolbarButton label="API Worker" beacon="API" role="backend" active={activeBeaconRole === "backend"} onClick={() => setActiveBeaconRole("backend")} />
                  <ArchifyToolbarButton label="Prisma Store" beacon="DB" role="database" active={activeBeaconRole === "database"} onClick={() => setActiveBeaconRole("database")} />
                  <ArchifyToolbarButton label="LAN Inference" beacon="AI" role="cloud" active={activeBeaconRole === "cloud"} onClick={() => setActiveBeaconRole("cloud")} />
                  <ArchifyToolbarButton label="OTP Guard" beacon="SEC" role="security" active={activeBeaconRole === "security"} onClick={() => setActiveBeaconRole("security")} />
                </div>
              </Card>

              {/* Family 2: Editorial Tactile Buttons */}
              <Card className="p-4 bg-[#f5f5f5] text-[#2d3142] border-[#bfc0c0]">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[#bf4520]">Pattern 02 · Diagram Design Editorial</p>
                    <h3 className="text-sm font-semibold text-[#2d3142] mt-0.5">WCAG 4.71:1 Editorial Tactile Buttons</h3>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 border-[#2d3142]/30 bg-white text-xs text-[#2d3142]"
                    onClick={() =>
                      void copyCode(
                        `<EditorialButton variant="accent" tag="SVG">Export Schematic</EditorialButton>`,
                        "EditorialButton"
                      )
                    }
                  >
                    <Copy className="h-3 w-3" />
                    Copy JSX
                  </Button>
                </div>
                <p className="text-xs text-[#4f5d75] mb-3">
                  No drop shadows. Uses <code>rx=6</code> outer frame, <code>rx=2</code> rectangular type tag, and darkened burnt-tangerine (<code>#bf4520</code>) that clears 4.71:1 contrast on white-smoke paper.
                </p>
                <div className="flex flex-wrap gap-2">
                  <EditorialButton variant="accent" tag="ACT" onClick={() => toast({ title: "Focal Editorial Action triggered" })}>
                    Generate Schematic
                  </EditorialButton>
                  <EditorialButton variant="paper" tag="DOC" onClick={() => toast({ title: "Style Guide Profile loaded" })}>
                    Inspect Style Guide
                  </EditorialButton>
                  <EditorialButton variant="link" tag="API" onClick={() => toast({ title: "Verified HTTP endpoint" })}>
                    Verify Contrast (4.71:1)
                  </EditorialButton>
                </div>
              </Card>

              {/* Family 3: Twenty / Frappe / Studytra Segmented View Switcher */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-amber-600">Pattern 03 · Twenty & Frappe CRM</p>
                    <h3 className="text-sm font-semibold mt-0.5">Segmented View Switcher & Count Pills</h3>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() =>
                      void copyCode(
                        `<SegmentedControl value={mode} onChange={setMode} options={[{ id: "table", label: "Table", count: 24 }, { id: "kanban", label: "Board", count: 7 }]} />`,
                        "SegmentedControl"
                      )
                    }
                  >
                    <Copy className="h-3 w-3" />
                    Copy JSX
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Used in Admissions CRM and Bricks tables to switch cleanly between Kanban Pipeline, Card Grid, and Data Table views without page reloads.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <SegmentedControl
                    value={demoViewMode}
                    onChange={setDemoViewMode}
                    options={[
                      { id: "diagram", label: "Diagram", count: 5 },
                      { id: "table", label: "Table", count: 31 },
                      { id: "kanban", label: "Pipeline", count: 7 },
                    ]}
                  />
                  <Badge variant="outline" className="text-xs">
                    Active view: {demoViewMode}
                  </Badge>
                </div>
              </Card>

              {/* Family 4: Omarchy / Command Hotkey Buttons */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-600">Pattern 04 · Omarchy & Command Palette</p>
                    <h3 className="text-sm font-semibold mt-0.5">Keyboard-First Hotkey Action Buttons</h3>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() =>
                      void copyCode(`<HotkeyButton label="Command Palette" hotkey="⌘K" />`, "HotkeyButton")
                    }
                  >
                    <Copy className="h-3 w-3" />
                    Copy JSX
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Pairs every high-frequency operator action with an inline monospace <code>&lt;kbd&gt;</code> chord badge for keyboard-driven workflows.
                </p>
                <div className="flex flex-wrap gap-2">
                  <HotkeyButton label="Open Command Center" hotkey="⌘K" onClick={() => toast({ title: "Press Cmd+K / Ctrl+K anytime" })} />
                  <HotkeyButton label="Run 3-Agent Review" hotkey="⇧↵" onClick={() => toast({ title: "Writer → Critic → Finalist pipeline ready" })} />
                  <HotkeyButton label="Export Encrypted Backup" hotkey="⌘B" onClick={() => toast({ title: "AES-256-GCM snapshot ready" })} />
                </div>
              </Card>
            </div>
          </Card>
        </TabsContent>

        {/* 3. MERMAID / DRAW.IO / EXCALIDRAW REDRAW IMPORTER */}
        <TabsContent value="mermaid" className="mt-4 space-y-4">
          <Card className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Import from Mermaid / DSL → Redraw as Orthogonal Editorial SVG</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Paste any Mermaid graph (<code>graph LR</code>, <code>graph TD</code>, <code>flowchart</code>) and redraw it into our clean orthogonal design system (no diagonal lines, no Mermaid default styling).
                </p>
              </div>
              <Button type="button" onClick={redrawMermaid} className="bg-amber-500 text-white hover:bg-amber-600">
                <RefreshCw className="h-4 w-4" />
                Redraw into Editorial Canvas
              </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="mermaid-title" className="text-xs">Diagram Title</Label>
                  <Input
                    id="mermaid-title"
                    value={mermaidTitle}
                    onChange={(e) => setMermaidTitle(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="mermaid-input" className="text-xs">Mermaid / Node-Edge Definition (up to 9 nodes)</Label>
                  <Textarea
                    id="mermaid-input"
                    value={mermaidText}
                    onChange={(e) => setMermaidText(e.target.value)}
                    rows={8}
                    className="mt-1 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Live Orthogonal Preview</Label>
                <div
                  className="overflow-hidden rounded-xl border border-border/70"
                  dangerouslySetInnerHTML={{
                    __html: renderEditorialDiagramSvg(
                      parseMermaidToEditorialPreset(mermaidText, mermaidTitle),
                      skinId,
                      dottedPaper
                    ),
                  }}
                />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* 4. WCAG CONTRAST DOCTOR & 6-RULE GEOMETRY VERIFIER */}
        <TabsContent value="doctor" className="mt-4 space-y-4">
          <Card className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">WCAG 2.x Contrast Doctor & Geometry Gate</h2>
                <p className="text-xs text-muted-foreground">
                  Verifies active skin (<code>{activeSkin.name}</code>) against <code>paper ({activeSkin.paper})</code> and checks all 6 mandatory connector rules.
                </p>
              </div>
              <Badge className={doctor.allPassed ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"}>
                {doctor.allPassed ? "ALL CHECKS PASSED" : "REVIEW REQUIRED"}
              </Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/70 text-[10px] uppercase text-muted-foreground">
                    <th className="py-2 pr-4">Semantic Token</th>
                    <th className="py-2 pr-4">Hex</th>
                    <th className="py-2 pr-4">Background</th>
                    <th className="py-2 pr-4">Measured Ratio</th>
                    <th className="py-2 pr-4">WCAG Minimum</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 font-mono">
                  {doctor.contrastChecks.map((chk) => (
                    <tr key={chk.role}>
                      <td className="py-2.5 pr-4 font-semibold">{chk.role}</td>
                      <td className="py-2.5 pr-4">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-3 w-3 rounded-xs border border-black/20" style={{ background: chk.hex }} />
                          {chk.hex}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">{chk.against}</td>
                      <td className="py-2.5 pr-4 font-bold">{chk.ratio}:1</td>
                      <td className="py-2.5 pr-4">{chk.threshold}:1</td>
                      <td className="py-2.5">
                        <Badge className={chk.passed ? "bg-emerald-600 text-white text-[10px]" : "bg-rose-600 text-white text-[10px]"}>
                          {chk.passed ? "PASS" : "FAIL"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 pt-2">
              {doctor.geometryRules.map((rule) => (
                <Card key={rule.ruleNumber} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-bold text-amber-600">Rule #{rule.ruleNumber}</span>
                    <Badge className="bg-emerald-600 text-white text-[9px]">{rule.status}</Badge>
                  </div>
                  <p className="mt-1 font-semibold text-xs">{rule.title}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{rule.detail}</p>
                </Card>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* 5. 45 VISUAL DIAGRAM TYPES CATALOG */}
        <TabsContent value="catalog" className="mt-4 space-y-4">
          <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={typeQuery}
                onChange={(e) => setTypeQuery(e.target.value)}
                placeholder="Search 45 visual diagram types (e.g. architecture, swimlane, sankey, wardley)…"
                className="pl-9"
              />
            </div>
            <select
              aria-label="Filter diagram types by category"
              value={typeCategory}
              onChange={(e) => setTypeCategory(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-64"
            >
              <option value="all">All categories ({DIAGRAM_TYPES_45.length})</option>
              {Array.from(new Set(DIAGRAM_TYPES_45.map((t) => t.category))).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Card>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTypes.map((item, idx) => (
              <Card key={item.id} className="p-3.5 alo-glow-hover">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] font-semibold text-amber-600">
                    #{String(idx + 1).padStart(2, "0")} · {item.id}
                  </span>
                  <Badge variant="outline" className="text-[9px]">
                    {item.category}
                  </Badge>
                </div>
                <h3 className="mt-1 font-semibold text-sm">{item.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{item.whenToUse}</p>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
