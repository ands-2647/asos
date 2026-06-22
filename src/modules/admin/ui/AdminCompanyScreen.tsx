// src/modules/admin/ui/AdminCompanyScreen.tsx
// Detalhe da empresa: editar dados (mesmo que o cliente não saiba), definir plano/cobrança,
// mudar status e entrar como cliente. Só apresentação: shared/admin faz o trabalho.

import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AdminLayout } from "./AdminLayout";
import {
  getTenant,
  updateCompany,
  setPlan,
  setTenantStatus,
  statusLabel,
  formatBRL,
  PLAN_LABELS,
  type AdminTenantDetail,
  type CompanyEdit,
  type PlanCode,
  type TenantStatus,
} from "../../../shared/admin/admin";

export function AdminCompanyScreen() {
  const { tenantId = "" } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<AdminTenantDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);

  const [company, setCompany] = useState<CompanyEdit>(emptyCompany);
  const [plan, setPlanForm] = useState<{ plan: PlanCode; amount: string; start: string; due: string }>({
    plan: "trial",
    amount: "",
    start: "",
    due: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getTenant(tenantId);
    if (data) {
      setDetail(data);
      setCompany({
        name: data.tenant.name ?? "",
        cnpj: data.settings?.cnpj ?? "",
        address: data.settings?.address ?? "",
        phone: data.settings?.phone ?? "",
        whatsapp: data.settings?.whatsapp ?? "",
        pix: data.settings?.pix_key ?? "",
        logoUrl: data.settings?.logo_url ?? "",
        observation: data.settings?.default_observation ?? "",
      });
      setPlanForm({
        plan: data.tenant.plan,
        amount: data.tenant.plan_amount ? String(data.tenant.plan_amount) : "",
        start: data.tenant.plan_started_on ?? "",
        due: data.tenant.plan_due_on ?? "",
      });
    }
    setError(error);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveCompany() {
    setSavingCompany(true);
    setError(null);
    setOk(null);
    const { error } = await updateCompany(tenantId, company);
    if (error) setError(error);
    else { setOk("Dados da empresa atualizados."); await load(); }
    setSavingCompany(false);
  }

  async function savePlan() {
    setSavingPlan(true);
    setError(null);
    setOk(null);
    const amount = plan.amount.trim() === "" ? 0 : Number(plan.amount.replace(",", "."));
    const { error } = await setPlan(tenantId, plan.plan, amount, plan.start || null, plan.due || null);
    if (error) setError(error);
    else { setOk("Plano atualizado."); await load(); }
    setSavingPlan(false);
  }

  async function changeStatus(status: TenantStatus, action: string) {
    setError(null);
    setOk(null);
    const { error } = await setTenantStatus(tenantId, status, action);
    if (error) setError(error);
    else { setOk("Status atualizado."); await load(); }
  }

  if (loading) return <AdminLayout active="empresas"><div className="hint">Carregando…</div></AdminLayout>;
  if (!detail) return <AdminLayout active="empresas"><div className="error-box">{error ?? "Empresa não encontrada."}</div></AdminLayout>;

  const t = detail.tenant;
  const m = detail.metrics;

  return (
    <AdminLayout active="empresas">
      <button className="link-btn" onClick={() => navigate("/admin/empresas")}>← Empresas</button>

      <div className="admin-detail-head">
        <div>
          <h2 className="admin-h2">{t.name}</h2>
          <div className="admin-row-sub">{detail.owner.name ?? "—"} · {detail.owner.email ?? "—"}</div>
        </div>
        <span className={`status-pill status-${t.status}`}>{statusLabel(t.status)}</span>
      </div>

      {error && <div className="error-box">{error}</div>}
      {ok && <div className="ok-box">{ok}</div>}

      <div className="admin-actions-bar">
        {(t.status === "pending" || t.status === "rejected") && (
          <button className="btn-mini btn-mini-ok" onClick={() => changeStatus("active", "approve")}>Aprovar</button>
        )}
        {t.status === "pending" && (
          <button className="btn-mini btn-mini-danger" onClick={() => changeStatus("rejected", "reject")}>Rejeitar</button>
        )}
        {(t.status === "active" || t.status === "trial") && (
          <button className="btn-mini btn-mini-danger" onClick={() => changeStatus("blocked", "block")}>Bloquear</button>
        )}
        {(t.status === "blocked" || t.status === "expired") && (
          <button className="btn-mini btn-mini-ok" onClick={() => changeStatus("active", "unblock")}>Desbloquear</button>
        )}
        <button className="btn-mini btn-mini-brand" onClick={() => navigate(`/admin/empresas/${tenantId}/suporte`)}>
          Entrar como cliente
        </button>
      </div>

      {/* Métricas */}
      <div className="fin-cards">
        <Card label="Clientes" value={String(m.clients)} />
        <Card label="Atendimentos" value={String(m.documents)} />
        <Card label="Faturamento" value={formatBRL(m.revenue_total)} />
        <Card label="A receber" value={formatBRL(m.receivable)} />
      </div>

      {/* Dados da empresa */}
      <div className="section-title">Dados da empresa</div>
      <div className="detail-card admin-form">
        <Field label="Nome" value={company.name} onChange={(v) => setCompany({ ...company, name: v })} />
        <Field label="CNPJ" value={company.cnpj} onChange={(v) => setCompany({ ...company, cnpj: v })} />
        <Field label="Endereço" value={company.address} onChange={(v) => setCompany({ ...company, address: v })} />
        <Field label="Telefone" value={company.phone} onChange={(v) => setCompany({ ...company, phone: v })} />
        <Field label="WhatsApp" value={company.whatsapp} onChange={(v) => setCompany({ ...company, whatsapp: v })} />
        <Field label="Pix" value={company.pix} onChange={(v) => setCompany({ ...company, pix: v })} />
        <Field label="Observação padrão" value={company.observation} onChange={(v) => setCompany({ ...company, observation: v })} />
        <button className="btn-primary btn-block" disabled={savingCompany} onClick={saveCompany}>
          {savingCompany ? "Salvando…" : "Salvar dados"}
        </button>
      </div>

      {/* Plano */}
      <div className="section-title">Plano e cobrança</div>
      <div className="detail-card admin-form">
        <label className="field">
          <span className="field-label">Plano</span>
          <select className="field-input" value={plan.plan} onChange={(e) => setPlanForm({ ...plan, plan: e.target.value as PlanCode })}>
            {(Object.keys(PLAN_LABELS) as PlanCode[]).map((p) => (
              <option key={p} value={p}>{PLAN_LABELS[p]}</option>
            ))}
          </select>
        </label>
        <Field label="Valor (R$)" value={plan.amount} onChange={(v) => setPlanForm({ ...plan, amount: v })} />
        <label className="field">
          <span className="field-label">Início</span>
          <input className="field-input" type="date" value={plan.start} onChange={(e) => setPlanForm({ ...plan, start: e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">Vencimento</span>
          <input className="field-input" type="date" value={plan.due} onChange={(e) => setPlanForm({ ...plan, due: e.target.value })} />
        </label>
        {t.days_left != null && (
          <div className="detail-row">
            <span className="detail-row-label">Dias restantes</span>
            <span className={`detail-row-value ${t.days_left < 0 ? "txt-danger" : ""}`}>
              {t.days_left < 0 ? `Vencido há ${-t.days_left} dia(s)` : `${t.days_left} dia(s)`}
            </span>
          </div>
        )}
        <button className="btn-primary btn-block" disabled={savingPlan} onClick={savePlan}>
          {savingPlan ? "Salvando…" : "Salvar plano"}
        </button>
      </div>
    </AdminLayout>
  );
}

const emptyCompany: CompanyEdit = {
  name: "", cnpj: "", address: "", phone: "", whatsapp: "", pix: "", logoUrl: "", observation: "",
};

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input className="field-input" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
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
