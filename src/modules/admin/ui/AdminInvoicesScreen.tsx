// src/modules/admin/ui/AdminInvoicesScreen.tsx
// Cobranças AS OS: tabela Empresa/Plano/Valor/Vencimento/Status (pago/pendente/vencido).
// Permite gerar cobrança a partir de uma empresa e marcar pago/pendente.

import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "./AdminLayout";
import {
  listInvoices,
  setInvoiceStatus,
  createInvoice,
  listTenants,
  chargeTenantWhatsApp,
  formatBRL,
  PLAN_LABELS,
  type AdminInvoice,
  type AdminTenantRow,
} from "../../../shared/admin/admin";

export function AdminInvoicesScreen() {
  const [rows, setRows] = useState<AdminInvoice[]>([]);
  const [tenants, setTenants] = useState<AdminTenantRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ tenantId: "", plan: "premium", amount: "", due: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [inv, ten] = await Promise.all([listInvoices(), listTenants()]);
    setRows(inv.data);
    setTenants(ten.data);
    setError(inv.error ?? ten.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markStatus(id: string, status: "pago" | "pendente") {
    setError(null);
    const { error } = await setInvoiceStatus(id, status);
    if (error) setError(error);
    else await load();
  }

  async function submitNew() {
    if (!form.tenantId || !form.due) {
      setError("Informe a empresa e o vencimento.");
      return;
    }
    setSaving(true);
    setError(null);
    const amount = form.amount.trim() === "" ? 0 : Number(form.amount.replace(",", "."));
    const { error } = await createInvoice(form.tenantId, PLAN_LABELS[form.plan as keyof typeof PLAN_LABELS] ?? form.plan, amount, form.due);
    if (error) setError(error);
    else {
      setShowNew(false);
      setForm({ tenantId: "", plan: "premium", amount: "", due: "" });
      await load();
    }
    setSaving(false);
  }

  return (
    <AdminLayout active="cobrancas">
      <div className="admin-toolbar">
        <h2 className="admin-h2">Cobranças ({rows.length})</h2>
        <button className="btn-mini btn-mini-brand" onClick={() => setShowNew((v) => !v)}>
          {showNew ? "Cancelar" : "Nova cobrança"}
        </button>
      </div>

      {error && <div className="error-box">{error}</div>}

      {showNew && (
        <div className="detail-card admin-form">
          <label className="field">
            <span className="field-label">Empresa</span>
            <select className="field-input" value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })}>
              <option value="">Selecione…</option>
              {tenants.map((t) => <option key={t.tenant_id} value={t.tenant_id}>{t.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Plano</span>
            <select className="field-input" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
              {Object.entries(PLAN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Valor (R$)</span>
            <input className="field-input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Vencimento</span>
            <input className="field-input" type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
          </label>
          <button className="btn-primary btn-block" disabled={saving} onClick={submitNew}>
            {saving ? "Gerando…" : "Gerar cobrança"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="hint">Carregando…</div>
      ) : rows.length === 0 ? (
        <div className="hint">Nenhuma cobrança ainda.</div>
      ) : (
        <div className="admin-list">
          {rows.map((r) => (
            <div className="admin-row" key={r.id}>
              <div className="admin-row-main">
                <div className="admin-row-top">
                  <span className="admin-row-name">{r.tenant_name}</span>
                  <span className={`status-pill inv-${r.effective_status}`}>{r.effective_status}</span>
                </div>
                <div className="admin-row-meta">
                  <span>{r.plan ?? "—"}</span>
                  <span>{formatBRL(r.amount)}</span>
                  <span>Venc.: {fmtDate(r.due_date)}</span>
                  {r.paid_on && <span>Pago em {fmtDate(r.paid_on)}</span>}
                </div>
              </div>
              <div className="admin-row-actions">
                {r.status !== "pago" && (
                  <button className="btn-mini btn-mini-ok" onClick={() => markStatus(r.id, "pago")}>Marcar pago</button>
                )}
                {r.status === "pago" && (
                  <button className="btn-mini" onClick={() => markStatus(r.id, "pendente")}>Reabrir</button>
                )}
                <button className="btn-mini" onClick={async () => { const { error } = await chargeTenantWhatsApp(r.tenant_id); if (error) setError(error); }}>
                  WhatsApp
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

function fmtDate(iso: string): string {
  // datas vêm como YYYY-MM-DD (date) — evita fuso tratando como local
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y.slice(2)}`;
}
