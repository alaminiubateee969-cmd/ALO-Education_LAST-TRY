// CRM validation tests — admissions lead + quotation schemas (zod).
// Runs the REAL src/lib/crm-validation.ts against representative payloads.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { compileTsGraph } from "./helpers/compile-ts.mjs";

const REPO = path.join(import.meta.dirname, "..");
const entry = compileTsGraph("lib/crm-validation", path.join(REPO, ".tmp-tests", "crm"));
const {
  createLeadSchema,
  updateLeadSchema,
  createActivitySchema,
  createQuotationSchema,
  updateQuotationStatusSchema,
} = await import(entry);

const validLead = {
  fullName: "Rahim Uddin",
  email: "rahim@example.com",
  phone: "+8801711223344",
  targetCountry: "United Kingdom",
  studyLevel: "Masters",
  courseInterest: "Data Science",
  intake: "September 2027",
  source: "website",
  stage: "new",
  consentStatus: "unknown",
};

test("a complete lead payload validates", () => {
  const r = createLeadSchema.safeParse(validLead);
  assert.equal(r.success, true, JSON.stringify(r.error?.issues));
});

test("a lead needs at least an email or a phone", () => {
  const r = createLeadSchema.safeParse({ ...validLead, email: null, phone: null });
  assert.equal(r.success, false);
  assert.ok(r.error.issues.some((i) => i.path.includes("email")));
});

test("invalid enum values are rejected (stage/source/consent)", () => {
  for (const bad of [{ stage: "won" }, { source: "tiktok" }, { consentStatus: "maybe" }]) {
    const r = createLeadSchema.safeParse({ ...validLead, ...bad });
    assert.equal(r.success, false, JSON.stringify(bad));
  }
});

test("defaults fill source/stage/consentStatus", () => {
  const r = createLeadSchema.parse({ fullName: "A B", email: "a@b.co" });
  assert.equal(r.source, "website");
  assert.equal(r.stage, "new");
  assert.equal(r.consentStatus, "unknown");
});

test("consented leads must record when consent was captured", () => {
  const r = createLeadSchema.safeParse({ ...validLead, consentStatus: "consented" });
  assert.equal(r.success, false);
  assert.ok(r.error.issues.some((i) => i.path.includes("consentRecordedAt")));
  const ok = createLeadSchema.safeParse({
    ...validLead,
    consentStatus: "consented",
    consentRecordedAt: "2026-10-01",
  });
  assert.equal(ok.success, true);
});

test("blank strings are normalised to null, whitespace trimmed", () => {
  const r = createLeadSchema.parse({ ...validLead, phone: "", targetCountry: "  Canada  " });
  assert.equal(r.phone, null);
  assert.equal(r.targetCountry, "Canada");
});

test("updateLeadSchema tolerates partial payloads but keeps invariants", () => {
  const r = updateLeadSchema.safeParse({ stage: "contacted" });
  assert.equal(r.success, true);
  const bad = updateLeadSchema.safeParse({ stage: "contacted", consentStatus: "consented" });
  assert.equal(bad.success, false, "consent without timestamp must fail");
});

test("activity types are constrained", () => {
  assert.equal(createActivitySchema.safeParse({ type: "note", body: "called" }).success, true);
  assert.equal(createActivitySchema.safeParse({ type: "party", body: "x" }).success, false);
  assert.equal(createActivitySchema.safeParse({ type: "note", body: "" }).success, false);
});

const validQuote = {
  leadId: "lead-1",
  title: "Masters application support",
  currency: "GBP",
  items: [
    { description: "University shortlisting", quantity: 3, unitPrice: "150.00" },
    { description: "SOP review", quantity: 1, unitPrice: "95.50" },
  ],
};

test("a quotation with line items validates", () => {
  const r = createQuotationSchema.safeParse(validQuote);
  assert.equal(r.success, true, JSON.stringify(r.error?.issues));
});

test("quotations reject unknown currencies, negative and zero quantities", () => {
  assert.equal(createQuotationSchema.safeParse({ ...validQuote, currency: "JPY" }).success, false);
  assert.equal(
    createQuotationSchema.safeParse({ ...validQuote, items: [{ description: "x", quantity: 0, unitPrice: "10" }] }).success,
    false,
  );
  assert.equal(
    createQuotationSchema.safeParse({ ...validQuote, items: [{ description: "x", quantity: -1, unitPrice: "10" }] }).success,
    false,
  );
});

test("quotation items require a description and price", () => {
  assert.equal(
    createQuotationSchema.safeParse({ ...validQuote, items: [{ description: "", quantity: 1, unitPrice: "10" }] }).success,
    false,
  );
  assert.equal(
    createQuotationSchema.safeParse({ ...validQuote, items: [{ description: "x", quantity: 1, unitPrice: "abc" }] }).success,
    false,
  );
});

test("quotation status transitions are constrained", () => {
  assert.equal(updateQuotationStatusSchema.safeParse({ status: "sent" }).success, true);
  assert.equal(updateQuotationStatusSchema.safeParse({ status: "deleted" }).success, false);
});
