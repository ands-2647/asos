// src/modules/dashboard/ui/DashboardScreen.tsx
// Dashboard executivo. Só apresentação: dados de shared/dashboard.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  loadDashboard,
  formatBRL,
  formatPct,
  type DashboardData,
  type RankRow,
  type MonthPoint,
} from "../../../shared/dashboard/dashboard";

export function DashboardScreen() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard().then(({ data, error }) => {
      setData(data);
      setError(error);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="loading-screen">Carregando…</div>;

  return (
    <div className="screen screen-wide">
      <header className="home-top">
        <div>
          <button className="link-btn" onClick={() => navigate("/home")}>
            ← Início
          </button>
          <div className="home-hello">Dashboard</div>
        </div>
      </header>

      {error && <div className="error-box">{error}</div>}

      {data && (
        <>
          <div className="fin-cards">
            <Card label="Faturamento do mês" value={formatBRL(data.revenueMonth)} />
            <Card label="Últimos 30 dias" value={formatBRL(data.revenue30d)} />
            <Card label="Ticket médio" value={formatBRL(data.avgTicket)} />
            <Card label="Clientes ativos" value={String(data.activeClients)} />
            <Card label="Ordens de serviço" value={String(data.serviceOrderCount)} />
            <Card label="Orçamentos" value={String(data.budgetCount)} />
          </div>

          <div className="section-title">Conversão</div>
          <div className="detail-card">
            <Row label="Orçamentos aprovados" value={String(data.budgetsApproved)} />
            <Row label="Orçamentos reprovados" value={String(data.budgetsReproved)} />
            <Row label="Taxa de conversão (orçamento → OS)" value={formatPct(data.conversionRate)} />
          </div>

          <div className="section-title">Faturamento mensal (12 meses)</div>
          <BarChart points={data.revenueByMonth} money />

          <div className="section-title">Atendimentos por mês (12 meses)</div>
          <BarChart points={data.documentsByMonth} />

          <div className="section-title">Top 10 clientes por faturamento</div>
          <RankList rows={data.topClients} money />

          <div className="section-title">Serviços mais vendidos</div>
          <RankList rows={data.topServices} money />

          <div className="section-title">Peças mais vendidas</div>
          <RankList rows={data.topItems} money />
        </>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="fin-card">
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

function RankList({ rows, money }: { rows: RankRow[]; money?: boolean }) {
  if (rows.length === 0) return <div className="hint">Sem dados.</div>;
  return (
    <div className="list">
      {rows.map((r, i) => (
        <div className="list-row" key={r.label + i}>
          <div className="list-main">
            <div className="list-title">
              {i + 1}. {r.label}
            </div>
            <div className="list-sub">{r.count}×</div>
          </div>
          <div className="list-amount">{money ? formatBRL(r.value) : r.value}</div>
        </div>
      ))}
    </div>
  );
}

function BarChart({ points, money }: { points: MonthPoint[]; money?: boolean }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const hasData = points.some((p) => p.value > 0);
  return (
    <div className="chart">
      {points.map((p) => (
        <div className="chart-col" key={p.month} title={`${p.label}: ${money ? formatBRL(p.value) : p.value}`}>
          <div className="chart-bar-wrap">
            <div className="chart-bar" style={{ height: `${(p.value / max) * 100}%` }} />
          </div>
          <div className="chart-x">{p.label}</div>
        </div>
      ))}
      {!hasData && <div className="chart-empty">Sem dados no período.</div>}
    </div>
  );
}
