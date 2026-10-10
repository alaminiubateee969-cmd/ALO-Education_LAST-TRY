import { NextResponse } from "next/server";
import { runProtectiveMode } from "@/lib/ai";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { executeAsAgent } from "@/lib/agent-runtime";

export async function POST(req: Request) {
  await ensureSeeded();

  // ALO Agent Runtime — creates traceable AgentRun
  const agentRun = await db.aIAgentRun.create({
    data: {
      agentId: "safety_guardian",
      status: "running",
      inputBrief: "Protective mode review",
      startedAt: new Date(),
    },
  });

  const { content, type } = await req.json().catch(() => ({
    content: "",
    type: "content",
  }));
  const result = await runProtectiveMode(content, type);
  await db.auditLog.create({
    data: {
      actor: "SafetyGuardianAgent",
      action: "protective_mode.run",
      detail: `risk=${result.data.riskLevel} approved=${result.data.approved} via ${result.provider}`,
      severity: result.usedFallback || result.data.riskLevel !== "low" ? "warn" : "info",
    },
  });

  // Update AgentRun with success
  await db.aIAgentRun.update({
    where: { id: agentRun.id },
      data: { status: result.usedFallback ? "blocked_external_setup" : "success", errorMsg: result.usedFallback ? "Local safety review unavailable; human review required." : null, finishedAt: new Date() },
  });
  await db.auditLog.create({
    data: {
      actor: "safety_guardian",
      action: "agent.protective_mode_review",
      detail: `AgentRun ${agentRun.id}: Protective mode review → ${result.usedFallback ? "human_review_required" : "complete"}`,
      severity: result.usedFallback ? "warn" : "info",
    },
  });

  return NextResponse.json({ review: result.data, provider: result.provider, usedFallback: result.usedFallback, status: result.usedFallback ? "human_review_required" : "review_complete" }, { headers: { "Cache-Control": "no-store" } });
}
