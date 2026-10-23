import { env } from "../config/env";
import { getDb } from "../db/connection";
import { DOC_LABELS, type Category, type Decision, type DocFields, type DocType, type Officer, type Status, type Text } from "../lib/domain";
import { badRequest, conflict, notFound } from "../lib/errors";
import { normaliseName, runChecks, type RuleResult } from "../rules/engine";

/**
 * Application queue, detail and decisions. The rules engine runs on every read: it is cheap,
 * deterministic, and means a rule change applies to every pending file immediately.
 */

export interface ApplicationRow {
  id: string;
  applicant_name: string;
  applicant_name_en: string;
  father_name: string;
  gender: "F" | "M" | "O";
  dob: string;
  mobile_masked: string;
  aadhaar_last4: string;
  village: string;
  district: string;
  category: Category;
  caste: string;
  annual_income: number | null;
  purpose: string;
  purpose_deadline: string | null;
  submitted_at: string;
  status: Status;
  decided_at: string | null;
  decided_by: number | null;
  decision_reason: string | null;
  ai_suggestion: Decision | null;
  certificate_no: string | null;
}

export interface DocumentView {
  type: DocType;
  label: Text;
  fields: DocFields;
}

const DAY = 86_400_000;
const days = (ms: number) => Math.floor(ms / DAY);

export function getRow(id: string): ApplicationRow {
  const row = getDb().prepare("SELECT * FROM applications WHERE id = ?").get(id) as ApplicationRow | undefined;
  if (!row) throw notFound("Application");
  return row;
}

export function getDocuments(id: string): DocumentView[] {
  const rows = getDb().prepare("SELECT type, fields FROM documents WHERE application_id = ? ORDER BY id").all(id) as Array<{ type: DocType; fields: string }>;
  return rows.map((r) => ({ type: r.type, label: DOC_LABELS[r.type], fields: JSON.parse(r.fields) as DocFields }));
}

function findDuplicate(row: ApplicationRow): string | null {
  const others = getDb()
    .prepare("SELECT id, applicant_name FROM applications WHERE id != ? AND aadhaar_last4 = ? AND status != 'rejected'")
    .all(row.id, row.aadhaar_last4) as Array<{ id: string; applicant_name: string }>;
  return others.find((o) => normaliseName(o.applicant_name) === normaliseName(row.applicant_name))?.id ?? null;
}

export function evaluate(row: ApplicationRow, docs = getDocuments(row.id)): RuleResult {
  return runChecks(
    {
      applicant_name: row.applicant_name,
      father_name: row.father_name,
      dob: row.dob,
      district: row.district,
      category: row.category,
      caste: row.caste,
      annual_income: row.annual_income,
      aadhaar_last4: row.aadhaar_last4,
    },
    docs,
    findDuplicate(row),
  );
}

export type Band = "urgent" | "high" | "normal";

export interface Attention {
  score: number;
  band: Band;
  reasons: Text[];
  daysPending: number;
  slaDueAt: string;
  slaDaysLeft: number;
}

/**
 * "What needs attention first": a transparent score, never a black box. Every point comes
 * with a reason the officer can read, in order of weight.
 */
export function attention(row: ApplicationRow, rules: RuleResult, now = Date.now()): Attention {
  const submitted = Date.parse(row.submitted_at);
  const daysPending = days(now - submitted);
  const slaDue = submitted + env.SLA_DAYS * DAY;
  const slaDaysLeft = Math.ceil((slaDue - now) / DAY);
  const reasons: Text[] = [];
  let score = daysPending;

  if (slaDaysLeft < 0) {
    score += 100 + 5 * -slaDaysLeft;
    reasons.push({ hi: `सेवा अवधि ${-slaDaysLeft} दिन पार`, en: `Service deadline passed ${-slaDaysLeft} day(s) ago` });
  } else if (slaDaysLeft <= 3) {
    score += 60;
    reasons.push({ hi: `सेवा अवधि ${slaDaysLeft} दिन में समाप्त`, en: `Service deadline in ${slaDaysLeft} day(s)` });
  }

  if (row.purpose_deadline) {
    const left = Math.ceil((Date.parse(row.purpose_deadline) - now) / DAY);
    if (left >= 0 && left <= 7) {
      score += 80 - left * 8;
      reasons.push({ hi: `आवेदक की अंतिम तिथि ${left} दिन में (${row.purpose})`, en: `Applicant's own deadline in ${left} day(s) (${row.purpose})` });
    }
  }

  if (rules.suggestion === "approve" && !rules.checks.some((c) => c.severity === "warning")) {
    score += 15;
    reasons.push({ hi: "सभी जाँच पास: शीघ्र निपटान योग्य", en: "All checks pass: quick to clear" });
  }

  const band: Band = score >= 100 ? "urgent" : score >= 50 ? "high" : "normal";
  return { score, band, reasons, daysPending, slaDueAt: new Date(slaDue).toISOString(), slaDaysLeft };
}

function summaryView(row: ApplicationRow) {
  const rules = evaluate(row);
  return {
    id: row.id,
    applicantName: row.applicant_name,
    applicantNameEn: row.applicant_name_en,
    village: row.village,
    category: row.category,
    caste: row.caste,
    purpose: row.purpose,
    purposeDeadline: row.purpose_deadline,
    submittedAt: row.submitted_at,
    status: row.status,
    decidedAt: row.decided_at,
    rules: { suggestion: rules.suggestion, blockers: rules.blockers, warnings: rules.checks.filter((c) => c.severity === "warning").length },
    attention: row.status === "pending" ? attention(row, rules) : null,
  };
}

export type ApplicationSummary = ReturnType<typeof summaryView>;

export interface ListFilters {
  status: Status;
  category?: Category;
  q?: string;
  view?: "all" | "overdue" | "ready" | "problems";
}

export function listApplications(f: ListFilters): ApplicationSummary[] {
  const where = ["status = ?"];
  const params: unknown[] = [f.status];
  if (f.category) where.push("category = ?"), params.push(f.category);
  if (f.q) {
    where.push("(id LIKE ? OR applicant_name LIKE ? OR applicant_name_en LIKE ? OR village LIKE ?)");
    const like = `%${f.q}%`;
    params.push(like, like, like, like);
  }
  const rows = getDb().prepare(`SELECT * FROM applications WHERE ${where.join(" AND ")}`).all(...params) as ApplicationRow[];
  let list = rows.map(summaryView);

  if (f.view === "overdue") list = list.filter((a) => a.attention && a.attention.slaDaysLeft < 0);
  if (f.view === "ready") list = list.filter((a) => a.rules.suggestion === "approve" && a.rules.warnings === 0);
  if (f.view === "problems") list = list.filter((a) => a.rules.blockers > 0);

  return f.status === "pending"
    ? list.sort((a, b) => b.attention!.score - a.attention!.score)
    : list.sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""));
}

export function stats() {
  const pending = listApplications({ status: "pending" });
  const db = getDb();
  const counts = Object.fromEntries(
    (db.prepare("SELECT status, COUNT(*) AS n FROM applications GROUP BY status").all() as Array<{ status: Status; n: number }>).map((r) => [r.status, r.n]),
  );
  const decided = db
    .prepare(
      `SELECT COUNT(*) AS total,
         SUM(CASE WHEN ai_suggestion IS NOT NULL AND
           ((ai_suggestion = 'approve' AND status = 'approved') OR (ai_suggestion = 'reject' AND status = 'rejected') OR
            (ai_suggestion = 'return' AND status = 'returned')) THEN 1 ELSE 0 END) AS agreed,
         SUM(CASE WHEN ai_suggestion IS NOT NULL THEN 1 ELSE 0 END) AS withSuggestion
       FROM applications WHERE status != 'pending' AND decided_by IS NOT NULL AND decided_at >= ?`,
    )
    .get(new Date(Date.now() - 30 * DAY).toISOString()) as { total: number; agreed: number | null; withSuggestion: number | null };
  return {
    counts: { pending: counts.pending ?? 0, returned: counts.returned ?? 0, approved: counts.approved ?? 0, rejected: counts.rejected ?? 0 },
    overdue: pending.filter((a) => a.attention!.slaDaysLeft < 0).length,
    dueSoon: pending.filter((a) => a.attention!.slaDaysLeft >= 0 && a.attention!.slaDaysLeft <= 3).length,
    ready: pending.filter((a) => a.rules.suggestion === "approve" && a.rules.warnings === 0).length,
    withProblems: pending.filter((a) => a.rules.blockers > 0).length,
    last30Days: { decided: decided.total, withAiSuggestion: decided.withSuggestion ?? 0, agreedWithAi: decided.agreed ?? 0 },
    slaDays: env.SLA_DAYS,
  };
}

export function getDetail(id: string) {
  const row = getRow(id);
  const docs = getDocuments(id);
  const rules = evaluate(row, docs);
  const events = getDb()
    .prepare(
      `SELECT e.id, e.type, e.detail, e.created_at AS createdAt, o.name AS officerName
       FROM events e LEFT JOIN officers o ON o.id = e.officer_id WHERE e.application_id = ? ORDER BY e.id`,
    )
    .all(id);
  const decidedBy = row.decided_by
    ? (getDb().prepare("SELECT name, designation FROM officers WHERE id = ?").get(row.decided_by) as { name: string; designation: string })
    : null;
  return {
    application: {
      id: row.id,
      applicantName: row.applicant_name,
      applicantNameEn: row.applicant_name_en,
      fatherName: row.father_name,
      gender: row.gender,
      dob: row.dob,
      mobileMasked: row.mobile_masked,
      aadhaarMasked: `XXXX-XXXX-${row.aadhaar_last4}`,
      village: row.village,
      district: row.district,
      category: row.category,
      caste: row.caste,
      annualIncome: row.annual_income,
      purpose: row.purpose,
      purposeDeadline: row.purpose_deadline,
      submittedAt: row.submitted_at,
      status: row.status,
      decision: row.status === "pending" ? null : {
        at: row.decided_at,
        by: decidedBy,
        reason: row.decision_reason,
        aiSuggestion: row.ai_suggestion,
        certificateNo: row.certificate_no,
      },
    },
    documents: docs,
    rules,
    attention: row.status === "pending" ? attention(row, rules) : null,
    events,
  };
}

const STATUS_FOR: Record<Decision, Status> = { approve: "approved", reject: "rejected", return: "returned" };

export interface DecisionInput {
  decision: Decision;
  reason?: string;
  /** Required to approve while a blocking rule check fails. */
  overrideRules?: boolean;
}

/** Records the officer's decision. The AI never decides; this is the only path that does. */
export function decide(officer: Officer, id: string, input: DecisionInput, aiSuggestion: Decision | null) {
  const row = getRow(id);
  if (row.status !== "pending") throw conflict("This application has already been decided.");
  const reason = input.reason?.trim() ?? "";
  if (input.decision !== "approve" && reason.length < 10) {
    throw badRequest("Request validation failed", [{ field: "reason", message: "A reason of at least 10 characters is required to reject or return." }]);
  }
  const rules = evaluate(row);
  if (input.decision === "approve" && rules.blockers > 0 && !(input.overrideRules && reason.length >= 10)) {
    throw badRequest("Request validation failed", [
      { field: "overrideRules", message: "Rule checks are failing. To approve anyway, confirm the override and record a reason." },
    ]);
  }

  const now = new Date().toISOString();
  const certificateNo = input.decision === "approve" ? `CDP/JPP/${now.slice(0, 4)}/${row.id.slice(-4)}` : null;
  const db = getDb();
  db.transaction(() => {
    db.prepare(
      `UPDATE applications SET status = ?, decided_at = ?, decided_by = ?, decision_reason = ?, ai_suggestion = ?, certificate_no = ?
       WHERE id = ?`,
    ).run(STATUS_FOR[input.decision], now, officer.id, reason || null, aiSuggestion, certificateNo, id);
    db.prepare("INSERT INTO events (application_id, officer_id, type, detail, created_at) VALUES (?, ?, ?, ?, ?)").run(
      id,
      officer.id,
      STATUS_FOR[input.decision],
      [reason, input.overrideRules && rules.blockers ? "(rule checks overridden)" : ""].filter(Boolean).join(" ") || null,
      now,
    );
  })();
  return getDetail(id);
}
