import bcrypt from "bcryptjs";
import type { DB } from "./connection";
import { SEED_APPLICATIONS } from "./seedData";

/** Demo officer accounts — documented in the README. */
export const DEMO_OFFICERS = [
  { email: "tehsildar@chandanpur.example.in", name: "अनिल शर्मा", designation: "तहसीलदार", password: "demo1234" },
  { email: "naib@chandanpur.example.in", name: "मीना त्रिपाठी", designation: "नायब तहसीलदार", password: "demo1234" },
];

const daysAgo = (n: number, hour = 11) => {
  const d = new Date(Date.now() - n * 86_400_000);
  d.setUTCHours(hour - 5, 30, 0, 0); // office hours IST
  return d.toISOString();
};
const dateIn = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export function seedDatabase(db: DB, { reset = false } = {}): { seeded: boolean } {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM applications").get() as { n: number };
  if (n > 0 && !reset) return { seeded: false };

  db.transaction(() => {
    if (reset) {
      for (const t of ["ai_usage", "events", "ai_analyses", "documents", "applications", "officers"]) db.prepare(`DELETE FROM ${t}`).run();
      db.prepare("DELETE FROM sqlite_sequence").run();
    }
    const insertOfficer = db.prepare("INSERT INTO officers (email, password_hash, name, designation) VALUES (?, ?, ?, ?)");
    for (const o of DEMO_OFFICERS) insertOfficer.run(o.email, bcrypt.hashSync(o.password, 10), o.name, o.designation);

    const insertApp = db.prepare(
      `INSERT INTO applications (id, applicant_name, applicant_name_en, father_name, gender, dob, mobile_masked, aadhaar_last4,
         village, district, category, caste, annual_income, purpose, purpose_deadline, submitted_at,
         status, decided_at, decided_by, decision_reason, certificate_no)
       VALUES (@id, @name, @nameEn, @father, @gender, @dob, @mobile, @aadhaar4, @village, 'चंदनपुर', @category, @caste,
         @income, @purpose, @deadline, @submittedAt, @status, @decidedAt, @decidedBy, @reason, @certNo)`,
    );
    const insertDoc = db.prepare("INSERT INTO documents (application_id, type, fields) VALUES (?, ?, ?)");
    const insertEvent = db.prepare("INSERT INTO events (application_id, officer_id, type, detail, created_at) VALUES (?, ?, ?, ?, ?)");

    for (const a of SEED_APPLICATIONS) {
      const submittedAt = daysAgo(a.daysAgo, 10 + (a.id.charCodeAt(a.id.length - 1) % 6));
      insertApp.run({
        ...a,
        mobile: `XXXXXX${a.aadhaar4.slice(0, 2)}${a.id.slice(-2)}`,
        deadline: a.deadlineInDays !== undefined ? dateIn(a.deadlineInDays) : null,
        submittedAt,
        status: a.decided?.status ?? "pending",
        decidedAt: a.decided ? daysAgo(a.decided.daysAgo, 15) : null,
        decidedBy: a.decided ? 1 : null,
        reason: a.decided?.reason ?? null,
        certNo: a.decided?.status === "approved" ? `CDP/JPP/2026/${a.id.slice(-4)}` : null,
      });
      for (const [type, fields] of Object.entries(a.docs)) insertDoc.run(a.id, type, JSON.stringify(fields ?? {}));
      insertEvent.run(a.id, null, "submitted", null, submittedAt);
      if (a.decided) insertEvent.run(a.id, 1, a.decided.status, a.decided.reason, daysAgo(a.decided.daysAgo, 15));
    }
  })();
  return { seeded: true };
}

// `npm run seed` — wipes and reseeds the configured database.
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("dotenv/config");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getDb } = require("./connection") as typeof import("./connection");
  console.log(seedDatabase(getDb(), { reset: process.argv.includes("--reset") }).seeded ? "Database seeded." : "Already seeded.");
}
