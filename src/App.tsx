// src/App.tsx
// Rotas do app. A raiz "/" decide para onde mandar conforme a sessão e o onboarding.
// Fluxo: sem sessão -> /auth | logado e sem onboarding -> /onboarding | pronto -> /home.

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useSession } from "./shared/auth/useSession";
import { useOnboardingStatus } from "./shared/onboarding/useOnboardingStatus";
import { LoginScreen } from "./modules/auth/ui/LoginScreen";
import { SignUpScreen } from "./modules/auth/ui/SignUpScreen";
import { OnboardingScreen } from "./modules/onboarding/ui/OnboardingScreen";
import { HomeScreen } from "./modules/home/ui/HomeScreen";
import { ClientListScreen } from "./modules/clients/ui/ClientListScreen";
import { ClientFormScreen } from "./modules/clients/ui/ClientFormScreen";
import { DocumentListScreen } from "./modules/documents/ui/DocumentListScreen";
import { DocumentFormScreen } from "./modules/documents/ui/DocumentFormScreen";
import { DocumentDetailScreen } from "./modules/documents/ui/DocumentDetailScreen";
import { NotificationsScreen } from "./modules/notifications/ui/NotificationsScreen";
import { FinancialScreen } from "./modules/financial/ui/FinancialScreen";
import { SettingsScreen } from "./modules/settings/ui/SettingsScreen";
import { DashboardScreen } from "./modules/dashboard/ui/DashboardScreen";

function Loading() {
  return <div className="loading-screen">Carregando…</div>;
}

// Exige sessão E onboarding concluído. Sem sessão -> /auth. Sem onboarding -> /onboarding.
function RequireOnboarded({ children }: { children: React.ReactNode }) {
  const { session, loading: sLoading } = useSession();
  const { onboarded, loading: oLoading } = useOnboardingStatus(session);
  if (sLoading || (session && oLoading)) return <Loading />;
  if (!session) return <Navigate to="/auth" replace />;
  if (!onboarded) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

// Tela de onboarding: exige sessão; se já concluiu, manda para a Home.
function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const { session, loading: sLoading } = useSession();
  const { onboarded, loading: oLoading } = useOnboardingStatus(session);
  if (sLoading || (session && oLoading)) return <Loading />;
  if (!session) return <Navigate to="/auth" replace />;
  if (onboarded) return <Navigate to="/home" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const { session, loading: sLoading } = useSession();
  const { onboarded, loading: oLoading } = useOnboardingStatus(session);
  if (sLoading || (session && oLoading)) return <Loading />;
  if (!session) return <Navigate to="/auth" replace />;
  return <Navigate to={onboarded ? "/home" : "/onboarding"} replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/auth" element={<LoginScreen />} />
        <Route path="/signup" element={<SignUpScreen />} />
        <Route
          path="/onboarding"
          element={
            <RequireOnboarding>
              <OnboardingScreen />
            </RequireOnboarding>
          }
        />
        <Route
          path="/home"
          element={
            <RequireOnboarded>
              <HomeScreen />
            </RequireOnboarded>
          }
        />
        <Route
          path="/clientes"
          element={
            <RequireOnboarded>
              <ClientListScreen />
            </RequireOnboarded>
          }
        />
        <Route
          path="/clientes/novo"
          element={
            <RequireOnboarded>
              <ClientFormScreen mode="create" />
            </RequireOnboarded>
          }
        />
        <Route
          path="/clientes/:id/editar"
          element={
            <RequireOnboarded>
              <ClientFormScreen mode="edit" />
            </RequireOnboarded>
          }
        />
        <Route
          path="/atendimentos"
          element={
            <RequireOnboarded>
              <DocumentListScreen />
            </RequireOnboarded>
          }
        />
        <Route
          path="/atendimentos/novo"
          element={
            <RequireOnboarded>
              <DocumentFormScreen mode="create" />
            </RequireOnboarded>
          }
        />
        <Route
          path="/atendimentos/:id"
          element={
            <RequireOnboarded>
              <DocumentDetailScreen />
            </RequireOnboarded>
          }
        />
        <Route
          path="/atendimentos/:id/editar"
          element={
            <RequireOnboarded>
              <DocumentFormScreen mode="edit" />
            </RequireOnboarded>
          }
        />
        <Route
          path="/notificacoes"
          element={
            <RequireOnboarded>
              <NotificationsScreen />
            </RequireOnboarded>
          }
        />
        <Route
          path="/financeiro"
          element={
            <RequireOnboarded>
              <FinancialScreen />
            </RequireOnboarded>
          }
        />
        <Route
          path="/configuracoes"
          element={
            <RequireOnboarded>
              <SettingsScreen />
            </RequireOnboarded>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireOnboarded>
              <DashboardScreen />
            </RequireOnboarded>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
