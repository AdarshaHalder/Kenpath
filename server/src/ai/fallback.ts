import type { Text } from "../lib/domain";
import type { RuleResult } from "../rules/engine";
import type { ApplicationRow } from "../services/applications";
import type { Analysis } from "./analyst";

/**
 * Case note built from the rules engine alone, used when the AI is unavailable. It is less
 * fluent but never wrong about the rules, so the officer can keep working during an outage.
 */
export function templateAnalysis(row: ApplicationRow, rules: RuleResult, daysPending: number): Analysis {
  const failing = rules.checks.filter((c) => c.severity !== "ok");
  const missing = rules.checks.find((c) => c.id === "missing_documents");
  const hiDetail = (t: Text, d: Text) => ({ hi: `${t.hi}: ${d.hi}`, en: `${t.en}: ${d.en}` });

  const outcome: Record<RuleResult["suggestion"], Text> = {
    approve: { hi: "सभी नियम-आधारित जाँच पास हैं।", en: "All rule-based checks pass." },
    return: { hi: "कुछ कमियाँ हैं जिन्हें आवेदक सुधार सकता है।", en: "There are gaps the applicant can fix." },
    reject: { hi: "पात्रता से संबंधित गंभीर आपत्ति है।", en: "There is a serious eligibility objection." },
  };

  const message: Record<RuleResult["suggestion"], Text> = {
    approve: {
      hi: `प्रिय ${row.applicant_name}, आपका जाति प्रमाण पत्र स्वीकृत कर दिया गया है। आप इसे पोर्टल से डाउनलोड कर सकते हैं।`,
      en: `Dear ${row.applicant_name_en}, your caste certificate has been approved and can be downloaded from the portal.`,
    },
    return: {
      hi: `प्रिय ${row.applicant_name}, आपका आवेदन सुधार हेतु लौटाया गया है। कृपया निम्न कमियाँ दूर कर पुनः जमा करें: ${failing.map((c) => c.title.hi).join("; ")}।`,
      en: `Dear ${row.applicant_name_en}, your application has been returned for correction. Please fix the following and resubmit: ${failing.map((c) => c.title.en).join("; ")}.`,
    },
    reject: {
      hi: `प्रिय ${row.applicant_name}, जाँच के उपरांत आपका आवेदन अस्वीकृत किया गया है। कारण: ${failing.filter((c) => c.kind === "ineligible").map((c) => c.title.hi).join("; ")}। आप चाहें तो उपजिलाधिकारी के समक्ष अपील कर सकते हैं।`,
      en: `Dear ${row.applicant_name_en}, after verification your application has been rejected. Reason: ${failing.filter((c) => c.kind === "ineligible").map((c) => c.title.en).join("; ")}. You may appeal to the Sub-Divisional Magistrate.`,
    },
  };

  return {
    summary: {
      hi: `${row.applicant_name} (पिता: ${row.father_name}), ग्राम ${row.village}, ने ${row.category} वर्ग (${row.caste}) के जाति प्रमाण पत्र हेतु "${row.purpose}" के लिए आवेदन किया है। आवेदन ${daysPending} दिन से लंबित है। ${outcome[rules.suggestion].hi}`,
      en: `${row.applicant_name_en}, of village ${row.village}, applied for a ${row.category} (${row.caste}) caste certificate for "${row.purpose}". Pending for ${daysPending} day(s). ${outcome[rules.suggestion].en}`,
    },
    missing_documents: missing ? missing.detail.hi.split(", ").map((hi, i) => ({ hi, en: missing.detail.en.split(", ")[i] ?? hi })) : [],
    inconsistencies: failing
      .filter((c) => c.id !== "missing_documents")
      .map((c) => ({ ...hiDetail(c.title, c.detail), severity: c.severity === "blocker" ? ("high" as const) : ("medium" as const) })),
    suggested_decision: rules.suggestion,
    reasons: failing.length ? failing.map((c) => c.title) : [outcome.approve],
    confidence: "medium",
    applicant_message: message[rules.suggestion],
    verify_before_deciding: [{ hi: "AI सेवा उपलब्ध नहीं थी; यह नोट केवल नियम-आधारित जाँच से बना है।", en: "AI was unavailable; this note is built from rule checks only." }],
  };
}
