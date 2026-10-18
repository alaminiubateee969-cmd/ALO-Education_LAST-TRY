import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { updateQuotationStatusSchema } from "@/lib/crm-validation";
import { parseJson, resolveCompanyScope, scopeError, validationError } from "@/lib/crm-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["sent"],
  sent: ["accepted", "declined", "expired"],
  accepted: [],
  declined: [],
  expired: [],
};

export async function PATCH(request: Request, context: RouteContext) {
  const scope = await resolveCompanyScope(request);
  if (scope.error) return scopeError(scope);
  const { id } = await context.params;
  const parsedBody = await parseJson(request);
  if ("response" in parsedBody) return parsedBody.response;
  const parsed = updateQuotationStatusSchema.safeParse(parsedBody.body);
  if (!parsed.success) return validationError(parsed.error.issues);

  const result = await db.$transaction(async (tx) => {
    const existing = await tx.quotation.findFirst({
      where: { id, lead: { companyId: scope.companyId } },
      select: { id: true, number: true, leadId: true, status: true },
    });
    if (!existing) return { notFound: true as const };
    if (!STATUS_TRANSITIONS[existing.status]?.includes(parsed.data.status)) {
      return { invalidTransition: true as const, current: existing.status };
    }

    const updated = await tx.quotation.update({
      where: { id },
      data: {
        status: parsed.data.status,
        ...(parsed.data.status === "accepted" ? { acceptedAt: new Date() } : {}),
      },
      include: {
        lead: { select: { id: true, fullName: true, email: true, phone: true, company: { select: { name: true, domain: true } } } },
        items: { orderBy: { position: "asc" } },
      },
    });
    await tx.leadActivity.create({
      data: { leadId: existing.leadId, type: "quotation", body: `Quotation ${existing.number} marked ${parsed.data.status}.` },
    });
    await tx.auditLog.create({ data: { actor: "admin", action: `crm.quotation.${parsed.data.status}`, detail: `Updated quotation ${existing.number}`, severity: "info" } });
    return { quote: updated };
  });

  if ("notFound" in result) return NextResponse.json({ error: "quotation_not_found" }, { status: 404 });
  if ("invalidTransition" in result) {
    return NextResponse.json({ error: "invalid_status_transition", current: result.current }, { status: 409 });
  }
  return NextResponse.json({ quote: result.quote }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request, context: RouteContext) {
  const scope = await resolveCompanyScope(request);
  if (scope.error) return scopeError(scope);
  const { id } = await context.params;

  const result = await db.$transaction(async (tx) => {
    const existing = await tx.quotation.findFirst({
      where: { id, lead: { companyId: scope.companyId } },
      select: { id: true, number: true, leadId: true, status: true },
    });
    if (!existing) return { notFound: true as const };
    if (!["draft", "declined"].includes(existing.status)) return { locked: true as const };

    await tx.quotation.delete({ where: { id } });
    await tx.leadActivity.create({ data: { leadId: existing.leadId, type: "quotation", body: `Quotation ${existing.number} deleted.` } });
    await tx.auditLog.create({ data: { actor: "admin", action: "crm.quotation.deleted", detail: `Deleted quotation ${existing.number}`, severity: "warn" } });
    return { deleted: true as const };
  });

  if ("notFound" in result) return NextResponse.json({ error: "quotation_not_found" }, { status: 404 });
  if ("locked" in result) return NextResponse.json({ error: "Only draft or declined quotations can be deleted." }, { status: 409 });
  return new NextResponse(null, { status: 204 });
}
