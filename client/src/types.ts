export interface Text {
  hi: string;
  en: string;
}
export type Status = "pending" | "returned" | "approved" | "rejected";
export type Decision = "approve" | "reject" | "return";
export type Band = "urgent" | "high" | "normal";

export interface Officer {
  id: number;
  name: string;
  email: string;
  designation: string;
}

export interface Attention {
  score: number;
  band: Band;
  reasons: Text[];
  daysPending: number;
  slaDueAt: string;
  slaDaysLeft: number;
}

export interface ApplicationSummary {
  id: string;
  applicantName: string;
  applicantNameEn: string;
  village: string;
  category: "SC" | "ST" | "OBC";
  caste: string;
  purpose: string;
  purposeDeadline: string | null;
  submittedAt: string;
  status: Status;
  decidedAt: string | null;
  rules: { suggestion: Decision; blockers: number; warnings: number };
  attention: Attention | null;
}

export interface Check {
  id: string;
  severity: "blocker" | "warning" | "ok";
  kind: "fixable" | "ineligible" | "info";
  title: Text;
  detail: Text;
}

export interface DocFields {
  name?: string;
  father_name?: string;
  dob?: string;
  district?: string;
  caste?: string;
  category?: string;
  annual_income?: number;
  recommendation?: "recommended" | "not_recommended";
  remarks?: string;
}

export interface ApplicationDetail {
  application: {
    id: string;
    applicantName: string;
    applicantNameEn: string;
    fatherName: string;
    gender: "F" | "M" | "O";
    dob: string;
    mobileMasked: string;
    aadhaarMasked: string;
    village: string;
    district: string;
    category: "SC" | "ST" | "OBC";
    caste: string;
    annualIncome: number | null;
    purpose: string;
    purposeDeadline: string | null;
    submittedAt: string;
    status: Status;
    decision: null | {
      at: string;
      by: { name: string; designation: string } | null;
      reason: string | null;
      aiSuggestion: Decision | null;
      certificateNo: string | null;
    };
  };
  documents: Array<{ type: string; label: Text; fields: DocFields }>;
  rules: { checks: Check[]; suggestion: Decision; blockers: number };
  attention: Attention | null;
  events: Array<{ id: number; type: string; detail: string | null; createdAt: string; officerName: string | null }>;
}

export interface Analysis {
  summary: Text;
  missing_documents: Text[];
  inconsistencies: Array<Text & { severity: "high" | "medium" | "low" }>;
  suggested_decision: Decision;
  reasons: Text[];
  confidence: "high" | "medium" | "low";
  applicant_message: Text;
  verify_before_deciding: Text[];
}

export interface AnalysisResult {
  analysis: Analysis;
  source: "ai" | "template";
  generatedAt: string;
  cached: boolean;
  conflictsWithRules: boolean;
  rulesSuggestion: Decision;
}

export interface Stats {
  counts: Record<Status, number>;
  overdue: number;
  dueSoon: number;
  ready: number;
  withProblems: number;
  last30Days: { decided: number; withAiSuggestion: number; agreedWithAi: number };
  slaDays: number;
  ai: { configured: boolean; model: string; circuitOpen: boolean };
}
