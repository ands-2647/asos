// src/modules/clients/ui/ClientFormScreen.tsx
// Formulário de cliente, usado tanto para criar quanto para editar.
// Só apresentação: validação e gravação ficam em shared/clients.

import { useEffect, useState, useRef } from "react";
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
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error]);

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

      {error && (
        <div ref={errorRef} className="error-box" role="alert" tabIndex={-1}>
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <div className="field">
          <label htmlFor="client-name">Nome</label>
          <input
            id="client-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Nome do cliente"
            autoFocus
            autoCapitalize="words"
            enterKeyHint="next"
          />
        </div>

        <div className="field">
          <label htmlFor="client-phone">Telefone</label>
          <input
            id="client-phone"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="(11) 90000-0000"
            inputMode="tel"
            enterKeyHint="next"
          />
        </div>

        <div className="field">
          <label htmlFor="client-email">E-mail</label>
          <input
            id="client-email"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="cliente@exemplo.com"
            autoCapitalize="none"
            enterKeyHint="next"
          />
          <div className="hint">Opcional</div>
        </div>

        <div className="field">
          <label htmlFor="client-cpf">CPF / CNPJ</label>
          <input
            id="client-cpf"
            value={form.cpfCnpj}
            onChange={(e) => set("cpfCnpj", e.target.value)}
            placeholder="000.000.000-00"
            inputMode="numeric"
            enterKeyHint="next"
          />
          <div className="hint">Opcional</div>
        </div>

        <div className="field">
          <label htmlFor="client-notes">Observações</label>
          <textarea
            id="client-notes"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Anotações sobre o cliente"
          />
          <div className="hint">Opcional</div>
        </div>

        <button className="btn-primary btn-block" type="submit" disabled={saving}>
          {saving ? "Salvando..." : mode === "edit" ? "Salvar alterações" : "Cadastrar cliente"}
        </button>
      </form>

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
