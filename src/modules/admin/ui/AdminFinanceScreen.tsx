// src/modules/admin/ui/AdminFinanceScreen.tsx
// Financeiro/Métricas da plataforma AS OS. Cards de status + MRR/receita anual + cancelamentos.
// Só apresentação: dados de shared/admin (admin_metrics).

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "./AdminLayout";
import {
  getMetrics,
  listTenants,
  runBillingCycle,
  formatBRL,
  statusLabel,
  type AdminMetrics,
  type AdminTenantRow,
} from "../../../shared/admin/admin";

export function AdminFinanceScreen() {
  const navigate = useNavigate();
  const [m, setM] = useState<AdminMetrics | null>(null);
  const [tenants, setTenants] = useState<AdminTenantRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [ran, setRan] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [mt, ts] = await Promise.all([getMetrics(), listTenants()]);
    setM(mt.data);
    setTenants(ts.data);
    setError(mt.error ?? ts.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runCycle() {
    setRunning(true);
    setRan(null);
    const { data, error } = await runBillingCycle();
    if (error) setError(error);
    else {
      setRan(`Ciclo executado: ${data?.warned_7d ?? 0} avisos 7d, ${data?.warned_3d ?? 0} avisos 3d, ${data?.expired ?? 0} expiradas, ${data?.blocked ?? 0} bloqueadas.`);
      await load();
    }
    setRunning(false);
  }

  return (
    <AdminLayout active="financeiro">
      <div className="admin-toolbar">
        <h2 className="admin-h2">Financeiro AS OS</h2>
        <button className="btn-mini" disabled={running} onClick={runCycle}>
          {running ? "Rodando…" : "Rodar ciclo de cobrança"}
        </button>
      </div>
      {ran && <div className="ok-box">{ran}</div>}
      {error && <div className="error-box">{error}</div>}
      {loading ? (
        <div className="hint">Carregando…</div>
      ) : m ? (
        <>
          <div className="fin-cards">
            <Card label="Empresas ativas" value={String(m.active)} tone="green" />
            <Card label="Em trial" value={String(m.trial)} tone="amber" />
            <Card label="Vencidas" value={String(m.expired)} tone="danger" />
            <Card label="Bloqueadas" value={String(m.blocked)} tone="danger" />
          </div>

          <div className="section-title">Cobrança</div>
          <div className="fin-cards">
            <Card label="Inadimplência (vencidas+bloq.)" value={String(m.overdue)} tone="danger" />
            <Card label="Vencimentos em 7 dias" value={String(m.due_soon)} tone="amber" />
            <Card label="Faturas vencidas" value={String(m.invoices_overdue)} tone="danger" />
            <Card label="Em aberto" value={formatBRL(m.invoices_open_amount)} tone="amber" />
          </div>

          <div className="section-title">Receita</div>
          <div className="fin-cards">
            <Card label="Receita mensal (MRR)" value={formatBRL(m.mrr)} tone="brand" />
            <Card label="Receita anual" value={formatBRL(m.annual)} tone="brand" />
          </div>

          <div className="section-title">Trials próximos do vencimento</div>
          {trialsExpiring(tenants).length === 0 ? (
            <div className="hint">Nenhum trial vencendo nos próximos 7 dias.</div>
          ) : (
            <div className="admin-list">
              {trialsExpiring(tenants).map((t) => (
                <button key={t.tenant_id} className="admin-row" onClick={() => navigate(`/admin/empresas/${t.tenant_id}`)} style={{ textAlign: "left" }}>
                  <div className="admin-row-main">
                    <div className="admin-row-top">
                      <span className="admin-row-name">{t.name}</span>
                      <span className={`status-pill status-${t.status}`}>
                        {t.days_left != null && t.days_left < 0 ? `Vencido há ${-t.days_left}d` : `${t.days_left}d`}
                      </span>
                    </div>
                    <div className="admin-row-sub">{t.plan_label} · {t.owner_email ?? "—"}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="section-title">Últimos cadastros</div>
          {tenants.length === 0 ? (
            <div className="hint">Nenhuma empresa.</div>
          ) : (
            <div className="admin-list">
              {tenants.slice(0, 5).map((t) => (
                <button key={t.tenant_id} className="admin-row" onClick={() => navigate(`/admin/empresas/${t.tenant_id}`)} style={{ textAlign: "left" }}>
                  <div className="admin-row-main">
                    <div className="admin-row-top">
                      <span className="admin-row-name">{t.name}</span>
                      <span className={`status-pill status-${t.status}`}>{statusLabel(t.status)}</span>
                    </div>
                    <div className="admin-row-sub">{t.owner_email ?? "—"} · {fmtDate(t.created_at)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="section-title">Visão geral</div>
          <div className="detail-card">
            <Row label="Total de empresas" value={String(m.companies_total)} />
            <Row label="Ativas" value={String(m.active)} />
            <Row label="Trials" value={String(m.trial)} />
            <Row label="Aguardando aprovação" value={String(m.pending)} />
            <Row label="Expiradas" value={String(m.expired)} />
            <Row label="Bloqueadas" value={String(m.blocked)} />
            <Row label="Rejeitadas" value={String(m.rejected)} />
            <Row label="Cancelamentos (bloq./rej./venc.)" value={String(m.cancellations)} />
          </div>
        </>
      ) : null}
    </AdminLayout>
  );
}

// trials/contas com vencimento nos próximos 7 dias (ou já vencido), mais urgente primeiro
function trialsExpiring(tenants: AdminTenantRow[]): AdminTenantRow[] {
  return tenants
    .filter((t) => (t.status === "trial" || t.status === "active") && t.days_left != null && t.days_left <= 7)
    .sort((a, b) => (a.days_left ?? 0) - (b.days_left ?? 0));
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function Card({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`fin-card ${tone ? `fin-card-${tone}` : ""}`}>
      <div className="fin-card-label">{label}</div>
      <div className="fin-card-value">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span className="detail-row-label">{label}</span>
      <span className="detail-row-value">{value}</span>
    </div>
  );
}
