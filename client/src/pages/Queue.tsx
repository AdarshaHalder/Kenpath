import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { BandBadge, Empty, ErrorBanner, Spinner, SuggestionBadge } from "../components/ui";
import { fmtDate, useLang } from "../i18n";
import type { ApplicationSummary, Stats } from "../types";
import { useAsync } from "../useAsync";

type View = "all" | "overdue" | "ready" | "problems";

export function QueuePage() {
  const { t, pick, lang } = useLang();
  const [view, setView] = useState<View>("all");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const query = useMemo(() => {
    const p = new URLSearchParams({ status: "pending", view });
    if (q.trim()) p.set("q", q.trim());
    if (category) p.set("category", category);
    return p.toString();
  }, [view, q, category]);

  const stats = useAsync(() => api<{ data: Stats }>("/stats").then((r) => r.data), []);
  const list = useAsync(() => api<{ data: ApplicationSummary[] }>(`/applications?${query}`).then((r) => r.data), [query]);
  const s = stats.data;

  const tiles: Array<{ view: View; label: string; value: number | undefined; tone?: string }> = [
    { view: "all", label: t("statPending"), value: s?.counts.pending },
    { view: "overdue", label: t("statOverdue"), value: s?.overdue, tone: s?.overdue ? "danger" : undefined },
    { view: "ready", label: t("statReady"), value: s?.ready, tone: "good" },
    { view: "problems", label: t("statProblems"), value: s?.withProblems, tone: "warn" },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t("pendingQueue")}</h1>
          <p className="muted">{t("orderNote")}</p>
        </div>
        {s && (
          <div className="head-meta">
            <span className={`ai-pill ${s.ai.configured && !s.ai.circuitOpen ? "ok" : "warn"}`}>
              {s.ai.configured && !s.ai.circuitOpen ? `AI: ${s.ai.model}` : lang === "hi" ? "AI बंद: नियम-आधारित टिप्पणी" : "AI off: rule-based notes"}
            </span>
            {s.last30Days.withAiSuggestion > 0 && (
              <span className="muted small">{t("agreement")}: {s.last30Days.agreedWithAi}/{s.last30Days.withAiSuggestion}</span>
            )}
          </div>
        )}
      </div>

      <div className="tiles">
        {tiles.map((tile) => (
          <button key={tile.view} className={`tile ${tile.tone ? `tile-${tile.tone}` : ""} ${view === tile.view ? "active" : ""}`} onClick={() => setView(tile.view)}>
            <span className="tile-label">{tile.label}</span>
            <span className="tile-value">{tile.value ?? "–"}</span>
          </button>
        ))}
        {s && (
          <div className="tile tile-static">
            <span className="tile-label">{t("statDueSoon")}</span>
            <span className="tile-value">{s.dueSoon}</span>
          </div>
        )}
      </div>

      <div className="filters">
        <input className="search" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="category">
          <option value="">{t("allCategories")}</option>
          <option>SC</option><option>ST</option><option>OBC</option>
        </select>
      </div>

      {list.loading ? <Spinner /> : list.error ? <ErrorBanner error={list.error} /> : list.data!.length === 0 ? (
        <Empty>{t("nothingHere")}</Empty>
      ) : (
        <ol className="queue">
          {list.data!.map((a, i) => (
            <li key={a.id}>
              <Link to={`/applications/${a.id}`} className={`queue-item band-edge-${a.attention!.band}`}>
                <div className="queue-rank">{i + 1}</div>
                <div className="queue-main">
                  <div className="queue-top">
                    <span className="queue-name">{lang === "hi" ? a.applicantName : a.applicantNameEn}</span>
                    <span className="muted small">{a.id}</span>
                    <BandBadge band={a.attention!.band} />
                  </div>
                  <div className="muted small">
                    {a.category} · {a.caste} · {a.village} · {a.purpose} · {fmtDate(a.submittedAt, lang)} ({a.attention!.daysPending} {t("pendingFor")})
                  </div>
                  {a.attention!.reasons.length > 0 && (
                    <div className="chips">
                      {a.attention!.reasons.map((r, j) => <span key={j} className="chip">{pick(r)}</span>)}
                    </div>
                  )}
                </div>
                <div className="queue-side">
                  <SuggestionBadge decision={a.rules.suggestion} />
                  <span className="muted small">
                    {a.rules.blockers ? `${a.rules.blockers} ${t("blockers")}` : a.rules.warnings ? `${a.rules.warnings} ${t("warnings")}` : t("allClear")}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
