import crypto from "crypto";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { env } from "../config/env";
import { getDb } from "../db/connection";
import { DECISIONS } from "../lib/domain";
import { attention, evaluate, getDocuments, getRow, type ApplicationRow, type DocumentView } from "../services/applications";
import type { RuleResult } from "../rules/engine";
import { isAiAvailable, trackedCall } from "./client";
import { templateAnalysis } from "./fallback";
import { ANALYST_SYSTEM } from "./prompts";

/**
 * AI case note for one application: summary, missing documents, inconsistencies and a
 * suggested decision with reasons — in Hindi and English.
 *
 * Design:
 *  - Structured output (strict JSON schema) so the UI never parses free text.
 *  - The rules engine runs first; its results are given to the model as authoritative, and a
 *    server-side guard flags any AI suggestion that contradicts a failing rule.
 *  - Data minimisation: the model never sees the mobile number or Aadhaar digits.
 *  - Cached per application, keyed by a hash of every input. Reopening a file is free; any
 *    change to the file produces a fresh analysis.
 */

const Bilingual = z.object({ hi: z.string(), en: z.string() });

const AnalysisSchema = z.object({
  summary: Bilingual,
  missing_documents: z.array(Bilingual),
  inconsistencies: z.array(Bilingual.extend({ severity: z.enum(["high", "medium", "low"]) })),
  suggested_decision: z.enum(DECISIONS),
  reasons: z.array(Bilingual),
  confidence: z.enum(["high", "medium", "low"]),
  applicant_message: Bilingual,
  verify_before_deciding: z.array(Bilingual),
});

export type Analysis = z.infer<typeof AnalysisSchema>;

export interface AnalysisResult {
  analysis: Analysis;
  source: "ai" | "template";
  generatedAt: string;
  cached: boolean;
  /** True when the AI suggests approving a file that fails a blocking rule. */
  conflictsWithRules: boolean;
  rulesSuggestion: RuleResult["suggestion"];
}

function buildInput(row: ApplicationRow, docs: DocumentView[], rules: RuleResult, daysPending: number): string {
  const docLines = docs.map((d) => `- ${d.label.en} (${d.type}): ${JSON.stringify(d.fields)}`).join("\n");
  const checkLines = rules.checks
    .map((c) => `- [${c.severity.toUpperCase()}${c.severity === "ok" ? "" : `, ${c.kind}`}] ${c.title.en}: ${c.detail.en}`)
    .join("\n");
  return `<application>
ID: ${row.id}
Applicant: ${row.applicant_name} (${row.applicant_name_en}), gender ${row.gender}, DOB ${row.dob}
Father: ${row.father_name}
Address: village ${row.village}, district ${row.district}
Claimed: ${row.category} — ${row.caste}${row.annual_income !== null ? `; declared family income ₹${row.annual_income.toLocaleString("en-IN")}` : ""}
Purpose: ${row.purpose}${row.purpose_deadline ? ` (applicant's deadline ${row.purpose_deadline})` : ""}
Submitted ${row.submitted_at.slice(0, 10)}; pending ${daysPending} day(s); service deadline ${env.SLA_DAYS} days.
</application>

<documents>
${docLines || "- none"}
</documents>

<rule_checks suggestion="${rules.suggestion}">
${checkLines}
</rule_checks>

Prepare the case note.`;
}

const inFlight = new Map<string, Promise<AnalysisResult>>();

export async function getAnalysis(id: string, { regenerate = false } = {}): Promise<AnalysisResult | null> {
  const row = getRow(id);
  const docs = getDocuments(id);
  const rules = evaluate(row, docs);
  const daysPending = attention(row, rules).daysPending;
  const input = buildInput(row, docs, rules, daysPending);
  const hash = crypto.createHash("sha256").update(env.AI_MODEL).update(input).digest("hex");
  const finish = (analysis: Analysis, source: "ai" | "template", generatedAt: string, cached: boolean): AnalysisResult => ({
    analysis,
    source,
    generatedAt,
    cached,
    conflictsWithRules: analysis.suggested_decision === "approve" && rules.blockers > 0,
    rulesSuggestion: rules.suggestion,
  });

  const cachedRow = getDb().prepare("SELECT * FROM ai_analyses WHERE application_id = ?").get(id) as
    | { input_hash: string; source: "ai" | "template"; payload: string; created_at: string }
    | undefined;
  // A decided file is a record: show the note the officer saw, never pay for a new one.
  if (row.status !== "pending") {
    return cachedRow ? finish(JSON.parse(cachedRow.payload), cachedRow.source, cachedRow.created_at, true) : null;
  }
  // Reuse a cached AI note while inputs are unchanged; retry a template note once AI is back.
  if (!regenerate && cachedRow?.input_hash === hash && (cachedRow.source === "ai" || !isAiAvailable())) {
    return finish(JSON.parse(cachedRow.payload), cachedRow.source, cachedRow.created_at, true);
  }

  const running = inFlight.get(id);
  if (running) return running;

  const p = (async () => {
    let analysis: Analysis;
    let source: "ai" | "template" = "ai";
    try {
      if (!isAiAvailable()) throw new Error("AI not configured or temporarily unavailable");
      const res = await trackedCall(id, (c) =>
        c.chat.completions.parse({
          model: env.AI_MODEL,
          temperature: 0.2,
          max_completion_tokens: 1800,
          response_format: zodResponseFormat(AnalysisSchema, "case_note"),
          messages: [
            { role: "system", content: ANALYST_SYSTEM },
            { role: "user", content: input },
          ],
        }),
      );
      const parsed = res.choices[0]?.message.parsed;
      if (!parsed) throw new Error("Unparseable analysis");
      analysis = parsed;
    } catch (err) {
      console.warn(`[ai] analysis for ${id} fell back to template: ${(err as Error).message}`);
      analysis = templateAnalysis(row, rules, daysPending);
      source = "template";
    }
    const generatedAt = new Date().toISOString();
    getDb()
      .prepare(
        `INSERT INTO ai_analyses (application_id, input_hash, source, payload, created_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(application_id) DO UPDATE SET input_hash = excluded.input_hash, source = excluded.source,
           payload = excluded.payload, created_at = excluded.created_at`,
      )
      .run(id, hash, source, JSON.stringify(analysis), generatedAt);
    return finish(analysis, source, generatedAt, false);
  })().finally(() => inFlight.delete(id));
  inFlight.set(id, p);
  return p;
}

/** The suggestion the officer saw, recorded alongside their decision. */
export function lastSuggestion(id: string) {
  const row = getDb().prepare("SELECT payload FROM ai_analyses WHERE application_id = ?").get(id) as { payload: string } | undefined;
  return row ? (JSON.parse(row.payload) as Analysis).suggested_decision : null;
}
