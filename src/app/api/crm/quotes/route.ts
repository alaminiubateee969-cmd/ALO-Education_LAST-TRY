import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { QUOTE_STATUSES } from "@/lib/crm-constants";
import { createQuotationSchema } from "@/lib/crm-validation";
import { parseJson, resolveCompanyScope, scopeError, validationError } from "@/lib/crm-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toMinorUnits(value: number) {
  return Math.round(value * 100);
}

function asDecimal(minorUnits: number) {
  return (minorUnits / 100).toFixed(2);
}

export async function GET(request: Request) {
  const scope = await resolveCompanyScope(request);
  if (scope.error) return scopeError(scope);

  const requestedStatus = new URL(request.url).searchParams.get("status");
  if (requestedStatus && !QUOTE_STATUSES.includes(requestedStatus as (typeof QUOTE_STATUSES)[number])) {
    return NextResponse.json({ error: "invalid_quote_status" }, { status: 400 });
  }

  const quotes = await db.quotation.findMany({
    where: {
      lead: { companyId: scope.companyId },
      ...(requestedStatus ? { status: requestedStatus } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 250,
    include: {
      lead: { select: { id: true, fullName: true, email: true, phone: true, company: { select: { name: true, domain: true } } } },
      items: { orderBy: { position: "asc" } },
    },
  });

  return NextResponse.json({ quotes }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const scope = await resolveCompanyScope(request);
  if (scope.error) return scopeError(scope);
  const parsedBody = await parseJson(request);
  if ("response" in parsedBody) return parsedBody.response;
  const parsed = createQuotationSchema.safeParse(parsedBody.body);
  if (!parsed.success) return validationError(parsed.error.issues);

  const validUntil = parsed.data.validUntil ?? null;
  if (validUntil && validUntil.getTime() < new Date(new Date().toDateString()).getTime()) {
    return NextResponse.json({ error: "Quotation expiry date cannot be in the past." }, { status: 400 });
  }

  const lineItems = parsed.data.items.map((item, position) => {
    const unitPriceMinor = toMinorUnits(item.unitPrice);
    const lineTotalMinor = unitPriceMinor * item.quantity;
    return {
      description: item.description,
      quantity: item.quantity,
      unitPriceMinor,
      lineTotalMinor,
      position,
    };
  });
  const subtotalMinor = lineItems.reduce((sum, item) => sum + item.lineTotalMinor, 0);
  const discountMinor = toMinorUnits(parsed.data.discountAmount);
  if (discountMinor > subtotalMinor) {
    return NextResponse.json({ error: "Discount cannot exceed the subtotal." }, { status: 400 });
  }
  const taxMinor = Math.round((subtotalMinor - discountMinor) * parsed.data.taxRate / 100);
  const totalMinor = subtotalMinor - discountMinor + taxMinor;
  // Decimal(12,2) supports at most 999,999,999,999 minor currency units.
  const maxDecimalMinor = 999_999_999_999;
  if ([subtotalMinor, discountMinor, taxMinor, totalMinor, ...lineItems.map((item) => item.lineTotalMinor)].some((amount) => amount > maxDecimalMinor)) {
    return NextResponse.json({ error: "Quotation amount exceeds the supported range." }, { status: 400 });
  }

  const lead = await db.lead.findFirst({
    where: { id: parsed.data.leadId, companyId: scope.companyId },
    select: { id: true },
  });
  if (!lead) return NextResponse.json({ error: "lead_not_found" }, { status: 404 });

  const now = new Date();
  const number = `ALO-${now.getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const quote = await db.$transaction(async (tx) => {
    const created = await tx.quotation.create({
      data: {
        leadId: lead.id,
        number,
        title: parsed.data.title,
        currency: parsed.data.currency,
        validUntil,
        subtotal: asDecimal(subtotalMinor),
        discountAmount: asDecimal(discountMinor),
        taxRate: parsed.data.taxRate.toFixed(2),
        taxAmount: asDecimal(taxMinor),
        total: asDecimal(totalMinor),
        terms: parsed.data.terms,
        notes: parsed.data.notes,
        items: {
          create: lineItems.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: asDecimal(item.unitPriceMinor),
            lineTotal: asDecimal(item.lineTotalMinor),
            position: item.position,
          })),
        },
      },
      include: {
        lead: { select: { id: true, fullName: true, email: true, phone: true, company: { select: { name: true, domain: true } } } },
        items: { orderBy: { position: "asc" } },
      },
    });
    await tx.leadActivity.create({
      data: { leadId: lead.id, type: "quotation", body: `Quotation ${number} created (${parsed.data.currency} ${asDecimal(totalMinor)}).` },
    });
    await tx.auditLog.create({ data: { actor: "admin", action: "crm.quotation.created", detail: `Created quotation ${number} for lead ${lead.id}`, severity: "info" } });
    return created;
  });

  return NextResponse.json({ quote }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
