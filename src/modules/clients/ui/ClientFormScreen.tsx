// src/modules/clients/ui/ClientFormScreen.tsx
// Formulário de cliente, usado tanto para criar quanto para editar.
// Só apresentação: validação e gravação ficam em shared/clients.

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createClient,
  updateClient,
  getClient,
  archiveClient,
  restoreClient,
  emptyClient,
  type ClientInput,
} from "../../../shared/clients/clients";

export function ClientFormScreen({ mode }: { mode: "create" | "edit" }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form, setForm] = useState<ClientInput>(emptyClient);
  const [archivedAt, setArchivedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== "edit" || !id) return;
    getClient(id).then(({ data, error }) => {
      if (error) setError(error);
      else if (data) {
        setForm({
          name: data.name,
          phone: data.phone ?? "",
          email: data.email ?? "",
          cpfCnpj: data.cpfCnpj ?? "",
          notes: data.notes ?? "",
        });
        setArchivedAt(data.archivedAt);
      }
      setLoading(false);
    });
  }, [mode, id]);

  async function handleArchiveToggle() {
    if (!id) return;
    if (!archivedAt && !window.confirm("Arquivar este cliente?")) return;
    setError(null);
    setBusy(true);
    const { error } = archivedAt ? await restoreClient(id) : await archiveClient(id);
    setBusy(false);
    if (error) setError(error);
    else navigate("/clientes", { replace: true });
  }

  function set<K extends keyof ClientInput>(key: K, value: ClientInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    setError(null);
    setSaving(true);
    const { error } =
      mode === "edit" && id ? await updateClient(id, form) : await createClient(form);
    setSaving(false);
    if (error) setError(error);
    else navigate("/clientes", { replace: true });
  }

  if (loading) return <div className="loading-screen">Carregando…</div>;

  return (
    <div className="screen">
      <header className="home-top">
        <button className="link-btn" onClick={() => navigate("/clientes")}>
          ← Clientes
        </button>
      </header>

      <div className="title">{mode === "edit" ? "Editar cliente" : "Novo cliente"}</div>
      <div className="subtitle">Nome e telefone são obrigatórios.</div>

      {error && <div className="error-box">{error}</div>}

      <div className="field">
        <label>Nome</label>
        <input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Nome do cliente"
        />
      </div>

      <div className="field">
        <label>Telefone</label>
        <input
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          placeholder="(11) 90000-0000"
          inputMode="tel"
        />
      </div>

      <div className="field">
        <label>E-mail</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="cliente@exemplo.com"
          autoCapitalize="none"
        />
        <div className="hint">Opcional</div>
      </div>

      <div className="field">
        <label>CPF / CNPJ</label>
        <input
          value={form.cpfCnpj}
          onChange={(e) => set("cpfCnpj", e.target.value)}
          placeholder="000.000.000-00"
          inputMode="numeric"
        />
        <div className="hint">Opcional</div>
      </div>

      <div className="field">
        <label>Observações</label>
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Anotações sobre o cliente"
        />
        <div className="hint">Opcional</div>
      </div>

      <button className="btn-primary btn-block" onClick={handleSubmit} disabled={saving}>
        {saving ? "Salvando..." : mode === "edit" ? "Salvar alterações" : "Cadastrar cliente"}
      </button>

      {mode === "edit" && (
        <button
          className={archivedAt ? "btn-secondary btn-block" : "btn-danger btn-block"}
          onClick={handleArchiveToggle}
          disabled={busy}
        >
          {archivedAt ? "Restaurar cliente" : "Arquivar cliente"}
        </button>
      )}
    </div>
  );
}
