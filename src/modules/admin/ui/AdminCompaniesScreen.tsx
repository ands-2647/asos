// src/modules/admin/ui/AdminCompaniesScreen.tsx
// Lista de empresas da plataforma + ações (aprovar/rejeitar/bloquear/desbloquear,
// editar empresa, entrar como cliente). Só apresentação: tudo vem de shared/admin.

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "./AdminLayout";
import {
  listTenants,
  setTenantStatus,
  statusLabel,
  formatBRL,
  type AdminTenantRow,
  type TenantStatus,
} from "../../../shared/admin/admin";

export function AdminCompaniesScreen() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<AdminTenantRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | TenantStatus>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await listTenants();
    setRows(data);
    setError(error);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, status: TenantStatus, action: string) {
    setBusyId(id);
    setError(null);
    const { error } = await setTenantStatus(id, status, action);
    if (error) setError(error);
    else await load();
    setBusyId(null);
  }

  const visible = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  return (
    <AdminLayout active="empresas">
      <div className="admin-toolbar">
        <h2 className="admin-h2">Empresas ({rows.length})</h2>
        <select className="admin-select" value={filter} onChange={(e) => setFilter(e.target.value as any)}>
          <option value="all">Todas</option>
          <option value="pending">Aguardando</option>
          <option value="active">Ativas</option>
          <option value="trial">Trial</option>
          <option value="expired">Vencidas</option>
          <option value="blocked">Bloqueadas</option>
          <option value="rejected">Rejeitadas</option>
        </select>
      </div>

      {error && <div className="error-box">{error}</div>}
      {loading ? (
        <div className="hint">Carregando…</div>
      ) : visible.length === 0 ? (
        <div className="hint">Nenhuma empresa neste filtro.</div>
      ) : (
        <div className="admin-list">
          {visible.map((r) => (
            <div className="admin-row" key={r.tenant_id}>
              <div className="admin-row-main" onClick={() => navigate(`/admin/empresas/${r.tenant_id}`)}>
                <div className="admin-row-top">
                  <span className="admin-row-name">{r.name}</span>
                  <span className={`status-pill status-${r.status}`}>{statusLabel(r.status)}</span>
                </div>
                <div className="admin-row-sub">
                  {r.owner_name ?? "—"} · {r.owner_email ?? "—"}
                </div>
                <div className="admin-row-meta">
                  <span>{r.plan_label}{r.plan_amount > 0 ? ` · ${formatBRL(r.plan_amount)}` : ""}</span>
                  <span>{r.clients_count} clientes · {r.documents_count} atend.</span>
                  <span>Últ. acesso: {fmtDate(r.last_sign_in_at)}</span>
                  {r.days_left != null && (
                    <span className={r.days_left < 0 ? "txt-danger" : ""}>
                      {r.days_left < 0 ? `Vencido há ${-r.days_left}d` : `${r.days_left}d restantes`}
                    </span>
                  )}
                </div>
              </div>

              <div className="admin-row-actions">
                {(r.status === "pending" || r.status === "rejected") && (
                  <button className="btn-mini btn-mini-ok" disabled={busyId === r.tenant_id}
                    onClick={() => act(r.tenant_id, "active", "approve")}>Aprovar</button>
                )}
                {r.status === "pending" && (
                  <button className="btn-mini btn-mini-danger" disabled={busyId === r.tenant_id}
                    onClick={() => act(r.tenant_id, "rejected", "reject")}>Rejeitar</button>
                )}
                {(r.status === "active" || r.status === "trial") && (
                  <button className="btn-mini btn-mini-danger" disabled={busyId === r.tenant_id}
                    onClick={() => act(r.tenant_id, "blocked", "block")}>Bloquear</button>
                )}
                {(r.status === "blocked" || r.status === "expired") && (
                  <button className="btn-mini btn-mini-ok" disabled={busyId === r.tenant_id}
                    onClick={() => act(r.tenant_id, "active", "unblock")}>Desbloquear</button>
                )}
                <button className="btn-mini" onClick={() => navigate(`/admin/empresas/${r.tenant_id}`)}>Editar</button>
                <button className="btn-mini" onClick={() => navigate(`/admin/empresas/${r.tenant_id}/suporte`)}>Entrar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
