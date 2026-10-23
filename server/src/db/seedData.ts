import type { Category, DocFields, DocType } from "../lib/domain";

/**
 * Made-up applications for the fictional district of चंदनपुर. No real citizen data.
 * Each case is designed to exercise one path an officer meets daily: clean approvals,
 * missing papers, name/DOB mismatches, creamy-layer income, out-of-jurisdiction residence,
 * adverse field reports, duplicates, and urgent deadlines.
 */

export interface SeedApplication {
  id: string;
  name: string;
  nameEn: string;
  father: string;
  gender: "F" | "M";
  dob: string;
  village: string;
  category: Category;
  caste: string;
  income: number | null;
  aadhaar4: string;
  purpose: string;
  /** Days from today until the applicant's own deadline (exam, admission, job form). */
  deadlineInDays?: number;
  daysAgo: number;
  docs: Partial<Record<DocType, DocFields | null>>;
  /** Already-decided cases for history. */
  decided?: { status: "approved" | "rejected" | "returned"; reason: string; daysAgo: number };
}

/** Builds a full, consistent document set; individual cases then override fields. */
function docsFor(a: Omit<SeedApplication, "docs">, overrides: SeedApplication["docs"] = {}): SeedApplication["docs"] {
  const base: SeedApplication["docs"] = {
    aadhaar: { name: a.name, father_name: a.father, dob: a.dob, district: "चंदनपुर" },
    residence_proof: { name: a.name, district: "चंदनपुर" },
    lineage_proof: { father_name: a.father, caste: a.caste, category: a.category },
    self_declaration: { name: a.name, father_name: a.father, caste: a.caste },
    photo: {},
    field_report: { name: a.name, caste: a.caste, recommendation: "recommended", remarks: "स्थलीय जाँच में परिवार की जाति की पुष्टि हुई।" },
  };
  if (a.category === "OBC") base.income_certificate = { name: a.name, annual_income: a.income ?? 0 };
  const merged = { ...base };
  for (const [k, v] of Object.entries(overrides) as Array<[DocType, DocFields | null]>) {
    if (v === null) delete merged[k];
    else merged[k] = { ...(base[k] ?? {}), ...v };
  }
  return merged;
}

function app(a: Omit<SeedApplication, "docs">, overrides?: SeedApplication["docs"]): SeedApplication {
  return { ...a, docs: docsFor(a, overrides) };
}

export const SEED_APPLICATIONS: SeedApplication[] = [
  app({ id: "JPP-2026-0101", name: "रीना कुमारी", nameEn: "Reena Kumari", father: "रामलाल", gender: "F", dob: "2007-03-14", village: "बेलहरा", category: "SC", caste: "जाटव", income: null, aadhaar4: "4821", purpose: "छात्रवृत्ति आवेदन", deadlineInDays: 4, daysAgo: 3 }),
  app({ id: "JPP-2026-0087", name: "सुनील कुमार", nameEn: "Sunil Kumar", father: "जगदीश प्रसाद", gender: "M", dob: "2001-08-02", village: "मधुपुर", category: "SC", caste: "पासी", income: null, aadhaar4: "1934", purpose: "सरकारी नौकरी आवेदन", daysAgo: 18 }),
  app({ id: "JPP-2026-0094", name: "पूजा यादव", nameEn: "Pooja Yadav", father: "राजेश यादव", gender: "F", dob: "2005-11-21", village: "सिकंदरपुर", category: "OBC", caste: "यादव", income: 420000, aadhaar4: "7310", purpose: "कॉलेज प्रवेश", deadlineInDays: 10, daysAgo: 9 }, { income_certificate: null }),
  app({ id: "JPP-2026-0098", name: "अमित वर्मा", nameEn: "Amit Verma", father: "सुरेंद्र वर्मा", gender: "M", dob: "1999-01-30", village: "चंदनपुर शहर", category: "OBC", caste: "कुर्मी", income: 1150000, aadhaar4: "5562", purpose: "सरकारी नौकरी आवेदन", daysAgo: 6 }),
  app({ id: "JPP-2026-0090", name: "राहुल सिंह", nameEn: "Rahul Singh", father: "महेंद्र सिंह", gender: "M", dob: "2004-06-09", village: "जमुनी", category: "ST", caste: "गोंड", income: null, aadhaar4: "2087", purpose: "छात्रवृत्ति आवेदन", daysAgo: 12 }, { aadhaar: { name: "राहुल सिह" } }),
  app({ id: "JPP-2026-0103", name: "सीमा देवी", nameEn: "Seema Devi", father: "मुन्नालाल", gender: "F", dob: "1992-02-17", village: "रामगढ़ खुर्द", category: "SC", caste: "धोबी", income: null, aadhaar4: "6648", purpose: "आवास योजना", daysAgo: 2 }, { residence_proof: { district: "रामगढ़" } }),
  app({ id: "JPP-2026-0089", name: "मोहन लाल", nameEn: "Mohan Lal", father: "छोटेलाल", gender: "M", dob: "1985-09-12", village: "पिपरिया", category: "OBC", caste: "लोधी", income: 260000, aadhaar4: "3905", purpose: "स्वरोज़गार ऋण", daysAgo: 14 }, { field_report: { recommendation: "not_recommended", remarks: "पड़ोसियों व ग्राम प्रधान के बयान के अनुसार परिवार लोधी जाति का नहीं है; पिता के अभिलेख में जाति 'ठाकुर' दर्ज है।" } }),
  app({ id: "JPP-2026-0099", name: "अंजलि मौर्य", nameEn: "Anjali Maurya", father: "विनोद मौर्य", gender: "F", dob: "2006-04-25", village: "कुसुमी", category: "OBC", caste: "मौर्य", income: 300000, aadhaar4: "8172", purpose: "कॉलेज प्रवेश", daysAgo: 5 }, { income_certificate: { annual_income: 610000 } }),
  app({ id: "JPP-2026-0082", name: "विकास कोरी", nameEn: "Vikas Kori", father: "शिवप्रसाद", gender: "M", dob: "2000-12-01", village: "बेलहरा", category: "SC", caste: "कोरी", income: null, aadhaar4: "0456", purpose: "सरकारी नौकरी आवेदन", daysAgo: 21 }, { aadhaar: { dob: "2000-01-12" } }),
  app({ id: "JPP-2026-0104", name: "प्रिया निषाद", nameEn: "Priya Nishad", father: "रमेश निषाद", gender: "F", dob: "2002-07-19", village: "घाटमपुर", category: "OBC", caste: "निषाद", income: 180000, aadhaar4: "9921", purpose: "सरकारी नौकरी आवेदन", deadlineInDays: 2, daysAgo: 1 }),
  app({ id: "JPP-2026-0105", name: "दीपक थारू", nameEn: "Deepak Tharu", father: "बलराम", gender: "M", dob: "2003-10-05", village: "जमुनी", category: "ST", caste: "थारू", income: null, aadhaar4: "3377", purpose: "छात्रवृत्ति आवेदन", daysAgo: 1 }, { lineage_proof: { caste: "कुर्मी", category: "OBC" } }),
  app({ id: "JPP-2026-0096", name: "कविता वाल्मीकि", nameEn: "Kavita Valmiki", father: "सोहनलाल", gender: "F", dob: "1998-05-30", village: "मधुपुर", category: "SC", caste: "वाल्मीकि", income: null, aadhaar4: "6014", purpose: "आँगनबाड़ी भर्ती", daysAgo: 8 }),
  app({ id: "JPP-2026-0106", name: "रीना कुमारी", nameEn: "Reena Kumari", father: "रामलाल", gender: "F", dob: "2007-03-14", village: "बेलहरा", category: "SC", caste: "जाटव", income: null, aadhaar4: "4821", purpose: "छात्रवृत्ति आवेदन", daysAgo: 0 }),
  app({ id: "JPP-2026-0092", name: "सुरेश प्रजापति", nameEn: "Suresh Prajapati", father: "हरिप्रसाद प्रजापति", gender: "M", dob: "1996-03-08", village: "कुसुमी", category: "OBC", caste: "प्रजापति", income: 350000, aadhaar4: "2240", purpose: "स्वरोज़गार ऋण", daysAgo: 10 }, { self_declaration: { father_name: "हरी प्रसाद" } }),
  app({ id: "JPP-2026-0079", name: "गीता खरवार", nameEn: "Geeta Kharwar", father: "रामसेवक", gender: "F", dob: "1994-11-11", village: "पिपरिया", category: "ST", caste: "खरवार", income: null, aadhaar4: "7788", purpose: "आवास योजना", daysAgo: 16 }),

  // Already decided — history and agreement statistics.
  app({ id: "JPP-2026-0071", name: "अर्जुन यादव", nameEn: "Arjun Yadav", father: "कैलाश यादव", gender: "M", dob: "2003-02-02", village: "सिकंदरपुर", category: "OBC", caste: "यादव", income: 240000, aadhaar4: "1200", purpose: "कॉलेज प्रवेश", daysAgo: 20, decided: { status: "approved", reason: "सभी दस्तावेज़ सही, लेखपाल रिपोर्ट सकारात्मक।", daysAgo: 6 } }),
  app({ id: "JPP-2026-0074", name: "शबनम", nameEn: "Shabnam", father: "इरफ़ान", gender: "F", dob: "2001-09-14", village: "चंदनपुर शहर", category: "OBC", caste: "कुशवाहा", income: 200000, aadhaar4: "5050", purpose: "छात्रवृत्ति आवेदन", daysAgo: 19, decided: { status: "returned", reason: "निवास प्रमाण अस्पष्ट है; नया बिजली बिल या राशन कार्ड अपलोड करें।", daysAgo: 4 } }, { residence_proof: null }),
];
