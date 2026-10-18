export interface LeadRecord {
  id: string;
  companyId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  targetCountry: string | null;
  studyLevel: string | null;
  courseInterest: string | null;
  intake: string | null;
  source: string;
  stage: string;
  consentStatus: string;
  consentRecordedAt: string | null;
  nextFollowUp: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { activities: number; quotations: number };
}

export interface LeadActivityRecord {
  id: string;
  leadId: string;
  type: string;
  body: string;
  actor: string;
  createdAt: string;
}

export interface QuotationItemRecord {
  id: string;
  description: string;
  quantity: number;
  unitPrice: string | number;
  lineTotal: string | number;
  position: number;
}

export interface QuotationRecord {
  id: string;
  leadId: string;
  number: string;
  title: string;
  currency: string;
  status: string;
  subtotal: string | number;
  discountAmount: string | number;
  taxRate: string | number;
  taxAmount: string | number;
  total: string | number;
  validUntil: string | null;
  terms: string | null;
  notes: string | null;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: QuotationItemRecord[];
  lead?: Pick<LeadRecord, "id" | "fullName" | "email" | "phone"> & {
    company?: { name: string; domain: string | null };
  };
}
