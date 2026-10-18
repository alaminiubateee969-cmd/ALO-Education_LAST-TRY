import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createActivitySchema } from "@/lib/crm-validation";
import { parseJson, resolveCompanyScope, scopeError, validationError } from "@/lib/crm-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const scope = await resolveCompanyScope(request);
  if (scope.error) return scopeError(scope);
  const { id } = await context.params;
  const parsedBody = await parseJson(request);
  if ("response" in parsedBody) return parsedBody.response;
  const parsed = createActivitySchema.safeParse(parsedBody.body);
  if (!parsed.success) return validationError(parsed.error.issues);

  const result = await db.$transaction(async (tx) => {
    const lead = await tx.lead.findFirst({ where: { id, companyId: scope.companyId }, select: { id: true } });
    if (!lead) return null;
    const activity = await tx.leadActivity.create({ data: { leadId: id, ...parsed.data } });
    await tx.auditLog.create({ data: { actor: "admin", action: "crm.activity.created", detail: `Logged ${parsed.data.type} activity for lead ${id}`, severity: "info" } });
    return activity;
  });

  if (!result) return NextResponse.json({ error: "lead_not_found" }, { status: 404 });
  return NextResponse.json({ activity: result }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
