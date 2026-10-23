import type { Category } from "../lib/domain";

/**
 * Sample notified lists for the fictional district used in this demo. A real deployment would
 * load the state's official schedules; these short lists only exist to exercise the rules.
 */
export const NOTIFIED_CASTES: Record<Category, string[]> = {
  SC: ["जाटव", "पासी", "धोबी", "कोरी", "वाल्मीकि"],
  ST: ["थारू", "गोंड", "खरवार", "बैगा"],
  OBC: ["यादव", "कुर्मी", "लोधी", "मौर्य", "कुशवाहा", "प्रजापति", "निषाद"],
};

/** OBC applicants above this family income fall in the "creamy layer" and are not eligible. */
export const OBC_INCOME_LIMIT = 800_000;

/** The (fictional) district this tehsil office serves. */
export const OFFICE_DISTRICT = "चंदनपुर";
export const OFFICE_TEHSIL = "चंदनपुर सदर";
