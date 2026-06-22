// src/modules/admin/ui/AdminSupportView.tsx
// "Entrar como cliente" — visão de suporte SOMENTE LEITURA do tenant, via RPC
// admin_enter_tenant (que registra auditoria). Banner fixo "MODO SUPORTE AS OS".
// Nenhuma senha do cliente é necessária e o isolamento de tenant não é afrouxado:
// os dados vêm de função SECURITY DEFINER protegida por is_platform_admin().

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  enterTenant,
  updateCompany,
  updateSettings,
  formatBRL,
  statusLabel,
  type AdminTenantDetail,
  type CompanyEdit,
} from "../../../shared/admin/admin";

const emptyCompany: CompanyEdit = {
  name: "", cnpj: "", address: "", phone: "", whatsapp: "", pix: "", logoUrl: "", observation: "",
};

export function AdminSupportView() {
  const { tenantId = "" } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<AdminTenantDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyEdit>(emptyCompany);
  const [validity, setValidity] = useState("");

  function fill(d: AdminTenantDetail) {
    setCompany({
      name: d.tenant.name ?? "",
      cnpj: d.settings?.cnpj ?? "",
      address: d.settings?.address ?? "",
      phone: d.settings?.phone ?? "",
      whatsapp: d.settings?.whatsapp ?? "",
      pix: d.settings?.pix_key ?? "",
      logoUrl: d.settings?.logo_url ?? "",
      observation: d.settings?.default_observation ?? "",
    });
  }

  function loadDetail() {
    return enterTenant(tenantId).then(({ data, error }) => {
      setDetail(data);
      if (data) fill(data);
      setError(error);
      setLoading(false);
    });
  }

  useEffect(() => {
    loadDetail();
  }, [tenantId]);

  async function save() {
    setSaving(true);
    setError(null);
    setOk(null);
    const r1 = await updateCompany(tenantId, company);
    const r2 = validity.trim() === "" ? { error: null } : await updateSettings(tenantId, Number(validity));
    if (r1.error || r2.error) setError(r1.error ?? r2.error);
    else {
      setOk("Dados atualizados (registrado na auditoria).");
      setEditing(false);
      await loadDetail();
    }
    setSaving(false);
  }

  const exit = () => navigate(`/admin/empresas/${tenantId}`);

  return (
    <div className="screen screen-wide support-screen">
      <div className="support-banner">
        <div className="support-banner-text">
          <strong>MODO SUPORTE AS OS</strong>
          <span>Você está acessando a empresa {detail?.tenant.name ?? "…"}</span>
        </div>
        <button className="support-exit" onClick={exit}>Sair da visualização</button>
      </div>

      <div className="support-body">
        {error && <div className="error-box">{error}</div>}
        {ok && <div className="ok-box">{ok}</div>}
        {loading ? (
          <div className="hint">Carregando…</div>
        ) : detail ? (
          <>
            <div className="admin-detail-head">
              <div>
                <h2 className="admin-h2">{detail.tenant.name}</h2>
                <div className="admin-row-sub">
                  {detail.owner.name ?? "—"} · {detail.owner.email ?? "—"}
                </div>
              </div>
              <span className={`status-pill status-${detail.tenant.status}`}>
                {statusLabel(detail.tenant.status)}
              </span>
            </div>

            <div className="admin-actions-bar">
              <button className="btn-mini btn-mini-brand" onClick={() => setEditing((v) => !v)}>
                {editing ? "Cancelar edição" : "Editar dados da empresa"}
              </button>
            </div>

            {editing && (
              <div className="detail-card admin-form">
                <Edit label="Nome" value={company.name} onChange={(v) => setCompany({ ...company, name: v })} />
                <Edit label="Endereço" value={company.address} onChange={(v) => setCompany({ ...company, address: v })} />
                <Edit label="Telefone" value={company.phone} onChange={(v) => setCompany({ ...company, phone: v })} />
                <Edit label="WhatsApp" value={company.whatsapp} onChange={(v) => setCompany({ ...company, whatsapp: v })} />
                <Edit label="Pix" value={company.pix} onChange={(v) => setCompany({ ...company, pix: v })} />
                <Edit label="Logo (URL)" value={company.logoUrl} onChange={(v) => setCompany({ ...company, logoUrl: v })} />
                <Edit label="Observação padrão" value={company.observation} onChange={(v) => setCompany({ ...company, observation: v })} />
                <Edit label="Validade padrão (dias)" value={validity} onChange={setValidity} placeholder="deixe vazio p/ manter" />
                <button className="btn-primary btn-block" disabled={saving} onClick={save}>
                  {saving ? "Salvando…" : "Salvar alterações"}
                </button>
              </div>
            )}

            <div className="fin-cards">
              <Card label="Clientes" value={String(detail.metrics.clients)} />
              <Card label="Atendimentos" value={String(detail.metrics.documents)} />
              <Card label="Orçamentos" value={String(detail.metrics.budgets)} />
              <Card label="Ordens de serviço" value={String(detail.metrics.service_orders)} />
              <Card label="Faturamento" value={formatBRL(detail.metrics.revenue_total)} />
              <Card label="A receber" value={formatBRL(detail.metrics.receivable)} />
            </div>

            <div className="section-title">Atendimentos recentes</div>
            {detail.recent_documents.length === 0 ? (
              <div className="hint">Nenhum atendimento.</div>
            ) : (
              <div className="list">
                {detail.recent_documents.map((d) => (
                  <div className="list-row" key={d.id}>
                    <div className="list-main">
                      <div className="list-title">
                        {d.kind === "budget" ? "Orçamento" : "OS"}{d.number != null ? ` #${d.number}` : ""} · {d.client_name ?? "—"}
                      </div>
                      <div className="list-sub">{d.work_status} · {d.payment_status} · {fmtDate(d.created_at)}</div>
                    </div>
                    <div className="list-amount">{formatBRL(d.total)}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="section-title">Clientes recentes</div>
            {detail.recent_clients.length === 0 ? (
              <div className="hint">Nenhum cliente.</div>
            ) : (
              <div className="list">
                {detail.recent_clients.map((c) => (
                  <div className="list-row" key={c.id}>
                    <div className="list-main">
                      <div className="list-title">{c.name}</div>
                      <div className="list-sub">{c.phone ?? "—"} · {fmtDate(c.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="hint support-note">
              Modo suporte: leitura dos dados do cliente e edição assistida (endereço, contato, Pix,
              logo e configurações). Toda alteração é registrada na auditoria com seu usuário e data/hora.
            </p>
          </>
        ) : null}
      </div>
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

function Edit({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input className="field-input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
