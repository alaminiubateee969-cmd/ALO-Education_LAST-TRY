import { z } from "zod";
import { ACTIVITY_TYPES, CONSENT_STATUSES, LEAD_SOURCES, LEAD_STAGES, QUOTE_CURRENCIES, QUOTE_STATUSES } from "./crm-constants";

const optionalText = (max: number) =>
  z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? null : value,
    z.string().trim().max(max).nullable().optional()
  );

const optionalEmail = z.preprocess(
  (value) => value === "" ? null : value,
  z.string().trim().email().max(191).nullable().optional()
);

const optionalPhone = z.preprocess(
  (value) => value === "" ? null : value,
  z.string().trim().max(40).refine((value) => /^[+0-9().\-\s]{7,40}$/.test(value), "Enter a valid phone number").nullable().optional()
);

const optionalDate = z.preprocess(
  (value) => value === "" ? null : value,
  z.coerce.date().nullable().optional()
);

const leadFields = {
  fullName: z.string().trim().min(2).max(120),
  email: optionalEmail,
  phone: optionalPhone,
  targetCountry: optionalText(100),
  studyLevel: optionalText(100),
  courseInterest: optionalText(160),
  intake: optionalText(80),
  source: z.enum(LEAD_SOURCES),
  stage: z.enum(LEAD_STAGES),
  consentStatus: z.enum(CONSENT_STATUSES),
  consentRecordedAt: optionalDate,
  nextFollowUp: optionalDate,
  notes: optionalText(5000),
};

export const createLeadSchema = z.object({
  fullName: leadFields.fullName,
  email: leadFields.email,
  phone: leadFields.phone,
  targetCountry: leadFields.targetCountry,
  studyLevel: leadFields.studyLevel,
  courseInterest: leadFields.courseInterest,
  intake: leadFields.intake,
  source: leadFields.source.default("website"),
  stage: leadFields.stage.default("new"),
  consentStatus: leadFields.consentStatus.default("unknown"),
  consentRecordedAt: leadFields.consentRecordedAt,
  nextFollowUp: leadFields.nextFollowUp,
  notes: leadFields.notes,
}).superRefine((value, ctx) => {
  if (!value.email && !value.phone) {
    ctx.addIssue({ code: "custom", path: ["email"], message: "Add an email address or phone number." });
  }
  if (value.consentStatus === "consented" && !value.consentRecordedAt) {
    ctx.addIssue({ code: "custom", path: ["consentRecordedAt"], message: "Record when marketing consent was captured." });
  }
});

export const updateLeadSchema = z.object({
  fullName: leadFields.fullName.optional(),
  email: leadFields.email,
  phone: leadFields.phone,
  targetCountry: leadFields.targetCountry,
  studyLevel: leadFields.studyLevel,
  courseInterest: leadFields.courseInterest,
  intake: leadFields.intake,
  source: leadFields.source.optional(),
  stage: leadFields.stage.optional(),
  consentStatus: leadFields.consentStatus.optional(),
  consentRecordedAt: leadFields.consentRecordedAt,
  nextFollowUp: leadFields.nextFollowUp,
  notes: leadFields.notes,
}).superRefine((value, ctx) => {
  if (value.consentStatus === "consented" && !value.consentRecordedAt) {
    ctx.addIssue({ code: "custom", path: ["consentRecordedAt"], message: "Record when marketing consent was captured." });
  }
});

export const createActivitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES).default("note"),
  body: z.string().trim().min(1).max(5000),
});

const twoDecimalAmount = (max: number) =>
  z.coerce.number().finite().min(0).max(max).refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7,
    "Use no more than two decimal places."
  );

export const quotationItemSchema = z.object({
  description: z.string().trim().min(2).max(180),
  quantity: z.coerce.number().int().min(1).max(1000),
  unitPrice: twoDecimalAmount(10000000),
});

export const createQuotationSchema = z.object({
  leadId: z.string().trim().min(1).max(191),
  title: z.string().trim().min(2).max(160),
  currency: z.enum(QUOTE_CURRENCIES).default("GBP"),
  validUntil: optionalDate,
  discountAmount: twoDecimalAmount(10000000).default(0),
  taxRate: twoDecimalAmount(100).default(0),
  terms: optionalText(3000),
  notes: optionalText(3000),
  items: z.array(quotationItemSchema).min(1).max(25),
});

export const updateQuotationStatusSchema = z.object({
  status: z.enum(QUOTE_STATUSES),
});
