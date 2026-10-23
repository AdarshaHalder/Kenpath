# जाति प्रमाण पत्र · अधिकारी कंसोल
### Caste Certificate Officer Console (Hindi-first, AI-assisted)

> **हिन्दी सारांश:** यह तहसील कार्यालय के अधिकारियों (तहसीलदार / नायब तहसीलदार) के लिए एक हिन्दी वेब एप्लिकेशन है, जो जाति प्रमाण पत्र के लंबित आवेदनों को निपटाने में मदद करता है। डैशबोर्ड बताता है कि पहले किस आवेदन पर ध्यान देना है। हर आवेदन पर नियम-आधारित जाँच और AI सहायक की टिप्पणी (सारांश, अनुपलब्ध दस्तावेज़, विसंगतियाँ, सुझाया गया निर्णय व कारण) मिलती है। **अंतिम निर्णय (स्वीकृत / सुधार हेतु लौटाएँ / अस्वीकृत) हमेशा अधिकारी का होता है।** सभी आँकड़े काल्पनिक हैं।

**Live demo:** _add your Render URL here_
**Login:** `tehsildar@chandanpur.example.in` / `demo1234` (तहसीलदार), or `naib@chandanpur.example.in` / `demo1234` (नायब तहसीलदार). The login page has a one-click button to fill in the demo account.

The UI is in **Hindi by default**, with an **English toggle** in the top bar.

---

## 1. The problem

A **caste certificate (जाति प्रमाण पत्र)** is needed for reservation in school and college admissions, scholarships, government job applications, and welfare schemes. Applicants (SC, ST and OBC) apply online at a CSC or e-District portal. The file then goes to the **Tehsildar's office**, where an officer must:

- check that all the documents are attached: Aadhaar, residence proof, the father's caste certificate or family register, a self-declaration, a photo, the **Lekhpal's field verification report**, and for OBC an income certificate;
- check that the name, father's name and date of birth match across documents;
- check eligibility: the caste is on the notified list for the category, the applicant lives in the district, and OBC family income is below the creamy-layer limit (₹8 lakh);
- decide within the **service-guarantee period** (taken here as 15 days; configurable).

Today this means opening scanned PDFs one by one, comparing fields by eye, and working through a list sorted only by date.

**What goes wrong:**
- Urgent files get buried: a student whose scholarship form closes in 2 days waits behind routine cases.
- Service deadlines are missed.
- Small mismatches (a missing anusvara in "सिंह", a swapped day/month in a date of birth) are either missed or cause a rejection when a simple correction would do.
- Rejection and return notes are inconsistent, so applicants don't know what to fix.

**Who it affects:**
- **Officers** (Tehsildar / Naib Tehsildar) carrying a large daily backlog.
- **Applicants**, often students and first-generation job seekers, for whom a late or wrongly rejected certificate means a missed admission, scholarship or job.

## 2. What the app does

| Officer need | How the app answers it |
|---|---|
| **What needs attention first?** | The pending queue is ordered by a **transparent attention score**: past the service deadline, deadline within 3 days, the applicant's own deadline (exam, admission, job form) within 7 days, and "all checks pass, quick to clear". Every point shows up as a readable reason chip, e.g. "सेवा अवधि 6 दिन पार" or "आवेदक की अंतिम तिथि 2 दिन में". Tiles filter to *past deadline*, *ready to clear* and *with problems*. |
| **Is the file complete and consistent?** | A **rules engine** checks required documents, name / father's name / DOB consistency, jurisdiction, the notified caste list, lineage proof, the OBC creamy layer, declared vs. certified income, the Lekhpal recommendation, and possible duplicate applications. Each check is ✓ / ! / ✖ with the exact mismatch shown, e.g. Application "2000-12-01" vs. Aadhaar "2000-01-12". |
| **AI assistance** | An **AI case note** in Hindi and English: a summary, missing documents, inconsistencies, a **suggested decision with reasons** and a confidence level, things to verify personally, and a **draft message to the applicant**. |
| **The officer decides** | Three actions: **स्वीकृत करें / सुधार हेतु लौटाएँ / अस्वीकृत करें** (approve / return for correction / reject). Return and reject require a reason, pre-filled from the AI's draft message and editable. Approving while a rule check fails needs an explicit override plus a written reason. The decision, the officer and the AI suggestion they saw are recorded in an audit trail. Approval issues a certificate number. |
| **Accountability** | A "Decided" view, a per-file history, and an "agreed with AI" rate over the last 30 days, which helps judge whether the AI is helping. |

### Demo data (all fictional)

The data covers 17 made-up applications for the fictional district **चंदनपुर** (Chandanpur). Each pending case exercises a real situation:

| Case | What the officer should see |
|---|---|
| Clean files (e.g. सुनील कुमार, गीता खरवार) | All checks pass; suggested **approve**; marked "quick to clear" |
| पूजा यादव | OBC without an income certificate → **return** |
| राहुल सिंह | Aadhaar spells the name "राहुल सिह" → **return** for correction, not rejection |
| विकास कोरी | DOB day and month swapped on Aadhaar → **return**; also 21 days old, so it tops the queue |
| अंजलि मौर्य | Declared income ₹3 lakh vs. certificate ₹6.1 lakh → **return** |
| सुरेश प्रजापति | Father's name differs on the self-declaration → **return** |
| अमित वर्मा | OBC income ₹11.5 lakh, above the creamy layer → **reject** |
| सीमा देवी | Residence proof from another district → **reject** (outside jurisdiction) |
| मोहन लाल | Lekhpal report does not recommend → **reject** |
| दीपक थारू | Claims ST (थारू) but the father's certificate says कुर्मी (OBC) → **reject** |
| रीना कुमारी ×2 | Same person applied twice → **duplicate** warning |
| प्रिया निषाद | Clean, but her job-form deadline is in 2 days → pushed up the queue |

Names, villages, the district, ID numbers and masked mobile numbers are invented. **No real citizen data is used.**

## 3. Technical decisions

```
client/  React 18 + Vite + TypeScript (SPA, Hindi-first i18n)
server/  Express 4 + TypeScript, SQLite (better-sqlite3), Zod, OpenAI SDK
  src/rules/       deterministic eligibility & document checks (source of truth)
  src/services/    queue ordering, file detail, decisions, stats
  src/ai/          OpenAI client (circuit breaker, usage log), prompt, analyst, rule-based fallback
  src/db/          schema, fictional seed data
  src/routes/      thin REST layer with Zod validation
```

**1. Rules first, AI second.** Eligibility rules (notified caste list, jurisdiction, creamy layer, required documents) are law, not judgement, so they are **deterministic code**, not prompts. The AI receives the rule results as authoritative input and does what it is good at: summarising, spotting things the rules don't cover, explaining in plain Hindi, and drafting the applicant message. If the AI ever suggests "approve" while a blocking rule fails, the server flags the conflict and the UI shows a red warning.

**2. The officer always makes the final call.**
- The AI never writes to the application. Only the decision endpoint does, and only with an officer's login.
- Return and reject require a written reason.
- Approving against failing rules requires an explicit override plus a reason.
- The audit trail records the AI suggestion the officer saw, so you can measure where officers agree or disagree.

**3. "What first?" is explainable.** The attention score is a few readable rules, not a model. Each contribution is shown to the officer, so the ordering can be trusted and challenged.

**4. AI design (OpenAI `gpt-4o-mini`).**
- **Structured output:** strict JSON schema via `zodResponseFormat`. Every field comes back in both Hindi and English, so the UI never parses free text, and the language toggle works for AI content too.
- **Grounded prompt:** a static system prompt holds the process rules and notified lists (a stable prefix, so it can be cached). Applicant data is wrapped in tags and marked as data, to resist prompt injection through form fields.
- **Data minimisation:** the model never sees the mobile number or Aadhaar digits.
- **Cost:** each analysis is cached per application, keyed by a hash of all its inputs. Reopening a file is free; any change to the file produces a fresh note. Decided files never trigger new AI calls. Every call's tokens and latency are logged to `ai_usage`.
- **Graceful degradation:** the SDK retries twice, and a circuit breaker stops calling for 60 s after 3 consecutive failures. If the AI is off, down or rate-limited, a **rule-based case note** is generated instead (same structure, labelled as such), so officers can keep working during an outage.
- **Why `gpt-4o-mini`:** cheap enough to run on every file, supports strict structured output, and writes good formal Hindi. Because the rules engine supplies the hard facts, a small model is sufficient. You can change the model with `AI_MODEL`.

**5. Hindi-first design.**
- All UI copy is written in Hindi as used in tehsil offices (लंबित, स्वीकृत, सेवा अवधि, लेखपाल जाँच रिपोर्ट), not machine-translated.
- Noto Sans Devanagari with generous line height for legibility.
- Dates in Hindi month names with Latin digits, as on most government forms.
- English is a toggle, for officers or reviewers who prefer it.

**6. Simple to run and deploy.**
- SQLite with a PostgreSQL-portable schema.
- One Docker image: Express serves the API and the built React app.
- The database seeds itself on first start.

## 4. Run locally

Requirements: Node.js 20+.

```bash
npm run install:all
cp server/.env.example server/.env    # optional: add OPENAI_API_KEY
npm run dev:server                    # API on http://localhost:4000 (seeds on first run)
npm run dev:client                    # UI  on http://localhost:5173
```

Single process, as in production: `npm run build && npm start`, then open http://localhost:4000.

| Command | Purpose |
|---|---|
| `npm test` | 24 tests: every seed case through the rules engine, plus API tests with a fake OpenAI client (auth, queue order, AI note + cache + conflict flag, fallback, decision rules, audit) |
| `npm run seed` | Reset the database to the sample data |
| `AI_DISABLED=true npm run dev:server` | Simulate an AI outage |

Without an `OPENAI_API_KEY`, everything works using rule-based case notes.

**Deploy (Render):** New → **Web Service** → this repo → runtime **Docker** → set `JWT_SECRET` (any long random string) and `OPENAI_API_KEY` → Health check path `/api/health`. Alternatively, use the included `render.yaml` Blueprint.

## 5. API

All routes except login and health require `Authorization: Bearer <token>`. Errors use the shape `{ "error": { "code", "message", "details?" } }`.

| Method & path | Description |
|---|---|
| `POST /api/auth/login` | `{ email, password }` → `{ token, officer }` |
| `GET /api/auth/me` | Current officer |
| `GET /api/stats` | Counts, overdue, due soon, ready, with problems, AI agreement (30 days), AI status |
| `GET /api/applications?status=pending&view=all\|overdue\|ready\|problems&category=&q=` | Queue (pending: ordered by attention score) |
| `GET /api/applications/:id` | Full file: applicant, documents, rule checks, attention, history, decision |
| `GET /api/applications/:id/analysis` | AI case note (cached; rule-based if AI is unavailable) |
| `POST /api/applications/:id/analysis` | Regenerate the case note (pending files only) |
| `POST /api/applications/:id/decision` | `{ decision: "approve"\|"return"\|"reject", reason?, overrideRules? }`. The officer's final call. `409` if already decided. |
| `GET /api/health` | Liveness + AI status |

## 6. Limitations & next steps

- **Document reading is simulated.** Each document's fields are part of the made-up data. In production they would come from DigiLocker or OCR on the uploaded scans (with the officer able to view the original), and the AI could also read the images.
- **Applicant side not built.** A "returned" file waits for resubmission. Next steps: an SMS/WhatsApp notice in Hindi with the officer's note, and a resubmission flow.
- **Single office, single role.** No Lekhpal workflow, no escalation to the SDM, no appeals. Next steps: roles, assignment and reassignment, and a supervisor dashboard showing deadline compliance.
- **Free hosting:** on Render's free plan, decisions reset when the service restarts, and the sample data re-seeds automatically.
- **AI evaluation:** the tests mock the model. Next steps: a labelled set of cases (including adversarial ones) to measure suggestion accuracy and Hindi quality before changing prompts or models.
- **Security for real use:** SSO / Jan Parichay login, rate limiting, PII encryption at rest, and data residency in India.
