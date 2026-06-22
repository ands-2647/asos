// src/modules/admin/ui/AdminFinanceScreen.tsx
// Financeiro/Métricas da plataforma AS OS. Cards de status + MRR/receita anual + cancelamentos.
// Só apresentação: dados de shared/admin (admin_metrics).

import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "./AdminLayout";
import { getMetrics, runBillingCycle, formatBRL, type AdminMetrics } from "../../../shared/admin/admin";

export function AdminFinanceScreen() {
  const [m, setM] = useState<AdminMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [ran, setRan] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await getMetrics();
    setM(data);
    setError(error);
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
