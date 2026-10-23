import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/ui";
import { ApplicationPage } from "./pages/Application";
import { DecidedPage } from "./pages/Decided";
import { LoginPage } from "./pages/Login";
import { QueuePage } from "./pages/Queue";

function RequireOfficer({ children }: { children: ReactNode }) {
  const { officer, loading } = useAuth();
  if (loading) return <Spinner />;
  return officer ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireOfficer><Layout /></RequireOfficer>}>
        <Route path="/" element={<QueuePage />} />
        <Route path="/decided" element={<DecidedPage />} />
        <Route path="/applications/:id" element={<ApplicationPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
