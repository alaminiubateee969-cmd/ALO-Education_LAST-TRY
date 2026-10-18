import { NextResponse } from "next/server";
import { isAdminAuthenticationConfigured, isAdminOtpDeliveryConfigured, isAdminOtpRequired } from "@/lib/auth-config";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    { required: isAdminOtpRequired(), available: isAdminOtpDeliveryConfigured(), authConfigured: isAdminAuthenticationConfigured() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
