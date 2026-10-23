import type { Category, DocFields, DocType, Text } from "../lib/domain";
import { DOC_LABELS } from "../lib/domain";
import { NOTIFIED_CASTES, OBC_INCOME_LIMIT, OFFICE_DISTRICT } from "./casteLists";

/**
 * Deterministic eligibility and document checks.
 *
 * These run before (and independently of) the AI. They are the source of truth for hard rules:
 * the AI explains and summarises, but can never wave away a failed rule. If the AI suggests
 * "approve" while a blocking rule fails, the UI shows the conflict to the officer.
 */

export type Severity = "blocker" | "warning" | "ok";
/** fixable → the applicant can correct it (return); ineligible → grounds to reject. */
export type Kind = "fixable" | "ineligible" | "info";

export interface Check {
  id: string;
  severity: Severity;
  kind: Kind;
  title: Text;
  detail: Text;
}

export interface ApplicationFacts {
  applicant_name: string;
  father_name: string;
  dob: string;
  district: string;
  category: Category;
  caste: string;
  annual_income: number | null;
  aadhaar_last4: string;
}

export interface DocumentFacts {
  type: DocType;
  fields: DocFields;
}

export interface RuleResult {
  checks: Check[];
  suggestion: "approve" | "reject" | "return";
  blockers: number;
}

const REQUIRED: DocType[] = ["aadhaar", "residence_proof", "lineage_proof", "self_declaration", "photo", "field_report"];

/** Normalises names for comparison: case, extra spaces, honorifics and nukta variants. */
export function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(shri|smt|kumari|sri|mr|mrs|ms)\.?\s+/g, "")
    .replace(/^(श्री|श्रीमती|कुमारी)\s+/u, "")
    .replace(/[़]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

const ok = (id: string, title: Text, detail: Text): Check => ({ id, severity: "ok", kind: "info", title, detail });

export function runChecks(app: ApplicationFacts, docs: DocumentFacts[], duplicateOf: string | null): RuleResult {
  const checks: Check[] = [];
  const byType = new Map(docs.map((d) => [d.type, d.fields]));

  // 1. Required documents
  const required = app.category === "OBC" ? [...REQUIRED, "income_certificate" as DocType] : REQUIRED;
  const missing = required.filter((t) => !byType.has(t));
  if (missing.length) {
    checks.push({
      id: "missing_documents",
      severity: "blocker",
      kind: "fixable",
      title: { hi: "आवश्यक दस्तावेज़ नहीं हैं", en: "Required documents missing" },
      detail: {
        hi: missing.map((t) => DOC_LABELS[t].hi).join(", "),
        en: missing.map((t) => DOC_LABELS[t].en).join(", "),
      },
    });
  } else {
    checks.push(ok("documents_complete", { hi: "सभी आवश्यक दस्तावेज़ उपलब्ध", en: "All required documents present" }, { hi: `${required.length} दस्तावेज़`, en: `${required.length} documents` }));
  }

  // 2. Name / father's name / DOB consistency across documents
  const mismatches = (field: "name" | "father_name" | "dob", expected: string) =>
    docs.filter((d) => d.fields[field] && normaliseName(d.fields[field]!) !== normaliseName(expected));

  for (const [field, expected, label] of [
    ["name", app.applicant_name, { hi: "आवेदक का नाम", en: "Applicant name" }],
    ["father_name", app.father_name, { hi: "पिता का नाम", en: "Father's name" }],
    ["dob", app.dob, { hi: "जन्म तिथि", en: "Date of birth" }],
  ] as const) {
    const bad = mismatches(field, expected);
    if (bad.length) {
      checks.push({
        id: `${field}_mismatch`,
        severity: "blocker",
        kind: "fixable",
        title: { hi: `${label.hi} दस्तावेज़ों में मेल नहीं खाता`, en: `${label.en} does not match across documents` },
        detail: {
          hi: `आवेदन: "${expected}"; ` + bad.map((d) => `${DOC_LABELS[d.type].hi}: "${d.fields[field]}"`).join("; "),
          en: `Application: "${expected}"; ` + bad.map((d) => `${DOC_LABELS[d.type].en}: "${d.fields[field]}"`).join("; "),
        },
      });
    }
  }

  // 3. Residence within this office's district
  const residenceDistrict = byType.get("residence_proof")?.district ?? app.district;
  if (residenceDistrict !== OFFICE_DISTRICT) {
    checks.push({
      id: "outside_jurisdiction",
      severity: "blocker",
      kind: "ineligible",
      title: { hi: "निवास इस तहसील के क्षेत्राधिकार से बाहर", en: "Residence outside this office's jurisdiction" },
      detail: {
        hi: `निवास प्रमाण में जिला "${residenceDistrict}" है; यह कार्यालय "${OFFICE_DISTRICT}" के लिए है।`,
        en: `Residence proof shows district "${residenceDistrict}"; this office serves "${OFFICE_DISTRICT}".`,
      },
    });
  }

  // 4. Caste is on the notified list for the claimed category
  if (!NOTIFIED_CASTES[app.category].includes(app.caste)) {
    checks.push({
      id: "caste_not_notified",
      severity: "blocker",
      kind: "ineligible",
      title: { hi: "जाति अधिसूचित सूची में नहीं", en: "Caste not on the notified list" },
      detail: {
        hi: `"${app.caste}" ${app.category} सूची में नहीं है।`,
        en: `"${app.caste}" is not on the ${app.category} list.`,
      },
    });
  }

  // 5. Lineage proof supports the claimed caste
  const lineage = byType.get("lineage_proof");
  if (lineage?.caste && lineage.caste !== app.caste) {
    checks.push({
      id: "lineage_caste_mismatch",
      severity: "blocker",
      kind: "ineligible",
      title: { hi: "पारिवारिक प्रमाण में जाति भिन्न", en: "Lineage proof shows a different caste" },
      detail: {
        hi: `आवेदन: "${app.caste}", पारिवारिक प्रमाण: "${lineage.caste}"`,
        en: `Application: "${app.caste}", lineage proof: "${lineage.caste}"`,
      },
    });
  }

  // 6. OBC creamy layer
  if (app.category === "OBC") {
    const income = byType.get("income_certificate")?.annual_income ?? app.annual_income;
    if (income !== null && income !== undefined && income > OBC_INCOME_LIMIT) {
      checks.push({
        id: "obc_creamy_layer",
        severity: "blocker",
        kind: "ineligible",
        title: { hi: "पारिवारिक आय क्रीमी लेयर सीमा से अधिक", en: "Family income above the creamy-layer limit" },
        detail: {
          hi: `आय ₹${income.toLocaleString("en-IN")} > सीमा ₹${OBC_INCOME_LIMIT.toLocaleString("en-IN")}`,
          en: `Income ₹${income.toLocaleString("en-IN")} > limit ₹${OBC_INCOME_LIMIT.toLocaleString("en-IN")}`,
        },
      });
    }
    const declared = app.annual_income;
    const certified = byType.get("income_certificate")?.annual_income;
    if (declared !== null && certified !== undefined && Math.abs(declared - certified) > 0.1 * certified) {
      checks.push({
        id: "income_mismatch",
        severity: "warning",
        kind: "fixable",
        title: { hi: "घोषित आय और आय प्रमाण पत्र में अंतर", en: "Declared income differs from the income certificate" },
        detail: {
          hi: `घोषित ₹${declared.toLocaleString("en-IN")}, प्रमाण पत्र ₹${certified.toLocaleString("en-IN")}`,
          en: `Declared ₹${declared.toLocaleString("en-IN")}, certificate ₹${certified.toLocaleString("en-IN")}`,
        },
      });
    }
  }

  // 7. Field verification (Lekhpal) report
  const report = byType.get("field_report");
  if (report?.recommendation === "not_recommended") {
    checks.push({
      id: "field_report_adverse",
      severity: "blocker",
      kind: "ineligible",
      title: { hi: "लेखपाल रिपोर्ट में संस्तुति नहीं", en: "Field report does not recommend" },
      detail: { hi: report.remarks ?? "—", en: report.remarks ?? "—" },
    });
  } else if (report?.caste && report.caste !== app.caste) {
    checks.push({
      id: "field_report_caste_mismatch",
      severity: "warning",
      kind: "fixable",
      title: { hi: "लेखपाल रिपोर्ट में जाति भिन्न", en: "Field report records a different caste" },
      detail: { hi: `रिपोर्ट: "${report.caste}"`, en: `Report: "${report.caste}"` },
    });
  }

  // 8. Possible duplicate
  if (duplicateOf) {
    checks.push({
      id: "possible_duplicate",
      severity: "warning",
      kind: "info",
      title: { hi: "संभावित दोहराव आवेदन", en: "Possible duplicate application" },
      detail: {
        hi: `समान नाम व आधार (अंतिम 4 अंक ${app.aadhaar_last4}) वाला आवेदन ${duplicateOf} पहले से है।`,
        en: `Application ${duplicateOf} has the same name and Aadhaar (last 4: ${app.aadhaar_last4}).`,
      },
    });
  }

  const blockers = checks.filter((c) => c.severity === "blocker");
  const suggestion = blockers.some((c) => c.kind === "ineligible")
    ? "reject"
    : blockers.length || checks.some((c) => c.severity === "warning" && c.kind === "fixable")
      ? "return"
      : "approve";
  return { checks, suggestion, blockers: blockers.length };
}
