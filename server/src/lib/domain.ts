/** Shared vocabulary for the caste-certificate (जाति प्रमाण पत्र) workflow. */

/** Bilingual text. Hindi is the primary language of the app; English is a toggle. */
export interface Text {
  hi: string;
  en: string;
}

export const CATEGORIES = ["SC", "ST", "OBC"] as const;
export type Category = (typeof CATEGORIES)[number];

export const STATUSES = ["pending", "returned", "approved", "rejected"] as const;
export type Status = (typeof STATUSES)[number];

export const DECISIONS = ["approve", "reject", "return"] as const;
export type Decision = (typeof DECISIONS)[number];

export const DOC_TYPES = [
  "aadhaar",
  "residence_proof",
  "lineage_proof",
  "income_certificate",
  "self_declaration",
  "photo",
  "field_report",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_LABELS: Record<DocType, Text> = {
  aadhaar: { hi: "आधार कार्ड", en: "Aadhaar card" },
  residence_proof: { hi: "निवास प्रमाण", en: "Residence proof" },
  lineage_proof: { hi: "पिता/परिवार का जाति प्रमाण या परिवार रजिस्टर", en: "Father's caste certificate or family register" },
  income_certificate: { hi: "आय प्रमाण पत्र", en: "Income certificate" },
  self_declaration: { hi: "स्व-घोषणा पत्र", en: "Self-declaration" },
  photo: { hi: "फोटो", en: "Photograph" },
  field_report: { hi: "लेखपाल जाँच रिपोर्ट", en: "Lekhpal (field) verification report" },
};

/**
 * Fields read off a document. In production these would come from OCR / DigiLocker; in this
 * demo they are part of the made-up seed data.
 */
export interface DocFields {
  name?: string;
  father_name?: string;
  dob?: string;
  district?: string;
  caste?: string;
  category?: Category;
  annual_income?: number;
  recommendation?: "recommended" | "not_recommended";
  remarks?: string;
}

export interface Officer {
  id: number;
  name: string;
  email: string;
  designation: string;
}
