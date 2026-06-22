// src/App.tsx
// Rotas do app. A raiz "/" decide para onde mandar conforme a sessão e o onboarding.
// Fluxo cliente: sem sessão -> /auth | logado e sem onboarding -> /onboarding | pronto -> /home.
// Fluxo admin (Etapa 20): /admin/* protegido por papel de plataforma (is_platform_admin).
// O gate de status (pending/expired/blocked/rejected) não apaga dados nem altera o fluxo —
// apenas substitui a tela enquanto a conta não estiver liberada.

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useSession } from "./shared/auth/useSession";
import { useOnboardingStatus } from "./shared/onboarding/useOnboardingStatus";
import { useAccountStatus } from "./shared/account/useAccountStatus";
import { isUsableStatus } from "./shared/account/account";
import { useIsAdmin } from "./shared/admin/useIsAdmin";
import { LoginScreen } from "./modules/auth/ui/LoginScreen";
import { SignUpScreen } from "./modules/auth/ui/SignUpScreen";
import { OnboardingScreen } from "./modules/onboarding/ui/OnboardingScreen";
import { AccountStatusScreen } from "./modules/account/ui/AccountStatusScreen";
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
import { AdminCompaniesScreen } from "./modules/admin/ui/AdminCompaniesScreen";
import { AdminCompanyScreen } from "./modules/admin/ui/AdminCompanyScreen";
import { AdminSupportView } from "./modules/admin/ui/AdminSupportView";
import { AdminFinanceScreen } from "./modules/admin/ui/AdminFinanceScreen";
import { AdminInvoicesScreen } from "./modules/admin/ui/AdminInvoicesScreen";
import { AdminAuditScreen } from "./modules/admin/ui/AdminAuditScreen";
import { AdminForbidden } from "./modules/admin/ui/AdminForbidden";

function Loading() {
  return <div className="loading-screen">Carregando…</div>;
}

// Exige sessão + onboarding concluído + conta liberada (active/trial).
function RequireOnboarded({ children }: { children: React.ReactNode }) {
  const { session, loading: sLoading } = useSession();
  const { onboarded, loading: oLoading } = useOnboardingStatus(session);
  const { status, loading: stLoading } = useAccountStatus(session);
  if (sLoading || (session && (oLoading || stLoading))) return <Loading />;
  if (!session) return <Navigate to="/auth" replace />;
  if (!onboarded) return <Navigate to="/onboarding" replace />;
  if (!isUsableStatus(status)) return <AccountStatusScreen status={status ?? "pending"} />;
  return <>{children}</>;
}

// Tela de onboarding: exige sessão; conta liberada; se já concluiu, vai para a Home.
function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const { session, loading: sLoading } = useSession();
  const { onboarded, loading: oLoading } = useOnboardingStatus(session);
  const { status, loading: stLoading } = useAccountStatus(session);
  if (sLoading || (session && (oLoading || stLoading))) return <Loading />;
  if (!session) return <Navigate to="/auth" replace />;
  if (!isUsableStatus(status)) return <AccountStatusScreen status={status ?? "pending"} />;
  if (onboarded) return <Navigate to="/home" replace />;
  return <>{children}</>;
}

// Guard do painel da plataforma: exige sessão + papel de admin. Sem papel -> 403.
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { session, loading: sLoading } = useSession();
  const { isAdmin, loading: aLoading } = useIsAdmin(session);
  if (sLoading || (session && aLoading)) return <Loading />;
  if (!session) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <AdminForbidden />;
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

        {/* ---- Painel administrativo AS OS (rota oculta, controlada por papel) ---- */}
        <Route path="/admin" element={<Navigate to="/admin/empresas" replace />} />
        <Route
          path="/admin/empresas"
          element={
            <RequireAdmin>
              <AdminCompaniesScreen />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/empresas/:tenantId"
          element={
            <RequireAdmin>
              <AdminCompanyScreen />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/empresas/:tenantId/suporte"
          element={
            <RequireAdmin>
              <AdminSupportView />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/financeiro"
          element={
            <RequireAdmin>
              <AdminFinanceScreen />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/cobrancas"
          element={
            <RequireAdmin>
              <AdminInvoicesScreen />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/auditoria"
          element={
            <RequireAdmin>
              <AdminAuditScreen />
            </RequireAdmin>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
