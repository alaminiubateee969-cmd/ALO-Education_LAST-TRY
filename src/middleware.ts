import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticationConfigured } from "@/lib/auth-config";

const isPublicPath = (request: NextRequest) => {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/api/health" && searchParams.get("details") === "1") return false;
  return pathname === "/login" ||
    pathname === "/api/health" ||
    pathname === "/api/auth" ||
    pathname.startsWith("/api/auth/");
};

const wantsJson = (request: NextRequest) =>
  request.nextUrl.pathname.startsWith("/api/") ||
  request.headers.get("accept")?.includes("application/json");

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(request)) return NextResponse.next();

  // Local development stays easy to run. Set ALO_REQUIRE_AUTH=true to exercise
  // the same login flow locally; production is always protected.
  if (process.env.NODE_ENV !== "production" && process.env.ALO_REQUIRE_AUTH !== "true") {
    return NextResponse.next();
  }

  if (!isAdminAuthenticationConfigured()) {
    if (wantsJson(request)) {
      return NextResponse.json(
        { error: "authentication_not_configured", message: "Administrator authentication must be configured before use." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("reason", "setup");
    return NextResponse.redirect(loginUrl);
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });

  if (token) return NextResponse.next();

  if (wantsJson(request)) {
    return NextResponse.json(
      { error: "unauthorized", message: "Sign in is required." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|logo.svg|generated/).*)"],
};
