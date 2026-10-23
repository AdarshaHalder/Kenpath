import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { LangToggle } from "../components/Layout";
import { ErrorBanner } from "../components/ui";
import { useLang } from "../i18n";

const DEMO = { email: "tehsildar@chandanpur.example.in", password: "demo1234" };

export function LoginPage() {
  const { officer, login } = useAuth();
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (officer) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={submit}>
        <div className="login-top"><span className="emblem">📜</span><LangToggle /></div>
        <h1>{t("appTitle")}</h1>
        <p className="muted">{t("appSub")}</p>
        <h2 className="h3">{t("loginTitle")}</h2>
        <ErrorBanner error={error} />
        <label className="field"><span>{t("email")}</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field"><span>{t("password")}</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "…" : t("login")}</button>
        <button type="button" className="demo-account" onClick={() => { setEmail(DEMO.email); setPassword(DEMO.password); }}>
          {t("demoAccounts")}: <b>{DEMO.email}</b> / <b>{DEMO.password}</b>
        </button>
        <p className="muted small">{t("demoNote")}</p>
      </form>
    </div>
  );
}
