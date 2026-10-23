import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setUnauthorizedHandler, tokenStore } from "./api";
import type { Officer } from "./types";

interface AuthState {
  officer: Officer | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [officer, setOfficer] = useState<Officer | null>(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));
  const logout = useCallback(() => {
    tokenStore.set(null);
    setOfficer(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) return;
    api<{ officer: Officer }>("/auth/me")
      .then((r) => setOfficer(r.officer))
      .catch(logout)
      .finally(() => setLoading(false));
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<{ token: string; officer: Officer }>("/auth/login", { method: "POST", json: { email, password } });
    tokenStore.set(r.token);
    setOfficer(r.officer);
  }, []);

  return <AuthContext.Provider value={{ officer, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
