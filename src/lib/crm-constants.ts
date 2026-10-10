export const LEAD_STAGES = [
  "new",
  "contacted",
  "qualified",
  "consultation_booked",
  "proposal_sent",
  "enrolled",
  "lost",
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: "New enquiry",
  contacted: "Contacted",
  qualified: "Qualified",
  consultation_booked: "Consultation booked",
  proposal_sent: "Proposal sent",
  enrolled: "Enrolled",
  lost: "Closed / lost",
};

export const LEAD_SOURCES = ["website", "referral", "social", "event", "partner", "other"] as const;
export const CONSENT_STATUSES = ["unknown", "consented", "opted_out"] as const;
export const QUOTE_STATUSES = ["draft", "sent", "accepted", "declined", "expired"] as const;
export const QUOTE_CURRENCIES = ["GBP", "USD", "EUR", "BDT"] as const;

export const ACTIVITY_TYPES = ["note", "call", "email", "whatsapp", "meeting", "follow_up"] as const;
export const ACTIVITY_LABELS: Record<(typeof ACTIVITY_TYPES)[number] | "created" | "stage_change" | "quotation", string> = {
  created: "Enquiry created",
  note: "Note",
  call: "Call logged",
  email: "Email logged",
  whatsapp: "WhatsApp logged",
  meeting: "Meeting logged",
  follow_up: "Follow-up",
  stage_change: "Stage changed",
  quotation: "Quotation",
};
