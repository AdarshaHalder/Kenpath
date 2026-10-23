import type { ReactNode } from "react";
import { STATUS_LABEL, useLang } from "../i18n";
import type { Band, Decision, Status } from "../types";

export function Spinner({ label }: { label?: string }) {
  const { t } = useLang();
  return (
    <div className="spinner" role="status">
      <span className="spinner-dot" /> {label ?? t("loading")}
    </div>
  );
}

export function ErrorBanner({ error }: { error: Error | string | null }) {
  if (!error) return null;
  return <div className="alert alert-error">{typeof error === "string" ? error : error.message}</div>;
}

export function StatusBadge({ status }: { status: Status }) {
  const { pick } = useLang();
  return <span className={`badge status-${status}`}>{pick(STATUS_LABEL[status])}</span>;
}

const BAND_LABEL = { urgent: { hi: "अति आवश्यक", en: "Urgent" }, high: { hi: "आवश्यक", en: "High" }, normal: { hi: "सामान्य", en: "Normal" } };

export function BandBadge({ band }: { band: Band }) {
  const { pick } = useLang();
  return <span className={`badge band-${band}`}>{pick(BAND_LABEL[band])}</span>;
}

const SUGGESTION = {
  approve: { hi: "स्वीकृति योग्य", en: "Approvable" },
  return: { hi: "सुधार आवश्यक", en: "Needs correction" },
  reject: { hi: "अस्वीकृति योग्य", en: "Likely reject" },
};

export function SuggestionBadge({ decision }: { decision: Decision }) {
  const { pick } = useLang();
  return <span className={`badge suggest-${decision}`}>{pick(SUGGESTION[decision])}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
