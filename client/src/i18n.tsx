import { createContext, useContext, useState, type ReactNode } from "react";
import type { Text } from "./types";

export type Lang = "hi" | "en";

/**
 * UI strings. Hindi is the default: officers in Hindi-speaking tehsils work in Hindi, and
 * Devanagari is used everywhere (numbers stay in international digits, as on government forms).
 */
const STRINGS = {
  appTitle: { hi: "जाति प्रमाण पत्र", en: "Caste Certificates" },
  appSub: { hi: "अधिकारी कंसोल · तहसील चंदनपुर सदर", en: "Officer console · Tehsil Chandanpur Sadar" },
  demoNote: { hi: "डेमो: सभी आँकड़े काल्पनिक हैं", en: "Demo: all data is fictional" },
  signOut: { hi: "लॉग आउट", en: "Sign out" },
  pendingQueue: { hi: "लंबित आवेदन", en: "Pending" },
  decided: { hi: "निपटाए गए", en: "Decided" },
  login: { hi: "लॉग इन करें", en: "Sign in" },
  loginTitle: { hi: "अधिकारी लॉग इन", en: "Officer sign in" },
  email: { hi: "ईमेल", en: "Email" },
  password: { hi: "पासवर्ड", en: "Password" },
  demoAccounts: { hi: "डेमो खाता", en: "Demo account" },
  loading: { hi: "लोड हो रहा है…", en: "Loading…" },
  // dashboard
  statPending: { hi: "कुल लंबित", en: "Pending" },
  statOverdue: { hi: "सेवा अवधि पार", en: "Past service deadline" },
  statDueSoon: { hi: "3 दिन में देय", en: "Due in 3 days" },
  statReady: { hi: "शीघ्र निपटान योग्य", en: "Ready to clear" },
  statProblems: { hi: "कमियों वाले", en: "With problems" },
  viewAll: { hi: "सभी", en: "All" },
  search: { hi: "नाम, ग्राम या आवेदन संख्या खोजें", en: "Search name, village or application no." },
  allCategories: { hi: "सभी वर्ग", en: "All categories" },
  orderNote: { hi: "क्रम: सबसे पहले ध्यान देने योग्य", en: "Ordered by what needs attention first" },
  nothingHere: { hi: "कोई आवेदन नहीं", en: "No applications" },
  pendingFor: { hi: "दिन से लंबित", en: "days pending" },
  rulesSay: { hi: "नियम जाँच", en: "Rule checks" },
  blockers: { hi: "आपत्ति", en: "blocking" },
  warnings: { hi: "चेतावनी", en: "warnings" },
  allClear: { hi: "सब ठीक", en: "all clear" },
  // detail
  back: { hi: "← सूची पर वापस", en: "← Back to list" },
  applicant: { hi: "आवेदक विवरण", en: "Applicant" },
  father: { hi: "पिता का नाम", en: "Father's name" },
  dob: { hi: "जन्म तिथि", en: "Date of birth" },
  address: { hi: "पता", en: "Address" },
  categoryCaste: { hi: "वर्ग / जाति", en: "Category / caste" },
  income: { hi: "पारिवारिक वार्षिक आय", en: "Annual family income" },
  purpose: { hi: "प्रयोजन", en: "Purpose" },
  applicantDeadline: { hi: "आवेदक की अंतिम तिथि", en: "Applicant's deadline" },
  submitted: { hi: "आवेदन तिथि", en: "Submitted" },
  serviceDeadline: { hi: "सेवा अवधि", en: "Service deadline" },
  documents: { hi: "संलग्न दस्तावेज़", en: "Documents" },
  checks: { hi: "नियम-आधारित जाँच", en: "Rule-based checks" },
  checksNote: { hi: "ये जाँच सिस्टम स्वयं करता है; AI इन्हें बदल नहीं सकता।", en: "Computed by the system; the AI cannot override them." },
  history: { hi: "कार्यवाही इतिहास", en: "History" },
  aiNote: { hi: "AI सहायक की टिप्पणी", en: "AI case note" },
  aiTemplate: { hi: "नियम-आधारित टिप्पणी (AI अनुपलब्ध)", en: "Rule-based note (AI unavailable)" },
  regenerate: { hi: "↻ पुनः तैयार करें", en: "↻ Regenerate" },
  preparing: { hi: "AI टिप्पणी तैयार हो रही है…", en: "Preparing AI case note…" },
  summary: { hi: "सारांश", en: "Summary" },
  missingDocs: { hi: "अनुपलब्ध दस्तावेज़", en: "Missing documents" },
  inconsistencies: { hi: "विसंगतियाँ", en: "Inconsistencies" },
  suggestion: { hi: "सुझाया गया निर्णय", en: "Suggested decision" },
  reasons: { hi: "कारण", en: "Reasons" },
  confidence: { hi: "विश्वास स्तर", en: "Confidence" },
  verify: { hi: "निर्णय से पहले स्वयं जाँचें", en: "Verify before deciding" },
  conflict: {
    hi: "सावधान: AI ने स्वीकृति सुझाई है, परंतु नियम-आधारित जाँच में आपत्ति है। निर्णय सोच-समझकर लें।",
    en: "Caution: the AI suggests approval but rule checks are failing. Decide carefully.",
  },
  aiDisclaimer: { hi: "AI केवल सहायता करता है। अंतिम निर्णय आपका है।", en: "The AI only assists. The final decision is yours." },
  yourDecision: { hi: "आपका निर्णय", en: "Your decision" },
  reason: { hi: "कारण / टिप्पणी", en: "Reason / remarks" },
  reasonHelpReturn: { hi: "आवेदक को यही संदेश भेजा जाएगा। AI ड्राफ्ट संपादित करें।", en: "This message goes to the applicant. Edit the AI draft as needed." },
  reasonOptional: { hi: "वैकल्पिक", en: "optional" },
  useDraft: { hi: "AI ड्राफ्ट उपयोग करें", en: "Use AI draft" },
  override: { hi: "मैं नियम-आधारित आपत्तियों के बावजूद स्वीकृति दे रहा/रही हूँ (कारण अनिवार्य)", en: "I am approving despite failing rule checks (reason required)" },
  confirm: { hi: "पुष्टि करें", en: "Confirm" },
  cancel: { hi: "रद्द करें", en: "Cancel" },
  decidedBy: { hi: "निर्णयकर्ता", en: "Decided by" },
  certificateNo: { hi: "प्रमाण पत्र संख्या", en: "Certificate no." },
  aiSuggested: { hi: "AI सुझाव था", en: "AI had suggested" },
  agreement: { hi: "पिछले 30 दिन: AI सुझाव से सहमति", en: "Last 30 days: agreed with AI" },
} satisfies Record<string, Text>;

export type Key = keyof typeof STRINGS;

export const DECISION_LABEL: Record<"approve" | "reject" | "return", Text> = {
  approve: { hi: "स्वीकृत करें", en: "Approve" },
  return: { hi: "सुधार हेतु लौटाएँ", en: "Return for correction" },
  reject: { hi: "अस्वीकृत करें", en: "Reject" },
};

export const STATUS_LABEL: Record<string, Text> = {
  pending: { hi: "लंबित", en: "Pending" },
  returned: { hi: "लौटाया गया", en: "Returned" },
  approved: { hi: "स्वीकृत", en: "Approved" },
  rejected: { hi: "अस्वीकृत", en: "Rejected" },
  submitted: { hi: "आवेदन प्राप्त", en: "Submitted" },
};

export const CONFIDENCE_LABEL: Record<string, Text> = {
  high: { hi: "उच्च", en: "High" },
  medium: { hi: "मध्यम", en: "Medium" },
  low: { hi: "निम्न", en: "Low" },
};

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key) => string;
  pick: (text: Text) => string;
}

const LangContext = createContext<LangState | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      return (localStorage.getItem("kenpath.lang") as Lang) || "hi";
    } catch {
      return "hi";
    }
  });
  const setLang = (l: Lang) => {
    setLangState(l);
    document.documentElement.lang = l;
    try {
      localStorage.setItem("kenpath.lang", l);
    } catch {
      /* ignore */
    }
  };
  const value: LangState = { lang, setLang, t: (k) => STRINGS[k][lang], pick: (text) => text[lang] };
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangState {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}

export const fmtDate = (iso: string | null | undefined, lang: Lang) =>
  iso ? new Date(iso).toLocaleDateString(lang === "hi" ? "hi-IN-u-nu-latn" : "en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

export const fmtMoney = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `₹${n.toLocaleString("en-IN")}`);
