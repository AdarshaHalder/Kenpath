import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";
import { useLang } from "../i18n";

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      <button className={lang === "hi" ? "active" : ""} onClick={() => setLang("hi")}>हिन्दी</button>
      <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>English</button>
    </div>
  );
}

export function Layout() {
  const { officer, logout } = useAuth();
  const { t } = useLang();
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="emblem">📜</span>
          <div>
            <div className="brand-title">{t("appTitle")}</div>
            <div className="brand-sub">{t("appSub")}</div>
          </div>
        </div>
        <nav className="nav">
          <NavLink to="/" end>{t("pendingQueue")}</NavLink>
          <NavLink to="/decided">{t("decided")}</NavLink>
        </nav>
        <div className="top-right">
          <LangToggle />
          <div className="officer">
            <div className="officer-name">{officer?.name}</div>
            <div className="officer-role">{officer?.designation}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout}>{t("signOut")}</button>
        </div>
      </header>
      <div className="demo-strip">{t("demoNote")}</div>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
