import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../api";
import { BandBadge, ErrorBanner, Spinner, StatusBadge, SuggestionBadge } from "../components/ui";
import { CONFIDENCE_LABEL, DECISION_LABEL, STATUS_LABEL, fmtDate, fmtMoney, useLang } from "../i18n";
import type { AnalysisResult, ApplicationDetail, Check, Decision, DocFields } from "../types";
import { useAsync } from "../useAsync";

export function ApplicationPage() {
  const id = useParams().id!;
  const { t } = useLang();
  const detail = useAsync(() => api<{ data: ApplicationDetail }>(`/applications/${id}`).then((r) => r.data), [id]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);

  async function loadAnalysis(regenerate = false) {
    setAnalysing(true);
    setAnalysisError(null);
    try {
      const r = await api<{ data: AnalysisResult | null }>(`/applications/${id}/analysis`, { method: regenerate ? "POST" : "GET" });
      setAnalysis(r.data);
    } catch (e) {
      setAnalysisError((e as Error).message);
    } finally {
      setAnalysing(false);
    }
  }

  useEffect(() => {
    setAnalysis(null);
    void loadAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (detail.loading) return <Spinner />;
  if (detail.error || !detail.data) return <ErrorBanner error={detail.error} />;
  const d = detail.data;

  return (
    <div className="page wide">
      <Link to={d.application.status === "pending" ? "/" : "/decided"} className="back">{t("back")}</Link>
      <div className="workspace">
        <div className="col">
          <ApplicantCard d={d} />
          <ChecksCard checks={d.rules.checks} />
          <DocumentsCard documents={d.documents} />
          <HistoryCard events={d.events} />
        </div>
        <div className="col col-side">
          {(analysis || analysing || analysisError || d.application.status === "pending") && (
            <AnalysisCard result={analysis} loading={analysing} error={analysisError}
              onRegenerate={d.application.status === "pending" ? () => loadAnalysis(true) : undefined} />
          )}
          {d.application.status === "pending" ? (
            <DecisionCard detail={d} analysis={analysis} onDecided={(nd) => detail.setData(nd)} />
          ) : (
            <DecisionRecord d={d} />
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="kv">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ApplicantCard({ d }: { d: ApplicationDetail }) {
  const { t, pick, lang } = useLang();
  const a = d.application;
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h1 className="h2">{lang === "hi" ? a.applicantName : a.applicantNameEn}</h1>
          <div className="muted small">{a.id} · {a.aadhaarMasked} · {a.mobileMasked}</div>
        </div>
        <div className="row">
          {d.attention && <BandBadge band={d.attention.band} />}
          <StatusBadge status={a.status} />
        </div>
      </div>
      {d.attention && d.attention.reasons.length > 0 && (
        <div className="chips">{d.attention.reasons.map((r, i) => <span key={i} className="chip">{pick(r)}</span>)}</div>
      )}
      <dl className="kv-grid">
        <Row label={t("father")}>{a.fatherName}</Row>
        <Row label={t("dob")}>{fmtDate(a.dob, lang)}</Row>
        <Row label={t("address")}>{a.village}, {a.district}</Row>
        <Row label={t("categoryCaste")}>{a.category} · {a.caste}</Row>
        {a.category === "OBC" && <Row label={t("income")}>{fmtMoney(a.annualIncome)}</Row>}
        <Row label={t("purpose")}>{a.purpose}</Row>
        {a.purposeDeadline && <Row label={t("applicantDeadline")}>{fmtDate(a.purposeDeadline, lang)}</Row>}
        <Row label={t("submitted")}>{fmtDate(a.submittedAt, lang)}</Row>
        {d.attention && (
          <Row label={t("serviceDeadline")}>
            <span className={d.attention.slaDaysLeft < 0 ? "text-danger" : ""}>{fmtDate(d.attention.slaDueAt, lang)}</span>
          </Row>
        )}
      </dl>
    </section>
  );
}

const SEVERITY_ICON = { blocker: "✖", warning: "!", ok: "✓" };

function ChecksCard({ checks }: { checks: Check[] }) {
  const { t, pick } = useLang();
  const sorted = [...checks].sort((a, b) => ["blocker", "warning", "ok"].indexOf(a.severity) - ["blocker", "warning", "ok"].indexOf(b.severity));
  return (
    <section className="card">
      <h2 className="h3">{t("checks")}</h2>
      <p className="muted small">{t("checksNote")}</p>
      <ul className="checks">
        {sorted.map((c) => (
          <li key={c.id} className={`check check-${c.severity}`}>
            <span className="check-icon" aria-hidden>{SEVERITY_ICON[c.severity]}</span>
            <div>
              <div className="check-title">{pick(c.title)}</div>
              <div className="muted small">{pick(c.detail)}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const FIELD_LABEL: Record<keyof DocFields, { hi: string; en: string }> = {
  name: { hi: "नाम", en: "Name" },
  father_name: { hi: "पिता", en: "Father" },
  dob: { hi: "जन्म तिथि", en: "DOB" },
  district: { hi: "जिला", en: "District" },
  caste: { hi: "जाति", en: "Caste" },
  category: { hi: "वर्ग", en: "Category" },
  annual_income: { hi: "आय", en: "Income" },
  recommendation: { hi: "संस्तुति", en: "Recommendation" },
  remarks: { hi: "टिप्पणी", en: "Remarks" },
};

function DocumentsCard({ documents }: { documents: ApplicationDetail["documents"] }) {
  const { t, pick, lang } = useLang();
  const show = (k: keyof DocFields, v: unknown) =>
    k === "annual_income" ? fmtMoney(v as number) : k === "recommendation" ? (v === "recommended" ? (lang === "hi" ? "संस्तुत" : "Recommended") : lang === "hi" ? "संस्तुत नहीं" : "Not recommended") : String(v);
  return (
    <section className="card">
      <h2 className="h3">{t("documents")} ({documents.length})</h2>
      <div className="docs">
        {documents.map((doc) => (
          <div key={doc.type} className="doc">
            <div className="doc-title">📄 {pick(doc.label)}</div>
            <dl className="doc-fields">
              {(Object.entries(doc.fields) as Array<[keyof DocFields, unknown]>).map(([k, v]) => (
                <div key={k}><dt>{pick(FIELD_LABEL[k])}</dt><dd>{show(k, v)}</dd></div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

function HistoryCard({ events }: { events: ApplicationDetail["events"] }) {
  const { t, pick, lang } = useLang();
  return (
    <section className="card">
      <h2 className="h3">{t("history")}</h2>
      <ul className="timeline">
        {events.map((e) => (
          <li key={e.id}>
            <b>{pick(STATUS_LABEL[e.type] ?? { hi: e.type, en: e.type })}</b> · {fmtDate(e.createdAt, lang)}
            {e.officerName && <span className="muted"> · {e.officerName}</span>}
            {e.detail && <div className="muted small">{e.detail}</div>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function AnalysisCard({ result, loading, error, onRegenerate }: { result: AnalysisResult | null; loading: boolean; error: string | null; onRegenerate?: () => void }) {
  const { t, pick } = useLang();
  const a = result?.analysis;
  return (
    <section className="card ai-card">
      <div className="card-head">
        <h2 className="h3">✨ {result?.source === "template" ? t("aiTemplate") : t("aiNote")}</h2>
        {onRegenerate && <button className="btn btn-ghost btn-sm" onClick={onRegenerate} disabled={loading}>{t("regenerate")}</button>}
      </div>
      {loading && !a && <Spinner label={t("preparing")} />}
      {error && <ErrorBanner error={error} />}
      {a && (
        <div className={`ai-body ${loading ? "faded" : ""}`}>
          {result!.conflictsWithRules && <div className="alert alert-error">{t("conflict")}</div>}
          <div className="suggestion-row">
            <span className="muted small">{t("suggestion")}</span>
            <SuggestionBadge decision={a.suggested_decision} />
            <span className="muted small">{t("confidence")}: {pick(CONFIDENCE_LABEL[a.confidence])}</span>
          </div>
          <h3 className="h4">{t("summary")}</h3>
          <p>{pick(a.summary)}</p>
          {a.reasons.length > 0 && (<><h3 className="h4">{t("reasons")}</h3><ul>{a.reasons.map((r, i) => <li key={i}>{pick(r)}</li>)}</ul></>)}
          {a.missing_documents.length > 0 && (<><h3 className="h4">{t("missingDocs")}</h3><ul>{a.missing_documents.map((r, i) => <li key={i}>{pick(r)}</li>)}</ul></>)}
          {a.inconsistencies.length > 0 && (
            <>
              <h3 className="h4">{t("inconsistencies")}</h3>
              <ul>{a.inconsistencies.map((r, i) => <li key={i} className={`sev-${r.severity}`}>{pick(r)}</li>)}</ul>
            </>
          )}
          {a.verify_before_deciding.length > 0 && (<><h3 className="h4">{t("verify")}</h3><ul>{a.verify_before_deciding.map((r, i) => <li key={i}>{pick(r)}</li>)}</ul></>)}
          <p className="muted small disclaimer">{t("aiDisclaimer")}</p>
        </div>
      )}
    </section>
  );
}

function DecisionCard({ detail, analysis, onDecided }: { detail: ApplicationDetail; analysis: AnalysisResult | null; onDecided: (d: ApplicationDetail) => void }) {
  const { t, pick, lang } = useLang();
  const [choice, setChoice] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [override, setOverride] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const blockers = detail.rules.blockers;

  function choose(d: Decision) {
    setChoice(d);
    setError(null);
    setOverride(false);
    // Pre-fill the applicant-facing note from the AI draft for return/reject; the officer edits it.
    setReason(d !== "approve" && analysis && analysis.analysis.suggested_decision === d ? pick(analysis.analysis.applicant_message) : "");
  }

  async function submit() {
    if (!choice) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ data: ApplicationDetail }>(`/applications/${detail.application.id}/decision`, {
        method: "POST",
        json: { decision: choice, reason: reason.trim() || undefined, overrideRules: override || undefined },
      });
      onDecided(r.data);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  const fieldErr = error instanceof ApiError ? error.field("reason") ?? error.field("overrideRules") : undefined;
  const needsReason = choice === "return" || choice === "reject" || (choice === "approve" && override);

  return (
    <section className="card decision-card">
      <h2 className="h3">{t("yourDecision")}</h2>
      <div className="decision-buttons">
        {(["approve", "return", "reject"] as const).map((d) => (
          <button key={d} className={`btn decision-${d} ${choice === d ? "selected" : ""}`} onClick={() => choose(d)}>
            {pick(DECISION_LABEL[d])}
            {analysis?.analysis.suggested_decision === d && <span className="ai-mark">AI</span>}
          </button>
        ))}
      </div>
      {choice && (
        <div className="decision-form">
          {choice === "approve" && blockers > 0 && (
            <label className="override">
              <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} /> {t("override")}
            </label>
          )}
          <label className="field">
            <span>{t("reason")} {!needsReason && <span className="muted">({t("reasonOptional")})</span>}</span>
            <textarea rows={choice === "approve" ? 2 : 6} value={reason} onChange={(e) => setReason(e.target.value)} />
            {choice !== "approve" && <small className="muted">{t("reasonHelpReturn")}</small>}
          </label>
          {choice !== "approve" && analysis && !reason && (
            <button className="link" onClick={() => setReason(pick(analysis.analysis.applicant_message))}>{t("useDraft")}</button>
          )}
          {fieldErr && <div className="alert alert-error">{lang === "hi" ? (choice === "approve" ? "नियम-आधारित आपत्ति है: स्वीकृति हेतु ओवरराइड चुनें और कारण लिखें।" : "कृपया कम से कम 10 अक्षरों का कारण लिखें।") : fieldErr}</div>}
          {error && !fieldErr && <ErrorBanner error={error} />}
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => setChoice(null)}>{t("cancel")}</button>
            <button className={`btn btn-primary decision-confirm-${choice}`} disabled={busy} onClick={submit}>
              {t("confirm")}: {pick(DECISION_LABEL[choice])}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function DecisionRecord({ d }: { d: ApplicationDetail }) {
  const { t, pick, lang } = useLang();
  const dec = d.application.decision!;
  return (
    <section className={`card decision-record record-${d.application.status}`}>
      <h2 className="h3">{pick(STATUS_LABEL[d.application.status])} · {fmtDate(dec.at, lang)}</h2>
      <dl className="kv-grid one">
        {dec.by && <Row label={t("decidedBy")}>{dec.by.name} ({dec.by.designation})</Row>}
        {dec.certificateNo && <Row label={t("certificateNo")}>{dec.certificateNo}</Row>}
        {dec.reason && <Row label={t("reason")}>{dec.reason}</Row>}
        {dec.aiSuggestion && <Row label={t("aiSuggested")}><SuggestionBadge decision={dec.aiSuggestion} /></Row>}
      </dl>
    </section>
  );
}
