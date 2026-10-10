import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { generateContentPackage } from "@/lib/ai";
import { recordAgentPipelineStages } from "@/lib/agent-runtime";

export const runtime = "nodejs";
export const maxDuration = 120;

function rankReferences(docs: Array<{ id: string; title: string; sourceType: string; content: string }>, topic: string) {
  const terms = [...new Set(topic.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter((term) => term.length > 2))].slice(0, 12);
  if (!terms.length) return [];
  return docs.map((doc) => {
    const title = doc.title.toLocaleLowerCase();
    const content = doc.content.toLocaleLowerCase();
    const matched = terms.reduce((total, term) => total + (title.includes(term) ? 2 : content.includes(term) ? 1 : 0), 0);
    return { doc, relevance: Math.min(1, matched / (terms.length * 1.25)) };
  }).filter((item) => item.relevance > 0).sort((a, b) => b.relevance - a.relevance).slice(0, 3);
}

export async function POST(req: Request) {
  await ensureSeeded();
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const audience = typeof body.audience === "string" ? body.audience.trim() : "";
  if (!topic || topic.length > 1_000 || !audience || audience.length > 300) {
    return NextResponse.json({ error: "topic (1–1,000 chars) and audience (1–300 chars) are required" }, { status: 400 });
  }

  // Bounded, transparent keyword retrieval: never cite a document that was not
  // actually retrieved. This is not vector search or an independent fact-check.
  const recentDocs = await db.ragDocument.findMany({ take: 100, orderBy: { createdAt: "desc" } });
  const references = rankReferences(recentDocs, topic);
  const ragContext = references.map(({ doc }, index) => `[${index + 1}] ${doc.title} (${doc.sourceType}): ${doc.content.slice(0, 1_200)}`).join("\n\n");
  const citations = references.map(({ doc, relevance }) => ({ title: doc.title, type: doc.sourceType, relevance }));
  const result = await generateContentPackage(topic, audience, ragContext, citations);
  await recordAgentPipelineStages("content package", result.qualityPipeline ?? []);

  const pkg = await db.contentPackage.create({
    data: {
      topic,
      reelScript: result.data.reelScript,
      hooksJson: JSON.stringify(result.data.hooks),
      seoKeywords: JSON.stringify(result.data.seoKeywords),
      captionsJson: JSON.stringify(result.data.captions),
      hashtagsJson: JSON.stringify(result.data.hashtags),
      imagePrompt: result.data.imagePrompt,
      voiceDirection: result.data.voiceDirection,
      cta: result.data.cta,
      disclaimerBn: result.data.disclaimerBn,
      qualityScore: result.data.qualityScore,
      safetyStatus: "pending",
      ragCitations: JSON.stringify(result.data.ragCitations),
    },
  });

  await db.approvalItem.create({
    data: {
      packageId: pkg.id,
      topic,
      type: "content",
      title: `কনটেন্ট প্যাকেজ — ${topic.slice(0, 40)}`,
      summary: `রিল স্ক্রিপ্ট + ${Object.keys(result.data.captions).length} প্ল্যাটফর্ম ক্যাপশন + হুক + ইমেজ প্রম্পট; human review required.`,
      riskLevel: "medium",
      status: "pending",
    },
  });

  await db.auditLog.create({
    data: {
      actor: "admin",
      action: "content.generate",
      detail: `Content package stored via ${result.provider}; three-pass status: ${(result.qualityPipeline ?? []).map((stage) => stage.status).join(",")}; structural score ${result.data.qualityScore}/100.`,
      severity: result.usedFallback ? "warn" : "info",
    },
  });

  return NextResponse.json({
    package: pkg,
    full: result.data,
    provider: result.provider,
    usedFallback: result.usedFallback,
    latencyMs: result.latencyMs,
    qualityPipeline: result.qualityPipeline ?? [],
    humanReviewRequired: true,
    qualityScoreMeaning: "Deterministic completeness/safety-pattern checks only; not factual verification or a guaranteed improvement factor.",
  }, { headers: { "Cache-Control": "no-store" } });
}
