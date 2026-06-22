// src/modules/admin/ui/AdminAuditScreen.tsx
// Log administrativo: admin, ação, empresa, data. Só leitura (admin_list_audit).

import { useEffect, useState } from "react";
import { AdminLayout } from "./AdminLayout";
import { listAudit, type AdminAuditRow } from "../../../shared/admin/admin";

const ACTION_LABEL: Record<string, string> = {
  approve: "Aprovação",
  reject: "Rejeição",
  block: "Bloqueio",
  unblock: "Desbloqueio",
  set_status: "Alteração de status",
  set_plan: "Alteração de plano",
  update_company: "Edição de empresa",
  enter_as_client: "Entrada como cliente",
  create_invoice: "Cobrança gerada",
  set_invoice_status: "Status de cobrança",
};

export function AdminAuditScreen() {
  const [rows, setRows] = useState<AdminAuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAudit(300).then(({ data, error }) => {
      setRows(data);
      setError(error);
      setLoading(false);
    });
  }, []);

  return (
    <AdminLayout active="auditoria">
      <h2 className="admin-h2">Auditoria ({rows.length})</h2>
      {error && <div className="error-box">{error}</div>}
      {loading ? (
        <div className="hint">Carregando…</div>
      ) : rows.length === 0 ? (
        <div className="hint">Nenhum registro ainda.</div>
      ) : (
        <div className="admin-list">
          {rows.map((r) => (
            <div className="admin-row" key={r.id}>
              <div className="admin-row-main">
                <div className="admin-row-top">
                  <span className="admin-row-name">{ACTION_LABEL[r.action] ?? r.action}</span>
                  <span className="audit-date">{fmtDateTime(r.created_at)}</span>
                </div>
                <div className="admin-row-sub">
                  {r.admin_email ?? "—"} {r.tenant_name ? `→ ${r.tenant_name}` : ""}
                </div>
                {hasMeta(r.metadata) && <div className="audit-meta">{renderMeta(r.metadata)}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

function hasMeta(m: Record<string, unknown>): boolean {
  return m != null && Object.keys(m).length > 0;
}
function renderMeta(m: Record<string, unknown>): string {
  return Object.entries(m)
    .map(([k, v]) => `${k}: ${v ?? "—"}`)
    .join(" · ");
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}
