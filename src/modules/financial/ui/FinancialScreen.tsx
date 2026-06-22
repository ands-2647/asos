// src/modules/financial/ui/FinancialScreen.tsx
// Dashboard financeiro + agenda de cobranças. Só apresentação: dados de shared/financial.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  loadFinancial,
  formatBRL,
  formatShortDate,
  methodLabel,
  type FinancialData,
} from "../../../shared/financial/financial";

export function FinancialScreen() {
  const navigate = useNavigate();
  const [data, setData] = useState<FinancialData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFinancial().then(({ data, error }) => {
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
          <div className="home-hello">Financeiro</div>
        </div>
      </header>

      {error && <div className="error-box">{error}</div>}

      {data && (
        <>
          <div className="fin-cards">
            <Card label="Total a receber" value={formatBRL(data.summary.totalReceivable)} />
            <Card
              label="Vencidas"
              value={formatBRL(data.summary.overdueAmount)}
              hint={`${data.summary.overdueCount} cobrança(s)`}
              tone="danger"
            />
            <Card
              label="Próximas (7 dias)"
              value={formatBRL(data.summary.upcomingAmount)}
              hint={`${data.summary.upcomingCount} cobrança(s)`}
              tone="warn"
            />
            <Card label="Recebido no mês" value={formatBRL(data.summary.receivedThisMonth)} tone="ok" />
          </div>

          <div className="section-title">Cobranças vencidas</div>
          {data.overdue.length === 0 ? (
            <div className="hint">Nenhuma cobrança vencida.</div>
          ) : (
            <div className="list">
              {data.overdue.map((c) => (
                <button
                  key={c.chargeId}
                  className="list-row list-row-btn"
                  onClick={() => navigate(`/atendimentos/${c.documentId}`)}
                >
                  <div className="list-main">
                    <div className="list-title">{c.clientName ?? "Cliente"}</div>
                    <div className="list-sub">
                      {c.docLabel} · <span className="value-pending">{c.daysLate} dia(s) em atraso</span>
                    </div>
                  </div>
                  <div className="list-amount">{formatBRL(c.amount)}</div>
                </button>
              ))}
            </div>
          )}

          <div className="section-title">Próximos vencimentos</div>
          {data.upcoming.length === 0 ? (
            <div className="hint">Nenhum vencimento nos próximos {7} dias.</div>
          ) : (
            <div className="list">
              {data.upcoming.map((c) => (
                <button
                  key={c.chargeId}
                  className="list-row list-row-btn"
                  onClick={() => navigate(`/atendimentos/${c.documentId}`)}
                >
                  <div className="list-main">
                    <div className="list-title">{c.clientName ?? "Cliente"}</div>
                    <div className="list-sub">
                      {c.docLabel} · vence em {formatShortDate(c.dueDate)}
                    </div>
                  </div>
                  <div className="list-amount">{formatBRL(c.amount)}</div>
                </button>
              ))}
            </div>
          )}

          <div className="section-title">Recebimentos recentes</div>
          {data.recentPayments.length === 0 ? (
            <div className="hint">Nenhum recebimento ainda.</div>
          ) : (
            <div className="list">
              {data.recentPayments.map((p) => (
                <div className="list-row" key={p.id}>
                  <div className="list-main">
                    <div className="list-title">{p.clientName ?? "Cliente"}</div>
                    <div className="list-sub">
                      {methodLabel(p.method)} · {formatShortDate(p.paidOn)}
                    </div>
                  </div>
                  <div className="list-amount value-ok">{formatBRL(p.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Card({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "danger" | "warn" | "ok";
}) {
  return (
    <div className={"fin-card" + (tone ? " fin-card-" + tone : "")}>
      <div className="fin-card-label">{label}</div>
      <div className="fin-card-value">{value}</div>
      {hint && <div className="fin-card-hint">{hint}</div>}
    </div>
  );
}
