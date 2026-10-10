export interface MarketingAssetTemplate {
  id: string;
  channel: "Email" | "WhatsApp" | "Social post" | "Carousel" | "Landing page";
  title: string;
  body: string;
}

export interface MarketingKit {
  id: string;
  title: string;
  category: "Enquiry follow-up" | "Awareness" | "Event" | "Readiness";
  objective: string;
  audience: string;
  angle: string;
  topic: string;
  fields: Array<{ key: string; label: string; defaultValue: string }>;
  guardrails: string[];
  assets: MarketingAssetTemplate[];
}

/** Original ALO campaign starting points; placeholders must be reviewed before use. */
export const MARKETING_KITS: MarketingKit[] = [
  {
    id: "consultation-follow-up",
    title: "Study plan consultation",
    category: "Enquiry follow-up",
    objective: "Help a prospective student choose a useful next step after asking for information.",
    audience: "Students who explicitly requested information or a consultation.",
    angle: "A short, practical conversation about course fit, timing, and the application process.",
    topic: "Study plan consultation",
    fields: [
      { key: "first_name", label: "First name", defaultValue: "there" },
      { key: "course", label: "Course / subject", defaultValue: "your course options" },
      { key: "intake", label: "Intake", defaultValue: "your preferred intake" },
      { key: "booking_link", label: "Booking link", defaultValue: "[add verified booking link]" },
      { key: "advisor", label: "Advisor / team name", defaultValue: "ALO Education team" },
      { key: "preference_link", label: "Preference / unsubscribe link", defaultValue: "[add preference link]" },
    ],
    guardrails: [
      "Use only for the enquiry response or a channel the recipient has agreed to receive.",
      "Do not imply that admission, funding, or a visa is guaranteed.",
      "Confirm the appointment URL and the organisation's privacy / preference links before publishing.",
    ],
    assets: [
      { id: "email", channel: "Email", title: "Helpful next step", body: "Subject: A next step for {{course}}\n\nHi {{first_name}},\n\nThanks for getting in touch. If useful, we can talk through your interest in {{course}}, your preferred timing ({{intake}}), and the questions to confirm with each institution.\n\nChoose a time here: {{booking_link}}\n\nThere is no pressure to book. Admission decisions are made by institutions, and we cannot guarantee an outcome.\n\nKind regards,\n{{advisor}}\n\nTo change your marketing preferences, use: {{preference_link}}" },
      { id: "whatsapp", channel: "WhatsApp", title: "Short enquiry reply", body: "Hi {{first_name}} — thanks for asking about {{course}}. If you share the intake you are considering ({{intake}}), we can outline a few questions to check with institutions. If a call helps, choose a time here: {{booking_link}}. No admission or visa outcome can be guaranteed. Reply STOP if you do not want further messages." },
      { id: "social", channel: "Social post", title: "Plan with better questions", body: "Thinking about studying abroad? Start with three useful questions: what do you want to study, when would you like to begin, and what should you verify directly with the institution? Save this checklist and speak with a qualified adviser if you need help comparing next steps. No outcome is guaranteed." },
    ],
  },
  {
    id: "application-readiness",
    title: "Application readiness checklist",
    category: "Readiness",
    objective: "Offer a simple, non-legal checklist that helps a student organise an application conversation.",
    audience: "Prospective applicants who have opted in to receive education updates.",
    angle: "Make the next conversation more useful by gathering questions, not sensitive documents.",
    topic: "Application readiness checklist",
    fields: [
      { key: "first_name", label: "First name", defaultValue: "there" },
      { key: "course", label: "Course / subject", defaultValue: "your chosen course" },
      { key: "institution", label: "Institution", defaultValue: "your shortlisted institution" },
      { key: "official_link", label: "Official information link", defaultValue: "[add current official link]" },
      { key: "advisor", label: "Advisor / team name", defaultValue: "ALO Education team" },
      { key: "preference_link", label: "Preference / unsubscribe link", defaultValue: "[add preference link]" },
    ],
    guardrails: [
      "Verify current entry requirements, fees, and dates on the institution's own website before sharing.",
      "Never request passport scans or sensitive records through this marketing template.",
      "Immigration information is general only; refer people to official sources or an appropriately authorised adviser.",
    ],
    assets: [
      { id: "email", channel: "Email", title: "Prepare for your application conversation", body: "Subject: A quick checklist for {{course}}\n\nHi {{first_name}},\n\nBefore you compare options at {{institution}}, it can help to note: your academic background, preferred start date, questions about entry requirements, and the costs you need to verify.\n\nCheck current requirements directly with the institution: {{official_link}}\n\nThis checklist is general information, not admissions or immigration advice. Please do not send identity documents by reply.\n\n{{advisor}}\n\nPreferences: {{preference_link}}" },
      { id: "carousel", channel: "Carousel", title: "Five questions to verify", body: "Card 1 — Before you apply, pause and verify.\nCard 2 — Does the institution offer the course and intake you want?\nCard 3 — What are the published entry requirements?\nCard 4 — Which fees and deadlines are current on the official page?\nCard 5 — Who can answer course-specific questions?\nCard 6 — Save the official links. General information only; no admission or visa result is guaranteed." },
      { id: "whatsapp", channel: "WhatsApp", title: "Checklist nudge", body: "Hi {{first_name}} — for {{course}}, start by checking the current entry criteria and dates with the institution: {{official_link}}. This is a general checklist, not legal or immigration advice. Please don't send passport or sensitive documents by chat." },
    ],
  },
  {
    id: "student-family-session",
    title: "Student & family Q&A session",
    category: "Event",
    objective: "Invite interested students and families to an informational session with clear limits and logistics.",
    audience: "Students and families who opted in to event announcements.",
    angle: "A calm space to ask about planning, course research, and where to verify official information.",
    topic: "Student and family information session",
    fields: [
      { key: "first_name", label: "First name", defaultValue: "there" },
      { key: "event_date", label: "Event date", defaultValue: "[confirm date]" },
      { key: "event_time", label: "Event time and timezone", defaultValue: "[confirm time and timezone]" },
      { key: "registration_link", label: "Registration link", defaultValue: "[add verified registration link]" },
      { key: "host", label: "Host name", defaultValue: "ALO Education team" },
      { key: "preference_link", label: "Preference / unsubscribe link", defaultValue: "[add preference link]" },
    ],
    guardrails: [
      "Confirm date, time zone, accessibility details, host, and registration link before sending.",
      "State clearly that a session is informational and does not promise admission, funding, or a visa.",
      "Use event reminders only where the recipient has opted in or another lawful basis has been reviewed.",
    ],
    assets: [
      { id: "email", channel: "Email", title: "Invitation", body: "Subject: Questions about your study plans? Join our Q&A\n\nHi {{first_name}},\n\nYou are invited to an online information session on {{event_date}} at {{event_time}}. Bring your questions about comparing courses, planning a timeline, and finding official information.\n\nRegister here: {{registration_link}}\n\nThe session is informational. It cannot guarantee admission, scholarships, or immigration outcomes.\n\nBest,\n{{host}}\n\nPreferences: {{preference_link}}" },
      { id: "social", channel: "Social post", title: "Event announcement", body: "STUDY PLANNING Q&A\n{{event_date}} · {{event_time}}\n\nBring your questions about course research, application planning, and where to verify requirements. Informational session only—no admission or visa outcomes are promised.\n\nRegister: {{registration_link}}" },
      { id: "whatsapp", channel: "WhatsApp", title: "Opt-in event reminder", body: "Reminder for the study-planning Q&A on {{event_date}} at {{event_time}}: {{registration_link}}. The session is informational and does not guarantee any outcome. Reply STOP to opt out of further event messages." },
    ],
  },
  {
    id: "deadline-awareness",
    title: "Application deadline awareness",
    category: "Awareness",
    objective: "Encourage students to check a published institution deadline without inventing urgency.",
    audience: "Prospective students following a course or institution who have requested relevant updates.",
    angle: "Remind people to verify the date at the official source and allow time for questions.",
    topic: "Verify course application dates",
    fields: [
      { key: "first_name", label: "First name", defaultValue: "there" },
      { key: "course", label: "Course / subject", defaultValue: "the course you are considering" },
      { key: "institution", label: "Institution", defaultValue: "the institution" },
      { key: "deadline", label: "Verified deadline", defaultValue: "[verify current date]" },
      { key: "official_link", label: "Official source URL", defaultValue: "[add current official link]" },
      { key: "advisor", label: "Advisor / team name", defaultValue: "ALO Education team" },
      { key: "preference_link", label: "Preference / unsubscribe link", defaultValue: "[add preference link]" },
    ],
    guardrails: [
      "A human must verify the date and URL on the official institution page immediately before use.",
      "Do not use countdowns, scarcity, or claims that an application is guaranteed to be accepted.",
      "Do not message opted-out contacts; keep an auditable source for contact preferences.",
    ],
    assets: [
      { id: "email", channel: "Email", title: "Check the official date", body: "Subject: Please verify the {{course}} application date\n\nHi {{first_name}},\n\nIf {{course}} at {{institution}} is on your shortlist, check the current deadline directly with the institution. Our notes show {{deadline}}, but dates can change—use the official page as the source of truth: {{official_link}}\n\nIf you need help understanding the published steps, reply with your question. This message is not a promise of an offer or outcome.\n\n{{advisor}}\n\nPreferences: {{preference_link}}" },
      { id: "social", channel: "Social post", title: "Deadline check", body: "Planning an application? Don't rely on an old screenshot or forwarded date. Open the institution's current course page and verify the deadline, entry criteria, and required steps. Save the official source so you can check it again. Dates change; an application never guarantees an offer." },
      { id: "carousel", channel: "Carousel", title: "How to check an application date", body: "Card 1 — Application date check\nCard 2 — Open the institution's official course page.\nCard 3 — Confirm your specific course and intake.\nCard 4 — Check whether the date differs by applicant type.\nCard 5 — Save the page and note when you checked it.\nCard 6 — Ask the institution if anything is unclear. Dates can change; verify before acting." },
    ],
  },
];
