import type OpenAI from "openai";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { resetBreaker, setOpenAI } from "../src/ai/client";
import { getDb } from "../src/db/connection";
import { seedDatabase } from "../src/db/seed";
import { evaluate, getRow } from "../src/services/applications";

const app = createApp();
let parse: ReturnType<typeof vi.fn>;

beforeEach(() => {
  seedDatabase(getDb(), { reset: true });
  resetBreaker();
  parse = vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")); // AI "down" by default
  setOpenAI({ chat: { completions: { parse } } } as unknown as OpenAI);
});

async function token() {
  const res = await request(app).post("/api/auth/login").send({ email: "tehsildar@chandanpur.example.in", password: "demo1234" });
  return { Authorization: `Bearer ${res.body.token}` };
}

const bi = (s: string) => ({ hi: s, en: s });
const aiNote = (decision: "approve" | "reject" | "return") => ({
  choices: [
    {
      finish_reason: "stop",
      message: {
        refusal: null,
        parsed: {
          summary: bi("summary"),
          missing_documents: [],
          inconsistencies: [],
          suggested_decision: decision,
          reasons: [bi("reason")],
          confidence: "high",
          applicant_message: bi("message"),
          verify_before_deciding: [],
        },
      },
    },
  ],
  usage: { prompt_tokens: 900, completion_tokens: 400, prompt_tokens_details: { cached_tokens: 0 } },
});

describe("rules engine on the seed cases", () => {
  const expected: Record<string, string> = {
    "JPP-2026-0101": "approve",
    "JPP-2026-0087": "approve",
    "JPP-2026-0094": "return", // missing income certificate
    "JPP-2026-0098": "reject", // OBC creamy layer
    "JPP-2026-0090": "return", // name spelt differently on Aadhaar
    "JPP-2026-0103": "reject", // outside jurisdiction
    "JPP-2026-0089": "reject", // adverse field report
    "JPP-2026-0099": "return", // declared income ≠ certificate
    "JPP-2026-0082": "return", // DOB mismatch
    "JPP-2026-0104": "approve",
    "JPP-2026-0105": "reject", // lineage proof shows another caste
    "JPP-2026-0096": "approve",
    "JPP-2026-0106": "approve", // duplicate is flagged as a warning, not a blocker
    "JPP-2026-0092": "return", // father's name mismatch
    "JPP-2026-0079": "approve",
  };
  for (const [id, suggestion] of Object.entries(expected)) {
    it(`${id} → ${suggestion}`, () => {
      expect(evaluate(getRow(id)).suggestion).toBe(suggestion);
    });
  }

  it("flags the duplicate application", () => {
    const ids = evaluate(getRow("JPP-2026-0106")).checks.map((c) => c.id);
    expect(ids).toContain("possible_duplicate");
  });
});

describe("API", () => {
  it("requires authentication and validates login", async () => {
    expect((await request(app).get("/api/applications")).status).toBe(401);
    const bad = await request(app).post("/api/auth/login").send({ email: "nope" });
    expect(bad.status).toBe(400);
    expect(bad.body.error.details[0].field).toBe("email");
    const wrong = await request(app).post("/api/auth/login").send({ email: "tehsildar@chandanpur.example.in", password: "x" });
    expect(wrong.status).toBe(401);
  });

  it("orders the pending queue by attention, with readable reasons", async () => {
    const res = await request(app).get("/api/applications").set(await token());
    const list = res.body.data;
    expect(list).toHaveLength(15);
    const scores = list.map((a: { attention: { score: number } }) => a.attention.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(list[0].id).toBe("JPP-2026-0082"); // 21 days old, past the 15-day service deadline
    expect(list[0].attention.reasons[0].en).toMatch(/deadline passed/);
  });

  it("filters ready-to-clear files", async () => {
    const res = await request(app).get("/api/applications?view=ready").set(await token());
    expect(res.body.data.every((a: { rules: { suggestion: string } }) => a.rules.suggestion === "approve")).toBe(true);
  });

  it("falls back to a rule-based case note when the AI is down", async () => {
    const res = await request(app).get("/api/applications/JPP-2026-0098/analysis").set(await token());
    expect(res.body.data.source).toBe("template");
    expect(res.body.data.analysis.suggested_decision).toBe("reject");
    expect(res.body.data.analysis.summary.hi).toContain("अमित वर्मा");
  });

  it("uses the AI note, caches it, minimises data and flags conflicts with the rules", async () => {
    parse.mockResolvedValue(aiNote("approve"));
    const auth = await token();
    const first = await request(app).get("/api/applications/JPP-2026-0098/analysis").set(auth);
    expect(first.body.data).toMatchObject({ source: "ai", conflictsWithRules: true, rulesSuggestion: "reject" });

    const prompt = parse.mock.calls[0][0].messages[1].content as string;
    expect(prompt).toContain("Family income above the creamy-layer limit");
    expect(prompt).not.toContain("XXXXXX"); // no mobile number
    expect(parse.mock.calls[0][0].response_format.json_schema.strict).toBe(true);

    const second = await request(app).get("/api/applications/JPP-2026-0098/analysis").set(auth);
    expect(second.body.data.cached).toBe(true);
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("keeps the officer in charge of the final decision", async () => {
    const auth = await token();
    const noReason = await request(app).post("/api/applications/JPP-2026-0094/decision").set(auth).send({ decision: "return" });
    expect(noReason.status).toBe(400);

    const blocked = await request(app).post("/api/applications/JPP-2026-0098/decision").set(auth).send({ decision: "approve" });
    expect(blocked.status).toBe(400);
    expect(blocked.body.error.details[0].field).toBe("overrideRules");

    const overridden = await request(app)
      .post("/api/applications/JPP-2026-0098/decision")
      .set(auth)
      .send({ decision: "approve", overrideRules: true, reason: "नवीन आय प्रमाण पत्र भौतिक रूप से सत्यापित किया गया।" });
    expect(overridden.status).toBe(200);
    expect(overridden.body.data.application.status).toBe("approved");
  });

  it("records the decision, the AI suggestion seen, and blocks double decisions", async () => {
    parse.mockResolvedValue(aiNote("approve"));
    const auth = await token();
    await request(app).get("/api/applications/JPP-2026-0087/analysis").set(auth);
    const res = await request(app).post("/api/applications/JPP-2026-0087/decision").set(auth).send({ decision: "approve" });
    expect(res.body.data.application.decision).toMatchObject({ aiSuggestion: "approve", certificateNo: "CDP/JPP/2026/0087" });
    expect(res.body.data.events.at(-1).type).toBe("approved");

    const again = await request(app).post("/api/applications/JPP-2026-0087/decision").set(auth).send({ decision: "reject", reason: "duplicate attempt here" });
    expect(again.status).toBe(409);

    // Reopening a decided file shows the saved note and never calls the AI again.
    const reopened = await request(app).post("/api/applications/JPP-2026-0087/analysis").set(auth);
    expect(reopened.body.data.cached).toBe(true);
    expect(parse).toHaveBeenCalledTimes(1);
    const neverAnalysed = await request(app).get("/api/applications/JPP-2026-0071/analysis").set(auth);
    expect(neverAnalysed.body.data).toBeNull();

    const stats = await request(app).get("/api/stats").set(auth);
    expect(stats.body.data.last30Days).toMatchObject({ agreedWithAi: 1, withAiSuggestion: 1 });
    expect(stats.body.data.counts.pending).toBe(14);
  });

  it("rejects malformed ids", async () => {
    const res = await request(app).get("/api/applications/abc").set(await token());
    expect(res.status).toBe(400);
  });
});
