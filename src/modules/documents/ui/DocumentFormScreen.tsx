// src/modules/documents/ui/DocumentFormScreen.tsx
// Formulário de atendimento (orçamento/OS): cria e edita CONTEÚDO (cliente, tipo, peças,
// serviços, desconto, validade, observação) com total ao vivo. As ações de status e a
// conversão ficam na tela de detalhe. Só apresentação: lógica em shared/documents.

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { listClients, type ClientRow } from "../../../shared/clients/clients";
import {
  createDocument,
  updateDocument,
  getDocument,
  computeTotal,
  lineTotal,
  formatBRL,
  emptyDocument,
  emptyItem,
  emptyService,
  type DocumentInput,
  type ItemInput,
  type ServiceInput,
  type DocumentKind,
} from "../../../shared/documents/documents";

export function DocumentFormScreen({ mode }: { mode: "create" | "edit" }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [form, setForm] = useState<DocumentInput>(emptyDocument);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: clientList } = await listClients();
      setClients(clientList);

      if (mode === "edit" && id) {
        const { data, error } = await getDocument(id);
        if (error) setError(error);
        else if (data)
          setForm({
            clientId: data.clientId,
            kind: data.kind,
            observation: data.observation,
            validUntil: data.validUntil,
            discount: data.discount,
            items: data.items,
            services: data.services,
          });
      } else if (clientList.length > 0) {
        setForm((prev) => ({ ...prev, clientId: clientList[0].id }));
      }
      setLoading(false);
    }
    init();
  }, [mode, id]);

  function setField<K extends keyof DocumentInput>(key: K, value: DocumentInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addItem() {
    setForm((p) => ({ ...p, items: [...p.items, { ...emptyItem }] }));
  }
  function setItem(idx: number, key: keyof ItemInput, value: string) {
    setForm((p) => ({
      ...p,
      items: p.items.map((it, i) => (i === idx ? { ...it, [key]: value } : it)),
    }));
  }
  function removeItem(idx: number) {
    setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));
  }

  function addService() {
    setForm((p) => ({ ...p, services: [...p.services, { ...emptyService }] }));
  }
  function setService(idx: number, key: keyof ServiceInput, value: string) {
    setForm((p) => ({
      ...p,
      services: p.services.map((sv, i) => (i === idx ? { ...sv, [key]: value } : sv)),
    }));
  }
  function removeService(idx: number) {
    setForm((p) => ({ ...p, services: p.services.filter((_, i) => i !== idx) }));
  }

  async function handleSubmit() {
    setError(null);
    setSaving(true);
    if (mode === "edit" && id) {
      const { error } = await updateDocument(id, form);
      setSaving(false);
      if (error) setError(error);
      else navigate(`/atendimentos/${id}`, { replace: true });
    } else {
      const { id: newId, error } = await createDocument(form);
      setSaving(false);
      if (error) setError(error);
      else if (newId) navigate(`/atendimentos/${newId}`, { replace: true });
    }
  }

  if (loading) return <div className="loading-screen">Carregando…</div>;

  if (mode === "create" && clients.length === 0) {
    return (
      <div className="screen">
        <header className="home-top">
          <button className="link-btn" onClick={() => navigate("/home")}>
            ← Início
          </button>
        </header>
        <div className="title">Novo atendimento</div>
        <div className="empty-note">
          Você precisa de pelo menos um cliente para criar um atendimento.
        </div>
        <button className="btn-primary btn-block" onClick={() => navigate("/clientes/novo")}>
          Cadastrar cliente
        </button>
      </div>
    );
  }

  const total = computeTotal(form);

  return (
    <div className="screen">
      <header className="home-top">
        <button
          className="link-btn"
          onClick={() => navigate(mode === "edit" && id ? `/atendimentos/${id}` : "/atendimentos")}
        >
          ← Voltar
        </button>
      </header>

      <div className="title">{mode === "edit" ? "Editar atendimento" : "Novo atendimento"}</div>

      {error && <div className="error-box">{error}</div>}

      <div className="field">
        <label>Cliente</label>
        <select
          className="select"
          value={form.clientId}
          onChange={(e) => setField("clientId", e.target.value)}
        >
          <option value="">Selecione…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Tipo</label>
        <select
          className="select"
          value={form.kind}
          onChange={(e) => setField("kind", e.target.value as DocumentKind)}
        >
          <option value="budget">Orçamento</option>
          <option value="service_order">Ordem de serviço</option>
        </select>
      </div>

      <div className="section-title">Peças</div>
      {form.items.map((it, idx) => (
        <div className="line-card" key={idx}>
          <input
            placeholder="Descrição da peça"
            value={it.description}
            onChange={(e) => setItem(idx, "description", e.target.value)}
          />
          <div className="line-grid">
            <div>
              <label className="mini-label">Qtd</label>
              <input
                inputMode="decimal"
                value={it.quantity}
                onChange={(e) => setItem(idx, "quantity", e.target.value)}
              />
            </div>
            <div>
              <label className="mini-label">Preço un.</label>
              <input
                inputMode="decimal"
                value={it.unitPrice}
                onChange={(e) => setItem(idx, "unitPrice", e.target.value)}
              />
            </div>
            <div className="line-sub">
              <label className="mini-label">Subtotal</label>
              <div className="line-sub-val">{formatBRL(lineTotal(it))}</div>
            </div>
          </div>
          <button className="link-btn danger" onClick={() => removeItem(idx)}>
            Remover peça
          </button>
        </div>
      ))}
      <button className="btn-secondary btn-block" onClick={addItem}>
        + Adicionar peça
      </button>

      <div className="section-title">Serviços</div>
      {form.services.map((sv, idx) => (
        <div className="line-card" key={idx}>
          <input
            placeholder="Descrição do serviço"
            value={sv.description}
            onChange={(e) => setService(idx, "description", e.target.value)}
          />
          <div className="line-grid">
            <div>
              <label className="mini-label">Preço</label>
              <input
                inputMode="decimal"
                value={sv.price}
                onChange={(e) => setService(idx, "price", e.target.value)}
              />
            </div>
          </div>
          <button className="link-btn danger" onClick={() => removeService(idx)}>
            Remover serviço
          </button>
        </div>
      ))}
      <button className="btn-secondary btn-block" onClick={addService}>
        + Adicionar serviço
      </button>

      <div className="field mt-24">
        <label>Desconto (R$)</label>
        <input
          inputMode="decimal"
          value={form.discount}
          onChange={(e) => setField("discount", e.target.value)}
          placeholder="0"
        />
      </div>

      <div className="field">
        <label>Validade</label>
        <input
          type="date"
          value={form.validUntil}
          onChange={(e) => setField("validUntil", e.target.value)}
        />
        <div className="hint">Opcional</div>
      </div>

      <div className="field">
        <label>Observação</label>
        <textarea
          value={form.observation}
          onChange={(e) => setField("observation", e.target.value)}
          placeholder="Observações do atendimento"
        />
      </div>

      <div className="total-row">
        <span>Total</span>
        <strong>{formatBRL(total)}</strong>
      </div>

      <button className="btn-primary btn-block" onClick={handleSubmit} disabled={saving}>
        {saving ? "Salvando..." : mode === "edit" ? "Salvar alterações" : "Criar atendimento"}
      </button>
    </div>
  );
}
