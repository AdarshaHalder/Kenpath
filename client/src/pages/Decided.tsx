import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Empty, ErrorBanner, Spinner, StatusBadge } from "../components/ui";
import { STATUS_LABEL, fmtDate, useLang } from "../i18n";
import type { ApplicationSummary, Status } from "../types";
import { useAsync } from "../useAsync";

export function DecidedPage() {
  const { t, pick, lang } = useLang();
  const [status, setStatus] = useState<Exclude<Status, "pending">>("approved");
  const list = useAsync(() => api<{ data: ApplicationSummary[] }>(`/applications?status=${status}`).then((r) => r.data), [status]);

  return (
    <div className="page">
      <h1>{t("decided")}</h1>
      <div className="tabs">
        {(["approved", "returned", "rejected"] as const).map((s) => (
          <button key={s} className={`tab ${status === s ? "active" : ""}`} onClick={() => setStatus(s)}>{pick(STATUS_LABEL[s])}</button>
        ))}
      </div>
      {list.loading ? <Spinner /> : list.error ? <ErrorBanner error={list.error} /> : list.data!.length === 0 ? <Empty>{t("nothingHere")}</Empty> : (
        <ol className="queue">
          {list.data!.map((a) => (
            <li key={a.id}>
              <Link to={`/applications/${a.id}`} className="queue-item">
                <div className="queue-main">
                  <div className="queue-top">
                    <span className="queue-name">{lang === "hi" ? a.applicantName : a.applicantNameEn}</span>
                    <span className="muted small">{a.id}</span>
                  </div>
                  <div className="muted small">{a.category} · {a.caste} · {a.village} · {fmtDate(a.decidedAt, lang)}</div>
                </div>
                <div className="queue-side"><StatusBadge status={a.status} /></div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
