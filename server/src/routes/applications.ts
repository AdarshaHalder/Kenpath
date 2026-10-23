import { Router } from "express";
import { z } from "zod";
import { getAnalysis, lastSuggestion } from "../ai/analyst";
import { aiStatus } from "../ai/client";
import { CATEGORIES, DECISIONS, STATUSES } from "../lib/domain";
import { authenticate, currentOfficer } from "../middleware/auth";
import { asyncHandler, validate } from "../middleware/validate";
import * as apps from "../services/applications";

const router = Router();
router.use(authenticate);

const IdParams = z.object({ id: z.string().regex(/^JPP-\d{4}-\d{4}$/, "Invalid application id") });
const idOf = (res: { locals: Record<string, unknown> }) => (res.locals.params as { id: string }).id;

/** GET /api/stats — dashboard counters and AI status. */
router.get("/stats", (_req, res) => {
  res.json({ data: { ...apps.stats(), ai: aiStatus() } });
});

const ListQuery = z.object({
  status: z.enum(STATUSES).default("pending"),
  category: z.enum(CATEGORIES).optional(),
  view: z.enum(["all", "overdue", "ready", "problems"]).default("all"),
  q: z.string().trim().max(60).optional(),
});

/** GET /api/applications — pending ones are ordered by attention score (most urgent first). */
router.get("/applications", validate(ListQuery, "query"), (_req, res) => {
  res.json({ data: apps.listApplications(res.locals.query) });
});

/** GET /api/applications/:id — full file: applicant, documents, rule checks, attention, history. */
router.get("/applications/:id", validate(IdParams, "params"), (_req, res) => {
  res.json({ data: apps.getDetail(idOf(res)) });
});

/** GET /api/applications/:id/analysis — AI case note (cached while the file is unchanged). */
router.get(
  "/applications/:id/analysis",
  validate(IdParams, "params"),
  asyncHandler(async (_req, res) => {
    res.json({ data: await getAnalysis(idOf(res)) });
  }),
);

/** POST /api/applications/:id/analysis — force a fresh AI case note. */
router.post(
  "/applications/:id/analysis",
  validate(IdParams, "params"),
  asyncHandler(async (_req, res) => {
    res.json({ data: await getAnalysis(idOf(res), { regenerate: true }) });
  }),
);

const DecisionBody = z.object({
  decision: z.enum(DECISIONS),
  reason: z.string().trim().max(2000).optional(),
  overrideRules: z.boolean().optional(),
});

/** POST /api/applications/:id/decision — the officer's final call (approve / reject / return). */
router.post("/applications/:id/decision", validate(IdParams, "params"), validate(DecisionBody), (req, res) => {
  const id = idOf(res);
  res.json({ data: apps.decide(currentOfficer(req), id, res.locals.body, lastSuggestion(id)) });
});

export default router;
