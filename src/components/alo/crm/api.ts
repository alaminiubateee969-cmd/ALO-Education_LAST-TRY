export function crmFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (typeof window !== "undefined") {
    const companyId = window.localStorage.getItem("alo-active-company");
    if (companyId) headers.set("x-alo-company-id", companyId);
  }
  return fetch(input, { ...init, headers, cache: init.cache ?? "no-store" });
}

export async function getApiError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    if (typeof body?.message === "string") return body.message;
    if (Array.isArray(body?.details) && body.details.length) {
      return body.details.map((detail: { field?: string; message?: string }) => `${detail.field ? `${detail.field}: ` : ""}${detail.message ?? "Invalid value"}`).join("; ");
    }
    if (typeof body?.error === "string") return body.error.replaceAll("_", " ");
  } catch {
    // The fallback is safer than exposing a server error body.
  }
  return fallback;
}

export function formatCurrency(value: string | number, currency = "GBP") {
  const amount = Number(value);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: ["GBP", "USD", "EUR", "BDT"].includes(currency) ? currency : "GBP",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}
